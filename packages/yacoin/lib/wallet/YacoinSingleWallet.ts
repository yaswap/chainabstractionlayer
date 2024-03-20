import { Chain, Wallet } from '@yaswap/client';
import { InsufficientBalanceError } from '@yaswap/errors';
import {
  Address,
  AddressType,
  Asset,
  BigNumber,
  Network,
  Transaction,
  TransactionRequest,
  CreateTokenTransaction,
  TokenType,
  TokenScriptType,
} from '@yaswap/types';
import {
  ECPair,
  ECPairInterface,
  Psbt,
  script,
  payments,
  TransactionBuilder,
  Transaction as YacoinJsTransaction,
} from '@yaswap/yacoinjs-lib';
import { signAsync as signYacoinMessage } from 'bitcoinjs-message';
import { YacoinBaseChainProvider } from '../chain/YacoinBaseChainProvider';
import {
  AddressType as YacAddressType,
  YacoinNetwork,
  PsbtInputTarget,
  Transaction as YacTransaction,
  OutputTarget,
  Input,
  UTXO,
  YacoinSingleWalletOptions,
} from '../types';
import {
  CoinSelectTarget,
  decodeRawTransaction,
  getPubKeyHash,
  normalizeTransactionObject,
  selectCoins,
  timelockFeeAmountInSatoshis,
  timelockFeeDuration,
} from '../utils';
import { IYacoinWallet } from './IYacoinWallet';
import memoize from 'memoizee';

function bigint_to_Buffer(input: bigint) {
  const bytesArray = [];
  for (let i = 0; i < 8; i++) {
    let shift = input >> BigInt(8 * i);
    shift &= BigInt(255);
    bytesArray[i] = Number(String(shift));
  }
  return Buffer.from(bytesArray);
}
export class YacoinSingleWallet extends Wallet<any, any> implements IYacoinWallet<YacoinBaseChainProvider> {
  private _addressType: YacAddressType;
  private _network: YacoinNetwork;
  private _ecpair: ECPairInterface;

  constructor(options: YacoinSingleWalletOptions, chainProvider?: Chain<YacoinBaseChainProvider>) {
    super(chainProvider);

    this._addressType = options?.addressType || YacAddressType.LEGACY;
    this._network = chainProvider ? (chainProvider.getNetwork() as YacoinNetwork) : options.network;
    if (options.ecpair) {
      this._ecpair = ECPair.fromPrivateKey(options.ecpair.privateKey, { network: this._network });
    } else if (options.wif) {
      this._ecpair = ECPair.fromWIF(options.wif, this._network);
    } else if (options.publicKey) {
      this._ecpair = ECPair.fromPublicKey(options.publicKey, { network: this._network });
    }
  }

  public setNetwork(yacoinNetwork: YacoinNetwork) {
    this._network = yacoinNetwork;
  }

  public setECPair(ecpair: ECPairInterface) {
    this._ecpair = ECPair.fromPrivateKey(ecpair.privateKey, { network: this._network });
  }

  public setPublicKey(publicKey: Buffer) {
    this._ecpair = ECPair.fromPublicKey(publicKey, { network: this._network });
  }

  public setWIF(wif: string) {
    this._ecpair = ECPair.fromWIF(wif, this._network);
  }

  public async getUnusedAddress() {
    const address = this.getAddressFromPublicKey(this._ecpair.publicKey);
    const addressObject = new Address({
      address,
      publicKey: this._ecpair.publicKey.toString('hex'),
    });
    return addressObject;
  }

  public async getUsedAddresses() {
    const address = await this.getUnusedAddress();
    return [address];
  }

  public async getAddresses() {
    return this.getUsedAddresses();
  }

