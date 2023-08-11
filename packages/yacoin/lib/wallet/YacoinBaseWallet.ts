import { Chain, Wallet } from '@yaswap/client';
import { InsufficientBalanceError } from '@yaswap/errors';
import { Address, AddressType, Asset, BigNumber, Transaction, TransactionRequest, CreateTokenTransaction, TokenType, TokenScriptType } from '@yaswap/types';
import { asyncSetImmediate } from '@yaswap/utils';
import { BIP32Interface } from 'bip32';
import { payments, script } from '@yaswap/yacoinjs-lib';
import memoize from 'memoizee';
import { YacoinBaseChainProvider } from '../chain/YacoinBaseChainProvider';
import {
    AddressTxCounts,
    AddressType as YaAddressType,
    YacoinNetwork,
    YacoinWalletProviderOptions,
    Input,
    OutputTarget,
    P2SHInput,
    PsbtInputTarget,
    Transaction as YaTransaction,
    UTXO,
} from '../types';
import { CoinSelectTarget, decodeRawTransaction, normalizeTransactionObject, selectCoins, getPubKeyHash, timelockFeeDuration, timelockFeeAmountInSatoshis } from '../utils';

const ADDRESS_GAP = 10
const NUMBER_ADDRESS_PER_CALL = ADDRESS_GAP
const NUMBER_ADDRESS_LIMIT = 200

export enum AddressSearchType {
    EXTERNAL,
    CHANGE,
    EXTERNAL_OR_CHANGE,
}

type DerivationCache = { [index: string]: Address };

function bigint_to_Buffer(input: bigint){
    const bytesArray = [];
    for(let i = 0; i < 8; i++){
        let shift = input >> BigInt(8 * i)
        shift &= BigInt(255)
        bytesArray[i] = Number(String(shift))
    }
    return Buffer.from(bytesArray)
}

export abstract class YacoinBaseWalletProvider<T extends YacoinBaseChainProvider = any, S = any> extends Wallet<T, S> {
    protected _baseDerivationPath: string;
    protected _network: YacoinNetwork;
    protected _addressType: YaAddressType;
    protected _derivationCache: DerivationCache;

    constructor(options: YacoinWalletProviderOptions, chainProvider?: Chain<T>) {
        const { baseDerivationPath, addressType = YaAddressType.LEGACY } = options;
        const addressTypes = Object.values(YaAddressType);
        if (!addressTypes.includes(addressType)) {
            throw new Error(`addressType must be one of ${addressTypes.join(',')}`);
        }

        super(chainProvider);

        this._baseDerivationPath = baseDerivationPath;
        this._network = chainProvider ? (chainProvider.getNetwork() as YacoinNetwork) : options.network;
        this._addressType = addressType;
        this._derivationCache = {};
    }

    protected onChainProviderUpdate(chainProvider: Chain<T>) {
        this._network = chainProvider.getNetwork() as YacoinNetwork;
    }

    protected abstract baseDerivationNode(): Promise<BIP32Interface>;
    protected abstract buildTransaction(
        targets: OutputTarget[],
        feePerByte?: number,
        fixedInputs?: Input[]
    ): Promise<{ hex: string; fee: number }>;
    protected abstract buildSweepTransaction(externalChangeAddress: string, feePerByte?: number): Promise<{ hex: string; fee: number }>;
    public abstract signPSBT(data: string, inputs: PsbtInputTarget[]): Promise<string>;
    public abstract signTx(transaction: string, hash: string, derivationPath: string, txfee: number): Promise<string>
    public abstract signBatchP2SHTransaction(
        inputs: P2SHInput[],
        addresses: string,
        tx: any,
        lockTime?: number,
        segwit?: boolean
    ): Promise<Buffer[]>;

    public getDerivationCache() {
        return this._derivationCache;
    }

    public async getUnusedAddress(change = false, numAddressPerCall = NUMBER_ADDRESS_PER_CALL) {
        const addressType = change ? AddressSearchType.CHANGE : AddressSearchType.EXTERNAL;
        const key = change ? 'change' : 'external';
        return this._getUsedUnusedAddresses(numAddressPerCall, addressType).then(({ unusedAddress }) => unusedAddress[key]);
    }

