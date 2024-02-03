import { Chain, Wallet } from '@yaswap/client';
import { InsufficientBalanceError } from '@yaswap/errors';
import { Address, AddressType, Asset, BigNumber, Transaction, TransactionRequest, CreateTokenTransaction } from '@yaswap/types';
import { asyncSetImmediate } from '@yaswap/utils';
import { BIP32Interface } from 'bip32';
import { payments, script } from 'bitcoinjs-lib';
import memoize from 'memoizee';
import { LitecoinBaseChainProvider } from '../chain/LitecoinBaseChainProvider';
import {
    AddressTxCounts,
    AddressType as LtcAddressType,
    LitecoinNetwork,
    LitecoinWalletProviderOptions,
    Input,
    OutputTarget,
    P2SHInput,
    PsbtInputTarget,
    Transaction as LtcTransaction,
    UTXO,
} from '../types';
import { CoinSelectTarget, decodeRawTransaction, normalizeTransactionObject, selectCoins } from '../utils';

const ADDRESS_GAP = 1
const NUMBER_ADDRESS_PER_CALL = ADDRESS_GAP
const NUMBER_ADDRESS_LIMIT = 1

export enum AddressSearchType {
    EXTERNAL,
    CHANGE,
    EXTERNAL_OR_CHANGE,
}

type DerivationCache = { [index: string]: Address };

export abstract class LitecoinBaseWalletProvider<T extends LitecoinBaseChainProvider = any, S = any> extends Wallet<T, S> {
    protected _baseDerivationPath: string;
    protected _network: LitecoinNetwork;
    protected _addressType: LtcAddressType;
    protected _derivationCache: DerivationCache;

    constructor(options: LitecoinWalletProviderOptions, chainProvider?: Chain<T>) {
        const { baseDerivationPath, addressType = LtcAddressType.BECH32 } = options;
        const addressTypes = Object.values(LtcAddressType);
        if (!addressTypes.includes(addressType)) {
            throw new Error(`addressType must be one of ${addressTypes.join(',')}`);
        }

        super(chainProvider);

        this._baseDerivationPath = baseDerivationPath;
        this._network = chainProvider ? (chainProvider.getNetwork() as LitecoinNetwork) : options.network;
        this._addressType = addressType;
        this._derivationCache = {};
    }

    protected onChainProviderUpdate(chainProvider: Chain<T>) {
        this._network = chainProvider.getNetwork() as LitecoinNetwork;
    }

    protected abstract baseDerivationNode(): Promise<BIP32Interface>;
    protected abstract buildTransaction(
        targets: OutputTarget[],
        feePerByte?: number,
        fixedInputs?: Input[]
    ): Promise<{ hex: string; fee: number }>;
    protected abstract buildSweepTransaction(externalChangeAddress: string, feePerByte?: number): Promise<{ hex: string; fee: number }>;
    public abstract signPSBT(data: string, inputs: PsbtInputTarget[]): Promise<string>;
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

    public async createToken(txRequest: CreateTokenTransaction): Promise<null> {
        return null
    }

    public async sendTransaction(options: TransactionRequest) {
        return this._sendTransaction(this.sendOptionsToOutputs([options]), options.fee as number);
    }

    public async sendBatchTransaction(transactions: TransactionRequest[]) {
        return [await this._sendTransaction(this.sendOptionsToOutputs(transactions))];
    }

    public async sendSweepTransaction(externalChangeAddress: AddressType, _asset: Asset, feePerByte: number) {
        const { hex, fee } = await this.buildSweepTransaction(externalChangeAddress.toString(), feePerByte);
        await this.chainProvider.sendRawTransaction(hex);
        return normalizeTransactionObject(decodeRawTransaction(hex, this._network), fee);
    }