  public async createToken(options: CreateTokenTransaction): Promise<Transaction> {
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

  public async updateTransactionFee(tx: Transaction<YacTransaction> | string, newFeePerByte: number) {
    const txHash = typeof tx === 'string' ? tx : tx.hash;
    const transaction: YacTransaction = (await this.chainProvider.getTransactionByHash(txHash))._raw;
    const fixedInputs = [transaction.vin[0]]; // TODO: should this pick more than 1 input? RBF doesn't mandate it

    const changeAddress = await this.getWalletAddress();
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

  public async getConnectedNetwork(): Promise<Network> {
    return this._network;
  }

  public async getSigner(): Promise<null> {
    return null;
  }

  public async getAddress(): Promise<AddressType> {
    const addresses = await this.getAddresses();
    return addresses[0];
  }

  public async signMessage(message: string) {
    const signature = await signYacoinMessage(message, this._ecpair.privateKey, this._ecpair.compressed);
    return signature.toString('hex');
  }

  public async signTx(transaction: string, hash: string, derivationPath: string, txfee: number) {
    const result = this._ecpair.sign(Buffer.from(hash, 'hex'));
    return result.toString('hex');
  }

  public async getBalance(assets: Asset[]): Promise<BigNumber[]> {
    const addresses = await this.getAddresses();
    return await this.chainProvider.getBalance(addresses, assets);
  }

  public async exportPrivateKey(): Promise<string> {
    return this._ecpair.toWIF();
  }

  public async isWalletAvailable(): Promise<boolean> {
    return true;
  }

  public canUpdateFee(): boolean {
    return true;
  }

  public async signPSBT(data: string, inputs: PsbtInputTarget[]): Promise<string> {
    // TODO: This doesn't work at the moment, need to implement later
    const psbt = Psbt.fromBase64(data, { network: this._network });

    for (const input of inputs) {
      const usedAddresses = await this.getUsedAddresses();
      const address = usedAddresses.find((address) => address.derivationPath === input.derivationPath);
      const wif = await this.dumpPrivKey(address.address);
      const keyPair = ECPair.fromWIF(wif, this._network);
      psbt.signInput(input.index, keyPair);
    }

    return psbt.toBase64();
  }

  public async signBatchP2SHTransaction(
    inputs: [{ inputTxHex: string; index: number; vout: any; outputScript: Buffer }],
    addresses: string,
    tx: any,
    locktime: number,
    segwit = false
  ) {
    // TODO: This doesn't work at the moment, need to implement later
    const wallets = [];
    for (const address of addresses) {
      const wif = await this.dumpPrivKey(address);
      const wallet = ECPair.fromWIF(wif, this._network);
      wallets.push(wallet);
    }

    const sigs = [];
    for (let i = 0; i < inputs.length; i++) {
      let sigHash;
      if (segwit) {
        sigHash = tx.hashForWitnessV0(
          inputs[i].index,
          inputs[i].outputScript,
          inputs[i].vout.vSat,
          YacoinJsTransaction.SIGHASH_ALL
        ); // AMOUNT NEEDS TO BE PREVOUT AMOUNT
      } else {
        sigHash = tx.hashForSignature(inputs[i].index, inputs[i].outputScript, YacoinJsTransaction.SIGHASH_ALL);
      }

      const sig = script.signature.encode(wallets[i].sign(sigHash), YacoinJsTransaction.SIGHASH_ALL);
      sigs.push(sig);
    }

    return sigs;
  }

  public async getWalletAddress() {
    return await this.getUnusedAddress();
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

  protected getAddressFromPublicKey(publicKey: Buffer) {
    return this.getPaymentVariantFromPublicKey(publicKey).address;
  }

  protected getPaymentVariantFromPublicKey(publicKey: Buffer) {
    if (this._addressType === YacAddressType.LEGACY) {
      return payments.p2pkh({ pubkey: publicKey, network: this._network });
    } else throw new Error('Unknown script type');
  }

  protected async withCachedUtxos(func: () => any) {
    const originalProvider = this.chainProvider.getProvider();
    const memoizedGetFeePerByte = memoize(originalProvider.getFeePerByte, { primitive: true });
    const memoizedGetUnspentTransactions = memoize(originalProvider.getUnspentTransactions, { primitive: true });
    const memoizedGetAddressTransactionCounts = memoize(originalProvider.getAddressTransactionCounts, {
      primitive: true,
    });

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
    console.log("TACA ===> getTotalFee, targets = ", targets, ", max = ", max)
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

  protected sendOptionsToOutputs(transactions: TransactionRequest[]): OutputTarget[] {
    const targets: OutputTarget[] = [];

    transactions.forEach((tx) => {
      if (tx.to && tx.value && tx.value.gt(0)) {
        // token/NFT output
        if (tx.asset && tx.asset.type !== 'native') {
          const tokenTransferTarget = this.compileTokenTransferTarget(
            tx.to.toString(),
            tx.asset.name.split('|').join('/'),
            tx.value.toNumber()
          );
          targets.push(tokenTransferTarget);
          return;
        } else {
          // coin output
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

  protected tokenInfoToOutputs(transaction: CreateTokenTransaction): OutputTarget[] {
    const targets: OutputTarget[] = [];
    const tx = transaction;

    // Workaround for displaying sub YA-token
    tx.tokenName = tx.tokenName?.split('|').join('/');

    // Create YA-Token
    if (tx.tokenType === TokenType.token) {
      const subDeliLastIndex = tx.tokenName.lastIndexOf('/');
      if (subDeliLastIndex === -1) {
        // YA-Token
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
        const ownerTokenName = tx.tokenName + '!';
        const timelockFeesTarget = this.compileTimelockFeesTarget(tx.to.toString());
        const tokenOwnerTarget = this.compileTokenOwnerTarget(tx.to.toString(), ownerTokenName);
        const newTokenTarget = this.compileNewTokenTarget(
          tx.to.toString(),
          tx.tokenName,
          tx.tokenAmount,
          tx.decimals,
          tx.reissuable,
          tx.ipfsHash
        );
        targets.push(timelockFeesTarget);
        targets.push(tokenOwnerTarget);
        targets.push(newTokenTarget);
      } else {
        // sub YA-Token
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
        const ownerTokenName = tx.tokenName.slice(0, subDeliLastIndex) + '!';
        const subOwnerTokenName = tx.tokenName + '!';
        const timelockFeesTarget = this.compileTimelockFeesTarget(tx.to.toString());
        const tokenTransferTarget = this.compileTokenTransferTarget(tx.to.toString(), ownerTokenName, 1e6);
        const tokenOwnerTarget = this.compileTokenOwnerTarget(tx.to.toString(), subOwnerTokenName);
        const newTokenTarget = this.compileNewTokenTarget(
          tx.to.toString(),
          tx.tokenName,
          tx.tokenAmount,
          tx.decimals,
          tx.reissuable,
          tx.ipfsHash
        );
        targets.push(timelockFeesTarget);
        targets.push(tokenTransferTarget);
        targets.push(tokenOwnerTarget);
        targets.push(newTokenTarget);
      }
    } else {
      // Create YA-NFT
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
      const ownerTokenName = tx.tokenName.split('#')[0] + '!';
      const timelockFeesTarget = this.compileTimelockFeesTarget(tx.to.toString());
      const tokenTransferTarget = this.compileTokenTransferTarget(tx.to.toString(), ownerTokenName, 1e6);
      const newTokenTarget = this.compileNewTokenTarget(
        tx.to.toString(),
        tx.tokenName,
        tx.tokenAmount,
        tx.decimals,
        tx.reissuable,
        tx.ipfsHash
      );
      targets.push(timelockFeesTarget);
      targets.push(tokenTransferTarget);
      targets.push(newTokenTarget);
    }

    return targets;
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

    const yactBuffer = Buffer.alloc(4);
    yactBuffer.writeUInt32BE(0x79616374, 0);

    const tokenNameBuf = Buffer.from(tokenName, 'utf-8');

    const tokenNameLenBuf = Buffer.alloc(1);
    tokenNameLenBuf.writeUInt8(tokenNameBuf.length, 0);

    const tokenAmountBuf = bigint_to_Buffer(BigInt(tokenValue));

    const tokenTransferScriptBuf = Buffer.concat([yactBuffer, tokenNameLenBuf, tokenNameBuf, tokenAmountBuf]);

    const scriptBuffer = script.compile([
      script.OPS.OP_DUP,
      script.OPS.OP_HASH160,
      recipientPubKeyHash,
      script.OPS.OP_EQUALVERIFY,
      script.OPS.OP_CHECKSIG,
      script.OPS.OP_NOP4,
      tokenTransferScriptBuf,
      script.OPS.OP_DROP,
    ]);
    return {
      value: 0,
      token_value: tokenValue,
      script: scriptBuffer,
      tokenName,
      tokenScriptType: TokenScriptType.transfer,
    };
  }

  protected compileNewTokenTarget(
    address: string,
    tokenName: string,
    tokenAmount: number,
    decimals: number,
    reissuable: Boolean,
    ipfsHash: string
  ): OutputTarget {
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

    const yacqBuffer = Buffer.alloc(4);
    yacqBuffer.writeUInt32BE(0x79616371, 0);

    const tokenNameBuf = Buffer.from(tokenName, 'utf-8');

    const tokenNameLenBuf = Buffer.alloc(1);
    tokenNameLenBuf.writeUInt8(tokenNameBuf.length, 0);

    const tokenAmountBuf = bigint_to_Buffer(BigInt(tokenAmount));

    let newTokenScriptArr: Buffer[] = [yacqBuffer, tokenNameLenBuf, tokenNameBuf, tokenAmountBuf];

    const unitReissuableHasIPFSBuf = Buffer.alloc(3);
    unitReissuableHasIPFSBuf.writeUInt8(decimals, 0);
    unitReissuableHasIPFSBuf.writeUInt8(Number(reissuable), 1);

    if (ipfsHash) {
      unitReissuableHasIPFSBuf.writeUInt8(1, 2);
      const ipfsHashBuf = Buffer.from(ipfsHash, 'hex');
      newTokenScriptArr.push(unitReissuableHasIPFSBuf);
      newTokenScriptArr.push(ipfsHashBuf);
    } else {
      unitReissuableHasIPFSBuf.writeUInt8(0, 2);
      newTokenScriptArr.push(unitReissuableHasIPFSBuf);
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
      script.OPS.OP_DROP,
    ]);
    return {
      value: 0,
      token_value: tokenAmount,
      script: scriptBuffer,
      tokenName,
      tokenScriptType: TokenScriptType.newToken,
    };
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

    const yacoBuffer = Buffer.alloc(4);
    yacoBuffer.writeUInt32BE(0x7961636f, 0);

    const tokenNameBuf = Buffer.from(ownerTokenName, 'utf-8');

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
      script.OPS.OP_DROP,
    ]);
    return {
      value: 0,
      token_value: 1e6,
      script: scriptBuffer,
      tokenName: ownerTokenName,
      tokenScriptType: TokenScriptType.tokenOwner,
    };
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
    };
  }

  protected async getInputsForAmount(
    _targets: OutputTarget[],
    feePerByte?: number,
    fixedInputs: Input[] = [],
    sweep = false
  ) {
    const tokenTransferOutput = _targets.find(
      (target) => target.tokenName !== undefined && target.tokenScriptType === TokenScriptType.transfer
    );
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
        const utxo = { ...input, value, address };
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
      const isNFTOutput = tokenTransferOutput.tokenName.indexOf('#') !== -1;
      const _utxos: UTXO[] = isNFTOutput
        ? await this.chainProvider.getProvider().getNFTUnspentTransactions(addresses, tokenTransferOutput.tokenName)
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

      const sweepOutputSize = 39; // TX_OUTPUT_BASE + TX_OUTPUT_PUBKEYHASH + LOCKTIME
      const paymentOutputSize = _targets.filter((t) => t.value && t.address).length * 39;
      const scriptOutputSize = _targets
        .filter((t) => !t.value && t.script)
        .reduce((size, t) => size + 39 + t.script.byteLength, 0);

      const outputSize = sweepOutputSize + paymentOutputSize + scriptOutputSize;
      const inputSize = utxos.length * 161; // VERSION + TIME (8 bytes) + 1 + TX_INPUT_BASE + TX_INPUT_PUBKEYHASH

      const sweepFee = feePerByte * (inputSize + outputSize);
      const amountToSend = new BigNumber(utxoBalance).minus(sweepFee);

      targets = _targets.map((target) => ({
        id: 'main',
        value: target.value,
        script: target.script,
        tokenName: target.tokenName,
        token_value: target.token_value,
        tokenScriptType: target.tokenScriptType,
      }));
      targets.push({ id: 'main', value: amountToSend.minus(outputBalance).toNumber() });
    } else {
      targets = _targets.map((target) => ({
        id: 'main',
        value: target.value,
        script: target.script,
        tokenName: target.tokenName,
        token_value: target.token_value,
        tokenScriptType: target.tokenScriptType,
      }));
    }

    console.log("TACA ===> getInputsForAmount, utxos = ", utxos, ", targets = ", targets, ", feePerByte = ", feePerByte)
    const { inputs, outputs, fee, coinChange, tokenChange } = selectCoins(
      utxos,
      tokenUtxos,
      targets,
      Math.ceil(feePerByte),
      fixedUtxos
    );
    console.log("TACA ===> getInputsForAmount, inputs = ", inputs, ", outputs = ", outputs, ", fee = ", fee, ", coinChange = ", coinChange, ", tokenChange = ", tokenChange)

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

  protected onChainProviderUpdate(chainProvider: Chain<YacoinBaseChainProvider>): void {
    this._network = chainProvider.getNetwork() as YacoinNetwork;
  }

  private async dumpPrivKey(address: string): Promise<string> {
    return this.chainProvider.sendRpcRequest('dumpprivkey', [address]);
  }

  protected async _sendTransaction(transactions: OutputTarget[], feePerByte?: number) {
    const { hex, fee } = await this.buildTransaction(transactions, feePerByte);
    const result = await this.chainProvider.sendRawTransaction(`data=${hex}`);
    if (result == 'There was an error. Check your console.') {
      throw new Error(
        "Cannot send transaction, there might some reasons:\n 1) It might be the fee is not enough, please try increasing the fee.\n 2) The wallet haven't updated latest balance info, please wait 10 seconds and try again."
      );
    }
    return normalizeTransactionObject(decodeRawTransaction(hex, this._network), fee);
  }

  protected async buildTransaction(targets: OutputTarget[], feePerByte?: number, fixedInputs?: Input[]) {
    const network = this._network;

    const unusedAddress = await this.getUnusedAddress();
    const { inputs, coinChange, tokenChange, fee } = await this.getInputsForAmount(targets, feePerByte, fixedInputs);

    if (coinChange) {
      targets.unshift({
        address: unusedAddress.address,
        value: coinChange.value,
      });
    }

    if (tokenChange) {
      const tokenTransferTarget = this.compileTokenTransferTarget(
        unusedAddress.address,
        tokenChange.tokenName,
        tokenChange.token_value
      );
      targets.unshift(tokenTransferTarget);
    }

    var tx = new TransactionBuilder(network);
    // Add input
    for (let i = 0; i < inputs.length; i++) {
      tx.addInput(inputs[i].txid, inputs[i].vout);
    }

    // Add output
    for (const output of targets) {
      if (output.script) {
        tx.addOutput(output.script, output.value);
      } else {
        tx.addOutput(output.address, output.value);
      }
    }

    // Sign transaction
    for (let i = 0; i < inputs.length; i++) {
      tx.sign(i, this._ecpair, inputs[i]);
    }

    return { hex: tx.build().toHex(), fee };
  }

  protected async buildSweepTransaction(externalChangeAddress: string, feePerByte: number) {
    let _feePerByte = feePerByte || null; // TODO: fix me
    if (!_feePerByte) {
      _feePerByte = await this.chainProvider.getProvider().getFeePerByte();
    }

    const { inputs, outputs, coinChange } = await this.getInputsForAmount([], _feePerByte, [], true);

    if (coinChange) {
      throw new Error('There should not be any change for sweeping transaction');
    }

    const _outputs = [{ address: externalChangeAddress, value: outputs[0].value }];

    // TODO: fix the inherited legacy code
    return this.buildTransaction(_outputs, feePerByte, inputs as unknown as Input[]);
  }
}