    public async getUsedAddresses(numAddressPerCall = NUMBER_ADDRESS_PER_CALL) {
        return this._getUsedUnusedAddresses(numAddressPerCall, AddressSearchType.EXTERNAL_OR_CHANGE).then(
            ({ usedAddresses }) => usedAddresses
        );
    }

    public async getAddresses(startingIndex = 0, numAddresses = 1, change = false) {
        if (numAddresses < 1) {
            throw new Error('You must return at least one address');
        }

        const addresses = [];
        const lastIndex = startingIndex + numAddresses;
        const changeVal = change ? '1' : '0';

        for (let currentIndex = startingIndex; currentIndex < lastIndex; currentIndex++) {
            const subPath = changeVal + '/' + currentIndex;
            const path = this._baseDerivationPath + '/' + subPath;
            const addressObject = await this.getDerivationPathAddress(path);
            addresses.push(addressObject);

            await asyncSetImmediate();
        }

        return addresses;
    }

    public async createToken(options: CreateTokenTransaction): Promise<Transaction> {
        console.log('TACA ===> [chainify] createToken, options = ', options)
        return this._sendTransaction(this.tokenInfoToOutputs(options), options.fee as number);
    }

    public async sendTransaction(options: TransactionRequest) {
        return this._sendTransaction(this.sendOptionsToOutputs([options]), options.fee as number);
    }

    public async sendBatchTransaction(transactions: TransactionRequest[]) {
        return [await this._sendTransaction(this.sendOptionsToOutputs(transactions))];
    }

    public async sendSweepTransaction(externalChangeAddress: AddressType, _asset: Asset, feePerByte: number) {
        const { hex, fee } = await this.buildSweepTransaction(externalChangeAddress.toString(), feePerByte);
        await this.chainProvider.sendRawTransaction(`data=${hex}`);
        return normalizeTransactionObject(decodeRawTransaction(hex, this._network), fee);
    }

    public async updateTransactionFee(tx: Transaction<YaTransaction> | string, newFeePerByte: number) {
        const txHash = typeof tx === 'string' ? tx : tx.hash;
        const transaction: YaTransaction = (await this.chainProvider.getTransactionByHash(txHash))._raw;
        const fixedInputs = [transaction.vin[0]]; // TODO: should this pick more than 1 input? RBF doesn't mandate it

        const lookupAddresses = transaction.vout.map((vout) => vout.scriptPubKey.addresses[0]);
        const changeAddress = await this.findAddress(lookupAddresses, true);
        const changeOutput = transaction.vout.find((vout) => vout.scriptPubKey.addresses[0] === changeAddress.address);

        let outputs = transaction.vout;
        if (changeOutput) {
            outputs = outputs.filter((vout) => vout.scriptPubKey.addresses[0] !== changeOutput.scriptPubKey.addresses[0]);
        }

        // TODO more checks?
        const transactions = outputs.map((output) => ({
            address: output.scriptPubKey.addresses[0],
            value: new BigNumber(output.value).times(1e6).toNumber(),
        }));
        const { hex, fee } = await this.buildTransaction(transactions, newFeePerByte, fixedInputs);
        await this.chainProvider.sendRawTransaction(`data=${hex}`);
        return normalizeTransactionObject(decodeRawTransaction(hex, this._network), fee);
    }

    public async getTotalFees(transactions: TransactionRequest[], max: boolean) {
        const fees = await this.withCachedUtxos(async () => {
            const fees: { [index: number]: BigNumber } = {};
            for (const tx of transactions) {
                const fee = await this.getTotalFee(tx, max);
                fees[tx.fee as number] = new BigNumber(fee);
            }
            return fees;
        });
        return fees;
    }

    protected async _sendTransaction(transactions: OutputTarget[], feePerByte?: number) {
        const { hex, fee } = await this.buildTransaction(transactions, feePerByte);
        const result = await this.chainProvider.sendRawTransaction(`data=${hex}`);
        if (result == 'There was an error. Check your console.')
        {
          throw new Error(
            "Cannot send transaction, there might some reasons:\n 1) It might be the fee is not enough, please try increasing the fee.\n 2) The wallet haven't updated latest balance info, please wait 10 seconds and try again."
          )
        }
        return normalizeTransactionObject(decodeRawTransaction(hex, this._network), fee)
    }