    public async updateTransactionFee(tx: Transaction<LtcTransaction> | string, newFeePerByte: number) {
        const txHash = typeof tx === 'string' ? tx : tx.hash;
        const transaction: LtcTransaction = (await this.chainProvider.getTransactionByHash(txHash))._raw;
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
            value: new BigNumber(output.value).times(1e8).toNumber(),
        }));
        const { hex, fee } = await this.buildTransaction(transactions, newFeePerByte, fixedInputs);
        await this.chainProvider.sendRawTransaction(hex);
        return normalizeTransactionObject(decodeRawTransaction(hex, this._network), fee);
    }

    public async getTotalFees(transactions: TransactionRequest[], max: boolean) {
        const fees = await this.withCachedUtxos(async () => {
            const fees: { [index: number]: BigNumber } = {};
            for (const tx of transactions) {
                try {
                    const fee = await this.getTotalFee(tx, max);
                    console.log("TACA ===> LitecoinBaseWallet.ts, getTotalFees, max = ", max, ", tx = ", tx, ", fee = ", fee)
                    fees[tx.fee as number] = new BigNumber(fee);
                } catch (err) {
                    console.log("TACA ===> LitecoinBaseWallet.ts, getTotalFees, err = ", err)
                    fees[tx.fee as number] = null;
                }
            }
            return fees;
        });
        return fees;
    }

    protected async _sendTransaction(transactions: OutputTarget[], feePerByte?: number) {
        const { hex, fee } = await this.buildTransaction(transactions, feePerByte);
        await this.chainProvider.sendRawTransaction(hex);
        return normalizeTransactionObject(decodeRawTransaction(hex, this._network), fee);
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
        const addressCountMap = { change: 0, external: 0 } // track number of unused addresses
        const unusedAddressMap: { change: Address; external: Address } = { change: null, external: null } // store first unused address
        const numAddressAlreadyGet = { change: 0, external: 0 }
  
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
            const addresses = await this.getAddresses(addressIndex, numAddressPerCall, true)
            changeAddresses = changeAddresses.concat(addresses)
            addrList = addrList.concat(addresses)
            numAddressAlreadyGet['change'] += numAddressPerCall
          }
  
          if (
            (addressType === AddressSearchType.EXTERNAL_OR_CHANGE || addressType === AddressSearchType.EXTERNAL) &&
            addressCountMap.external < ADDRESS_GAP && numAddressAlreadyGet['external'] < NUMBER_ADDRESS_LIMIT
          ) {
            // Scanning for non change addr
            const addresses = await this.getAddresses(addressIndex, numAddressPerCall, false)
            externalAddresses = externalAddresses.concat(addresses)
            addrList = addrList.concat(addresses)
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
  
        // In case it already reached NUMBER_ADDRESS_LIMIT, get the random used change address
        if (!unusedAddressMap['change']) {
          const maxRange = changeAddresses.length - 1
          unusedAddressMap['change'] = changeAddresses[Math.round(Math.random() * maxRange)]
        }
  
        // In case it already reached NUMBER_ADDRESS_LIMIT, get the random used external address
        if (!unusedAddressMap['external']) {
          const maxRange = externalAddresses.length - 1
          unusedAddressMap['external'] = externalAddresses[Math.round(Math.random() * maxRange)]
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
        const feePerBytePromise = this.chainProvider.getProvider().getFeePerByte();
        let utxos: UTXO[] = [];

        const addresses: Address[] = await this.getUsedAddresses();
        const fixedUtxos: UTXO[] = [];

        const needsWitness = [LtcAddressType.BECH32, LtcAddressType.P2SH_SEGWIT].includes(this._addressType);

        if (fixedInputs.length > 0) {
            for (const input of fixedInputs) {
                const txHex = await this.chainProvider.getProvider().getRawTransactionByHash(input.txid);
                const tx = decodeRawTransaction(txHex, this._network);
                const value = new BigNumber(tx.vout[input.vout].value).times(1e8).toNumber();
                const address = tx.vout[input.vout].scriptPubKey.addresses[0];
                const walletAddress = await this.getWalletAddress(address);
                const utxo = { ...input, value, address, derivationPath: walletAddress.derivationPath, witnessUtxo: needsWitness ? {script: new Uint8Array(0), value}: null };
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
                        witnessUtxo: needsWitness ? {script: new Uint8Array(0), value: utxo.value}: null,
                        derivationPath: addr.derivationPath,
                    };
                })
            );
        } else {
            utxos = fixedUtxos;
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

            // TODO: For segwit address, it should be 36 (TX_OUTPUT_BASE + TX_OUTPUT_SEGWIT/TX_OUTPUT_PUBKEYHASH + LOCKTIME)
            // At the moment, assume the worst case which output address is legacy address
            const sweepOutputSize = 39
            const paymentOutputSize = _targets.filter((t) => t.value && t.address).length * 39;
            const scriptOutputSize = _targets
                .filter((t) => !t.value && t.script)
                .reduce((size, t) => size + 39 + t.script.byteLength, 0);

            const outputSize = sweepOutputSize + paymentOutputSize + scriptOutputSize;
            const oneInputSize = needsWitness? 73 : 153 // VERSION + 1 + TX_INPUT_BASE + TX_INPUT_SEGWIT/TX_INPUT_PUBKEYHASH
            const inputSize = utxos.length * oneInputSize;

            const sweepFee = feePerByte * (inputSize + outputSize);
            const amountToSend = new BigNumber(utxoBalance).minus(sweepFee);

            targets = _targets.map((target) => ({ id: 'main', value: target.value, script: target.script }));
            targets.push({ id: 'main', value: amountToSend.minus(outputBalance).toNumber() });
        } else {
            targets = _targets.map((target) => ({ id: 'main', value: target.value, script: target.script }));
        }

        const { inputs, outputs, change, fee } = selectCoins(utxos, targets, Math.ceil(feePerByte), fixedUtxos);

        if (inputs && outputs) {
            return {
                inputs,
                change,
                outputs,
                fee,
            };
        }

        throw new InsufficientBalanceError('Not enough balance');
    }

    protected sendOptionsToOutputs(transactions: TransactionRequest[]): OutputTarget[] {
        const targets: OutputTarget[] = [];

        transactions.forEach((tx) => {
            if (tx.to && tx.value && tx.value.gt(0)) {
                targets.push({
                    address: tx.to.toString(),
                    value: tx.value.toNumber(),
                });
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
        if (this._addressType === LtcAddressType.LEGACY) {
            return payments.p2pkh({ pubkey: publicKey, network: this._network });
        } else if (this._addressType === LtcAddressType.P2SH_SEGWIT) {
            return payments.p2sh({
                redeem: payments.p2wpkh({ pubkey: publicKey, network: this._network }),
                network: this._network,
            });
        } else if (this._addressType === LtcAddressType.BECH32) {
            return payments.p2wpkh({ pubkey: publicKey, network: this._network });
        }
    }
}