    protected async findAddress(addresses: string[], change = false) {
        // A maximum number of addresses to lookup after which it is deemed that the wallet does not contain this address
        const maxAddresses = NUMBER_ADDRESS_LIMIT;
        const addressesPerCall = 50;
        let index = 0;
        while (index < maxAddresses) {
            const walletAddresses = await this.getAddresses(index, addressesPerCall, change);
            const walletAddress = walletAddresses.find((walletAddr) => addresses.find((addr) => walletAddr.toString() === addr.toString()));
            if (walletAddress) {
                return walletAddress;
            }
            index += addressesPerCall;
        }
    }

    public async getWalletAddress(address: string) {
        const externalAddress = await this.findAddress([address], false);
        if (externalAddress) {
            return externalAddress;
        }

        const changeAddress = await this.findAddress([address], true);
        if (changeAddress) {
            return changeAddress;
        }

        throw new Error('Wallet does not contain address');
    }

    protected async getDerivationPathAddress(path: string) {
        if (path in this._derivationCache) {
            return this._derivationCache[path];
        }

        const baseDerivationNode = await this.baseDerivationNode();
        const subPath = path.replace(this._baseDerivationPath + '/', '');
        const publicKey = baseDerivationNode.derivePath(subPath).publicKey;
        const address = this.getAddressFromPublicKey(publicKey);
        const addressObject = new Address({
            address,
            publicKey: publicKey.toString('hex'),
            derivationPath: path,
        });

        this._derivationCache[path] = addressObject;
        return addressObject;
    }

    protected async _getUsedUnusedAddresses(numAddressPerCall = NUMBER_ADDRESS_PER_CALL, addressType: AddressSearchType) {
        const usedAddresses = []
        const addressCountMap = { change: 0, external: 0 }
        const numAddressAlreadyGet = { change: 0, external: 0 }
        const unusedAddressMap: { change: Address; external: Address } = { change: null, external: null }
  
        let addrList: Address[]
        let uniqueAddresses: string[] = []
        let addressIndex = 0
        let changeAddresses: Address[] = []
        let externalAddresses: Address[] = []
  
        /* eslint-disable no-unmodified-loop-condition */
        while (
          (addressType === AddressSearchType.EXTERNAL_OR_CHANGE &&
            ((addressCountMap.change < ADDRESS_GAP && numAddressAlreadyGet['change'] < NUMBER_ADDRESS_LIMIT) ||
              (addressCountMap.external < ADDRESS_GAP && numAddressAlreadyGet['external'] < NUMBER_ADDRESS_LIMIT)) ||
          (addressType === AddressSearchType.EXTERNAL &&
            addressCountMap.external < ADDRESS_GAP && numAddressAlreadyGet['external'] < NUMBER_ADDRESS_LIMIT) ||
          (addressType === AddressSearchType.CHANGE &&
            addressCountMap.change < ADDRESS_GAP && numAddressAlreadyGet['change'] < NUMBER_ADDRESS_LIMIT))
        ) {
          /* eslint-enable no-unmodified-loop-condition */
          addrList = []
  
          if (
            (addressType === AddressSearchType.EXTERNAL_OR_CHANGE || addressType === AddressSearchType.CHANGE) &&
            addressCountMap.change < ADDRESS_GAP && numAddressAlreadyGet['change'] < NUMBER_ADDRESS_LIMIT
          ) {
            // Scanning for change addr
            changeAddresses = await this.getAddresses(addressIndex, numAddressPerCall, true)
            addrList = addrList.concat(changeAddresses)
            numAddressAlreadyGet['change'] += numAddressPerCall
          } else {
            changeAddresses = []
          }
  
          if (
            (addressType === AddressSearchType.EXTERNAL_OR_CHANGE || addressType === AddressSearchType.EXTERNAL) &&
            addressCountMap.external < ADDRESS_GAP && numAddressAlreadyGet['external'] < NUMBER_ADDRESS_LIMIT
          ) {
            // Scanning for non change addr
            externalAddresses = await this.getAddresses(addressIndex, numAddressPerCall, false)
            addrList = addrList.concat(externalAddresses)
            numAddressAlreadyGet['external'] += numAddressPerCall
          }
  
          const transactionCounts: AddressTxCounts = await this.chainProvider.getProvider().getAddressTransactionCounts(addrList);
  
          for (const address of addrList) {
              // Remove duplicate addresses
              if (!uniqueAddresses.includes(address.address)) {
                uniqueAddresses.push(address.address);
              } else {
                continue
              }
  
            const isUsed = transactionCounts[address.toString()] > 0;
            const isChangeAddress = changeAddresses.find((a) => address.toString() === a.toString());
            const key = isChangeAddress ? 'change' : 'external'
  
            if (isUsed) {
              usedAddresses.push(address)
              addressCountMap[key] = 0
              unusedAddressMap[key] = null
            } else {
              addressCountMap[key]++
  
              if (!unusedAddressMap[key]) {
                unusedAddressMap[key] = address
              }
            }
          }
  
          addressIndex += numAddressPerCall
        }
  
        if (!unusedAddressMap['change']) {
          unusedAddressMap['change'] = changeAddresses[0]
        }
  
        if (!unusedAddressMap['external']) {
          unusedAddressMap['external'] = externalAddresses[0]
        }
  
        return {
          usedAddresses,
          unusedAddress: unusedAddressMap
        }
      }

    protected async withCachedUtxos(func: () => any) {
        const originalProvider = this.chainProvider.getProvider();
        const memoizedGetFeePerByte = memoize(originalProvider.getFeePerByte, { primitive: true });
        const memoizedGetUnspentTransactions = memoize(originalProvider.getUnspentTransactions, { primitive: true });
        const memoizedGetAddressTransactionCounts = memoize(originalProvider.getAddressTransactionCounts, { primitive: true });

        const newProvider = originalProvider;
        newProvider.getFeePerByte = memoizedGetFeePerByte;
        newProvider.getUnspentTransactions = memoizedGetUnspentTransactions;
        newProvider.getAddressTransactionCounts = memoizedGetAddressTransactionCounts;

        this.chainProvider.setProvider(newProvider);
        const result = await func.bind(this)();
        this.chainProvider.setProvider(originalProvider);

        return result;
    }

    protected async getTotalFee(opts: TransactionRequest, max: boolean) {
        const targets = this.sendOptionsToOutputs([opts]);
        if (!max) {
            // const { fee } = await this.getInputsForAmount(targets, opts.fee as number);
            const { fee } = await this.getInputsForAmount(targets, opts.fee as number);
            return fee;
        } else {
            const { fee } = await this.getInputsForAmount(
                targets.filter((t) => !t.value),
                opts.fee as number,
                [],
                true
            );
            return fee;
        }
    }

    protected async getInputsForAmount(
        _targets: OutputTarget[],
        feePerByte?: number,
        fixedInputs: Input[] = [],
        sweep = false
    ) {
        const tokenTransferOutput = _targets.find((target) => target.tokenName !== undefined && target.tokenScriptType === TokenScriptType.transfer);
        const feePerBytePromise = this.chainProvider.getProvider().getFeePerByte();
        let utxos: UTXO[] = [];
        let tokenUtxos: UTXO[] = [];

        const addresses: Address[] = await this.getUsedAddresses();
        const fixedUtxos: UTXO[] = [];

        if (fixedInputs.length > 0) {
            for (const input of fixedInputs) {
                const txHex = await this.chainProvider.getProvider().getRawTransactionByHash(input.txid);
                const tx = decodeRawTransaction(txHex, this._network);
                const value = new BigNumber(tx.vout[input.vout].value).times(1e6).toNumber();
                const address = tx.vout[input.vout].scriptPubKey.addresses[0];
                const walletAddress = await this.getWalletAddress(address);
                const utxo = { ...input, value, address, derivationPath: walletAddress.derivationPath };
                fixedUtxos.push(utxo);
            }
        }

        if (!sweep || fixedUtxos.length === 0) {
            const _utxos: UTXO[] = await this.chainProvider.getProvider().getUnspentTransactions(addresses);
            utxos.push(
                ..._utxos.map((utxo) => {
                    const addr = addresses.find((a) => a.address === utxo.address);
                    return {
                        ...utxo,
                        derivationPath: addr.derivationPath,
                    };
                })
            );
        } else {
            utxos = fixedUtxos;
        }

        if (tokenTransferOutput) {
            const isNFTOutput = tokenTransferOutput.tokenName.indexOf('#') !== -1
            const _utxos: UTXO[] = isNFTOutput ? await this.chainProvider.getProvider().getNFTUnspentTransactions(addresses, tokenTransferOutput.tokenName)
                                                 : await this.chainProvider.getProvider().getTokenUnspentTransactions(addresses, tokenTransferOutput.tokenName);
            tokenUtxos.push(
                ..._utxos.map((utxo) => {
                    const addr = addresses.find((a) => a.address === utxo.address);
                    return {
                        ...utxo,
                        derivationPath: addr.derivationPath,
                    };
                })
            );
        }

        const utxoBalance = utxos.reduce((a, b) => a + (b.value || 0), 0);

        if (!feePerByte) feePerByte = await feePerBytePromise;
        const minRelayFee = await this.chainProvider.getProvider().getMinRelayFee();
        if (feePerByte < minRelayFee) {
            throw new Error(`Fee supplied (${feePerByte} sat/b) too low. Minimum relay fee is ${minRelayFee} sat/b`);
        }

        let targets: CoinSelectTarget[];
        if (sweep) {
            const outputBalance = _targets.reduce((a, b) => a + (b['value'] || 0), 0);

            const sweepOutputSize = 39;
            const paymentOutputSize = _targets.filter((t) => t.value && t.address).length * 39;
            const scriptOutputSize = _targets
                .filter((t) => !t.value && t.script)
                .reduce((size, t) => size + 39 + t.script.byteLength, 0);

            const outputSize = sweepOutputSize + paymentOutputSize + scriptOutputSize;
            const inputSize = utxos.length * 153;

            const sweepFee = feePerByte * (inputSize + outputSize);
            const amountToSend = new BigNumber(utxoBalance).minus(sweepFee);

            targets = _targets.map((target) => ({ id: 'main', value: target.value, script: target.script, tokenName: target.tokenName, token_value: target.token_value, tokenScriptType: target.tokenScriptType }));
            targets.push({ id: 'main', value: amountToSend.minus(outputBalance).toNumber() });
        } else {
            targets = _targets.map((target) => ({ id: 'main', value: target.value, script: target.script, tokenName: target.tokenName, token_value: target.token_value, tokenScriptType: target.tokenScriptType}));
        }

        console.log('TACA ===> [chainify] getInputsForAmount, utxos = ', utxos, ', tokenUtxos = ', tokenUtxos, ', targets = ', targets, ', feePerByte = ', feePerByte)

        const { inputs, outputs, fee, coinChange, tokenChange } = selectCoins(utxos, tokenUtxos, targets, Math.ceil(feePerByte), fixedUtxos);

        console.log('TACA ===> [chainify] getInputsForAmount, inputs = ', inputs, ', outputs = ', outputs, ', fee = ', fee, ', coinChange = ', coinChange, ', tokenChange = ', tokenChange)

        if (inputs && outputs) {
            return {
                inputs,
                coinChange,
                tokenChange,
                outputs,
                fee,
            };
        }

        throw new InsufficientBalanceError('Not enough balance');
    }

    protected compileTokenTransferTarget(address: string, tokenName: string, tokenValue: number): OutputTarget {
        /*
            OP_DUP OP_HASH160 <hash_of_public_key> OP_EQUALVERIFY OP_CHECKSIG < OP_YAC_TOKEN << YACT << token_name << token_amount << OP_DROP

            OP_DUP = 0x76
            OP_HASH160 = 0xa9
            1 bytes for length of hash public key
            20 bytes hash of public key
            OP_EQUALVERIFY = 0x88
            OP_CHECKSIG = 0xac
            OP_YAC_TOKEN = 0xb3
            1 byte for length of asset script excluding OP_DROP
            #define YAC_Y 121 (0x79)
            #define YAC_A 97 (0x61)
            #define YAC_C 99 (0x63)
            #define YAC_T 116 (0x74)
            1 byte for length of token name
            token name
            8 bytes of token amount (little endian)
            OP_DROP = 0x75
        */
        const recipientPubKeyHash = getPubKeyHash(address, this._network);

        const yactBuffer = Buffer.alloc(4)
        yactBuffer.writeUInt32BE(0x79616374, 0)

        const tokenNameBuf = Buffer.from(tokenName, "utf-8");

        const tokenNameLenBuf = Buffer.alloc(1);
        tokenNameLenBuf.writeUInt8(tokenNameBuf.length, 0);

        const tokenAmountBuf = bigint_to_Buffer(BigInt(tokenValue))

        const tokenTransferScriptBuf = Buffer.concat([yactBuffer, tokenNameLenBuf, tokenNameBuf, tokenAmountBuf]);

        const scriptBuffer = script.compile([
            script.OPS.OP_DUP,
            script.OPS.OP_HASH160,
            recipientPubKeyHash,
            script.OPS.OP_EQUALVERIFY,
            script.OPS.OP_CHECKSIG,
            script.OPS.OP_NOP4,
            tokenTransferScriptBuf,
            script.OPS.OP_DROP
        ]);
        return {
            value: 0,
            token_value: tokenValue,
            script: scriptBuffer,
            tokenName,
            tokenScriptType: TokenScriptType.transfer
        }
    }

    protected compileNewTokenTarget(address: string, tokenName: string, tokenAmount: number, decimals: number, reissuable: Boolean, ipfsHash: string): OutputTarget {
        /*
            OP_DUP OP_HASH160 <hash_of_public_key> OP_EQUALVERIFY OP_CHECKSIG < OP_YAC_TOKEN << YACQ << token_name << token_amount << units << reissuable << IPFS_Hash << OP_DROP

            OP_DUP = 0x76
            OP_HASH160 = 0xa9
            1 bytes for length of hash public key
            20 bytes hash of public key
            OP_EQUALVERIFY = 0x88
            OP_CHECKSIG = 0xac
            OP_YAC_TOKEN = 0xb3
            1 byte for length of asset script excluding OP_DROP
            #define YAC_Y 121 (0x79)
            #define YAC_A 97 (0x61)
            #define YAC_C 99 (0x63)
            #define YAC_Q 113 (0x71)
            1 byte for length of token name
            token name
            8 bytes of token amount (little endian)
            1 byte of units
            1 byte of reissuable
            1 byte of hasIPFS
            34 bytes of IPFS hash (CID v1)
            OP_DROP = 0x75
        */
        const recipientPubKeyHash = getPubKeyHash(address, this._network);

        const yacqBuffer = Buffer.alloc(4)
        yacqBuffer.writeUInt32BE(0x79616371, 0)

        const tokenNameBuf = Buffer.from(tokenName, "utf-8");

        const tokenNameLenBuf = Buffer.alloc(1);
        tokenNameLenBuf.writeUInt8(tokenNameBuf.length, 0);

        const tokenAmountBuf = bigint_to_Buffer(BigInt(tokenAmount))

        let newTokenScriptArr: Buffer[] = [yacqBuffer, tokenNameLenBuf, tokenNameBuf, tokenAmountBuf];

        const unitReissuableHasIPFSBuf = Buffer.alloc(3);
        unitReissuableHasIPFSBuf.writeUInt8(decimals, 0);
        unitReissuableHasIPFSBuf.writeUInt8(Number(reissuable), 1);

        if (ipfsHash) {
            unitReissuableHasIPFSBuf.writeUInt8(1, 2);
            const ipfsHashBuf = Buffer.from(ipfsHash, 'hex');
            newTokenScriptArr.push(unitReissuableHasIPFSBuf)
            newTokenScriptArr.push(ipfsHashBuf)
        } else {
            unitReissuableHasIPFSBuf.writeUInt8(0, 2);
            newTokenScriptArr.push(unitReissuableHasIPFSBuf)
        }

        const newTokenScriptBuf = Buffer.concat(newTokenScriptArr);

        const scriptBuffer = script.compile([
            script.OPS.OP_DUP,
            script.OPS.OP_HASH160,
            recipientPubKeyHash,
            script.OPS.OP_EQUALVERIFY,
            script.OPS.OP_CHECKSIG,
            script.OPS.OP_NOP4,
            newTokenScriptBuf,
            script.OPS.OP_DROP
        ]);
        return {
            value: 0,
            token_value: tokenAmount,
            script: scriptBuffer,
            tokenName,
            tokenScriptType: TokenScriptType.newToken
        }
    }

    protected compileTokenOwnerTarget(address: string, ownerTokenName: string): OutputTarget {
        /*
            OP_DUP OP_HASH160 <hash_of_public_key> OP_EQUALVERIFY OP_CHECKSIG < OP_YAC_TOKEN << YACO << token_owner_name << OP_DROP

            OP_DUP = 0x76
            OP_HASH160 = 0xa9
            1 bytes for length of hash public key
            20 bytes hash of public key
            OP_EQUALVERIFY = 0x88
            OP_CHECKSIG = 0xac
            OP_YAC_TOKEN = 0xb3
            1 byte for length of asset script excluding OP_DROP
            #define YAC_Y 121 (0x79)
            #define YAC_A 97 (0x61)
            #define YAC_C 99 (0x63)
            #define YAC_O 111 (0x6F)
            1 byte for length of token owner name
            token owner name
            OP_DROP = 0x75
        */
        const recipientPubKeyHash = getPubKeyHash(address, this._network);

        const yacoBuffer = Buffer.alloc(4)
        yacoBuffer.writeUInt32BE(0x7961636F, 0)

        const tokenNameBuf = Buffer.from(ownerTokenName, "utf-8");

        const tokenNameLenBuf = Buffer.alloc(1);
        tokenNameLenBuf.writeUInt8(tokenNameBuf.length, 0);

        const tokenOwnerScriptBuf = Buffer.concat([yacoBuffer, tokenNameLenBuf, tokenNameBuf]);

        const scriptBuffer = script.compile([
            script.OPS.OP_DUP,
            script.OPS.OP_HASH160,
            recipientPubKeyHash,
            script.OPS.OP_EQUALVERIFY,
            script.OPS.OP_CHECKSIG,
            script.OPS.OP_NOP4,
            tokenOwnerScriptBuf,
            script.OPS.OP_DROP
        ]);
        return {
            value: 0,
            token_value: 1e6,
            script: scriptBuffer,
            tokenName: ownerTokenName,
            tokenScriptType: TokenScriptType.tokenOwner
        }
    }

    protected compileTimelockFeesTarget(address: string): OutputTarget {
        /*
            <locktime> OP_CHECKSEQUENCEVERIFY OP_DROP OP_DUP OP_HASH160 <hash_of_public_key> OP_EQUALVERIFY OP_CHECKSIG
        */
        const recipientPubKeyHash = getPubKeyHash(address, this._network);

        const scriptBuffer = script.compile([
            script.number.encode(timelockFeeDuration()),
            script.OPS.OP_CHECKSEQUENCEVERIFY,
            script.OPS.OP_DROP,
            script.OPS.OP_DUP,
            script.OPS.OP_HASH160,
            recipientPubKeyHash,
            script.OPS.OP_EQUALVERIFY,
            script.OPS.OP_CHECKSIG,
        ]);
        return {
            value: timelockFeeAmountInSatoshis(),
            script: scriptBuffer,
        }
    }

    protected tokenInfoToOutputs(transaction: CreateTokenTransaction): OutputTarget[] {
        const targets: OutputTarget[] = [];
        const tx = transaction

        // Workaround for displaying sub YA-token
        tx.tokenName = tx.tokenName?.split('|').join('/')

        // Create YA-Token
        if (tx.tokenType === TokenType.token) {
            const subDeliLastIndex = tx.tokenName.lastIndexOf('/')
            if (subDeliLastIndex === -1) { // YA-Token
                /*
                    YA-Token creation transaction will have
                    1) Inputs
                    + Any normal UTXO used as transaction fees + timelock fees
                    2) Outputs (at least 3 outputs) with following orders:
                    + Output containing "CSV-P2PKH Timelock script" (random position)
                    + Output containing YAC change (optional, random position)
                    + Output containing "Token Owner Script" (always the second last output)
                    + Output containing "New Token Script" (always the last output)
                */
                const ownerTokenName = tx.tokenName + '!'
                const timelockFeesTarget = this.compileTimelockFeesTarget(tx.to.toString());
                const tokenOwnerTarget = this.compileTokenOwnerTarget(tx.to.toString(), ownerTokenName);
                const newTokenTarget = this.compileNewTokenTarget(tx.to.toString(), tx.tokenName, tx.tokenAmount, tx.decimals, tx.reissuable, tx.ipfsHash);
                targets.push(timelockFeesTarget);
                targets.push(tokenOwnerTarget);
                targets.push(newTokenTarget);
            } else { // sub YA-Token
                /*
                    sub YA-Token creation transaction will have
                    1) Inputs
                    + owner token UTXO
                    + Any normal UTXO used as transaction fees + timelock fees
                    2) Outputs (at least 4 outputs) with following orders:
                    + Output containing "CSV-P2PKH Timelock script" (random position)
                    + Output containing "Transfer Token Owner Script" (random position)
                    + Output containing YAC change (optional, random position)
                    + Output containing "Token Owner Script" (always the second last output)
                    + Output containing "New Token Script" (always the last output)
                */
                const ownerTokenName = tx.tokenName.slice(0, subDeliLastIndex) + '!'
                const subOwnerTokenName = tx.tokenName + '!'
                const timelockFeesTarget = this.compileTimelockFeesTarget(tx.to.toString());
                const tokenTransferTarget = this.compileTokenTransferTarget(tx.to.toString(), ownerTokenName, 1e6)
                const tokenOwnerTarget = this.compileTokenOwnerTarget(tx.to.toString(), subOwnerTokenName);
                const newTokenTarget = this.compileNewTokenTarget(tx.to.toString(), tx.tokenName, tx.tokenAmount, tx.decimals, tx.reissuable, tx.ipfsHash);
                targets.push(timelockFeesTarget);
                targets.push(tokenTransferTarget);
                targets.push(tokenOwnerTarget);
                targets.push(newTokenTarget);
            }
        } else { // Create YA-NFT
            /*
                YA-NFT creation transaction will have
                1) Inputs
                + owner token UTXO
                + Any normal UTXO used as transaction fees + timelock fees
                2) Outputs (at least 3 outputs) with following orders:
                + Output containing "CSV-P2PKH Timelock script" (random position)
                + Output containing "Transfer Token Owner Script" (random position)
                + Output containing YAC change (optional, random position)
                + Output containing "New Token Script" (always the last output)
            */
            const ownerTokenName = tx.tokenName.split('#')[0] + '!'
            const timelockFeesTarget = this.compileTimelockFeesTarget(tx.to.toString());
            const tokenTransferTarget = this.compileTokenTransferTarget(tx.to.toString(), ownerTokenName, 1e6)
            const newTokenTarget = this.compileNewTokenTarget(tx.to.toString(), tx.tokenName, tx.tokenAmount, tx.decimals, tx.reissuable, tx.ipfsHash);
            targets.push(timelockFeesTarget);
            targets.push(tokenTransferTarget);
            targets.push(newTokenTarget);
        }

        console.log('TACA ===> [chainify] tokenInfoToOutputs, targets = ', targets)

        return targets;
    }

    protected sendOptionsToOutputs(transactions: TransactionRequest[]): OutputTarget[] {
        const targets: OutputTarget[] = [];

        transactions.forEach((tx) => {
            if (tx.to && tx.value && tx.value.gt(0)) {
                // token/NFT output
                if (tx.asset?.type !== 'native') {
                    const tokenTransferTarget = this.compileTokenTransferTarget(tx.to.toString(), tx.asset.name.split('|').join('/'), tx.value.toNumber())
                    targets.push(tokenTransferTarget);
                    return
                } else { // coin output
                    targets.push({
                        address: tx.to.toString(),
                        value: tx.value.toNumber(),
                    });
                }
            }

            if (tx.data) {
                const scriptBuffer = script.compile([script.OPS.OP_RETURN, Buffer.from(tx.data, 'hex')]);
                targets.push({
                    value: 0,
                    script: scriptBuffer,
                });
            }
        });

        return targets;
    }

    protected getAddressFromPublicKey(publicKey: Buffer) {
        return this.getPaymentVariantFromPublicKey(publicKey).address;
    }

    protected getPaymentVariantFromPublicKey(publicKey: Buffer) {
        if (this._addressType === YaAddressType.LEGACY) {
            return payments.p2pkh({ pubkey: publicKey, network: this._network })
        } else throw new Error('Unknown script type')
    }
}
