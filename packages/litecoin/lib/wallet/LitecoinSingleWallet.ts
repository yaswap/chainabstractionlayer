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
} from '@yaswap/types';
import { ECPair, ECPairInterface, Psbt, script, payments, Transaction as LitecoinJsTransaction } from 'bitcoinjs-lib';
import { signAsync as signLitecoinMessage } from 'bitcoinjs-message';
import { LitecoinBaseChainProvider } from '../chain/LitecoinBaseChainProvider';
import {
  AddressType as LtcAddressType,
  LitecoinNetwork,
  PsbtInputTarget,
  Transaction as LtcTransaction,
  OutputTarget,
  Input,
  UTXO,
  LitecoinSingleWalletOptions,
} from '../types';
import { CoinSelectTarget, decodeRawTransaction, normalizeTransactionObject, selectCoins } from '../utils';
import { ILitecoinWallet } from './ILitecoinWallet';
import memoize from 'memoizee';

export class LitecoinSingleWallet extends Wallet<any, any> implements ILitecoinWallet<LitecoinBaseChainProvider> {
  private _addressType: LtcAddressType;
  private _network: LitecoinNetwork;
  private _ecpair: ECPairInterface;

  constructor(options: LitecoinSingleWalletOptions, chainProvider?: Chain<LitecoinBaseChainProvider>) {
    super(chainProvider);

    this._addressType = options?.addressType || LtcAddressType.BECH32;
    this._network = chainProvider ? (chainProvider.getNetwork() as LitecoinNetwork) : options.network;
    if (options.ecpair) {
      this._ecpair = { ...options.ecpair };
    } else if (options.wif) {
      this._ecpair = ECPair.fromWIF(options.wif, this._network);
    } else if (options.publicKey) {
      this._ecpair = ECPair.fromPublicKey(options.publicKey, { network: this._network });
    }
  }

  public setNetwork(litecoinNetwork: LitecoinNetwork) {
    this._network = litecoinNetwork;
  }

  public setECPair(ecpair: ECPairInterface) {
    this._ecpair = { ...ecpair };
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

  public async createToken(txRequest: CreateTokenTransaction): Promise<null> {
    return null;
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

    const changeAddress = await this.getWalletAddress();
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
    const signature = await signLitecoinMessage(message, this._ecpair.privateKey, this._ecpair.compressed);
    return signature.toString('hex');
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
          LitecoinJsTransaction.SIGHASH_ALL
        ); // AMOUNT NEEDS TO BE PREVOUT AMOUNT
      } else {
        sigHash = tx.hashForSignature(inputs[i].index, inputs[i].outputScript, LitecoinJsTransaction.SIGHASH_ALL);
      }

      const sig = script.signature.encode(wallets[i].sign(sigHash), LitecoinJsTransaction.SIGHASH_ALL);
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

    if (fixedInputs.length > 0) {
      for (const input of fixedInputs) {
        const txHex = await this.chainProvider.getProvider().getRawTransactionByHash(input.txid);
        const tx = decodeRawTransaction(txHex, this._network);
        const value = new BigNumber(tx.vout[input.vout].value).times(1e8).toNumber();
        const address = tx.vout[input.vout].scriptPubKey.addresses[0];
        const utxo = { ...input, value, address };
        fixedUtxos.push(utxo);
      }
    }

    if (!sweep || fixedUtxos.length === 0) {
      const _utxos: UTXO[] = await this.chainProvider.getProvider().getUnspentTransactions(addresses);
      utxos.push(
        ..._utxos.map((utxo) => {
          return {
            ...utxo,
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

      const sweepOutputSize = 39;
      const paymentOutputSize = _targets.filter((t) => t.value && t.address).length * 39;
      const scriptOutputSize = _targets
        .filter((t) => !t.value && t.script)
        .reduce((size, t) => size + 39 + t.script.byteLength, 0);

      const outputSize = sweepOutputSize + paymentOutputSize + scriptOutputSize;
      const inputSize = utxos.length * 153;

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

  protected onChainProviderUpdate(chainProvider: Chain<LitecoinBaseChainProvider>): void {
    this._network = chainProvider.getNetwork() as LitecoinNetwork;
  }

  private async dumpPrivKey(address: string): Promise<string> {
    return this.chainProvider.sendRpcRequest('dumpprivkey', [address]);
  }

  protected async _sendTransaction(transactions: OutputTarget[], feePerByte?: number) {
    const { hex, fee } = await this.buildTransaction(transactions, feePerByte);
    await this.chainProvider.sendRawTransaction(hex);
    return normalizeTransactionObject(decodeRawTransaction(hex, this._network), fee);
  }

  protected async buildTransaction(targets: OutputTarget[], feePerByte?: number, fixedInputs?: Input[]) {
    const network = this._network;

    const unusedAddress = await this.getWalletAddress();
    const { inputs, change, fee } = await this.getInputsForAmount(targets, feePerByte, fixedInputs);

    if (change) {
      targets.push({
        address: unusedAddress.address,
        value: change.value,
      });
    }

    const psbt = new Psbt({ network });

    const needsWitness = [LtcAddressType.BECH32, LtcAddressType.P2SH_SEGWIT].includes(this._addressType);

    for (let i = 0; i < inputs.length; i++) {
      const paymentVariant = this.getPaymentVariantFromPublicKey(this._ecpair.publicKey);

      const psbtInput: any = {
        hash: inputs[i].txid,
        index: inputs[i].vout,
        sequence: 0,
      };

      if (needsWitness) {
        psbtInput.witnessUtxo = {
          script: paymentVariant.output,
          value: inputs[i].value,
        };
      } else {
        const inputTxRaw = await this.chainProvider.getProvider().getRawTransactionByHash(inputs[i].txid);
        psbtInput.nonWitnessUtxo = Buffer.from(inputTxRaw, 'hex');
      }

      if (this._addressType === LtcAddressType.P2SH_SEGWIT) {
        psbtInput.redeemScript = paymentVariant.redeem.output;
      }

      psbt.addInput(psbtInput);
    }

    for (const output of targets) {
      if (output.script) {
        psbt.addOutput({
          value: output.value,
          script: output.script,
        });
      } else {
        psbt.addOutput({
          value: output.value,
          address: output.address,
        });
      }
    }

    for (let i = 0; i < inputs.length; i++) {
      psbt.signInput(i, this._ecpair);
      psbt.validateSignaturesOfInput(i);
    }

    psbt.finalizeAllInputs();

    return { hex: psbt.extractTransaction().toHex(), fee };
  }

  protected async buildSweepTransaction(externalChangeAddress: string, feePerByte: number) {
    let _feePerByte = feePerByte || null; // TODO: fix me
    if (!_feePerByte) {
      _feePerByte = await this.chainProvider.getProvider().getFeePerByte();
    }

    const { inputs, outputs, change } = await this.getInputsForAmount([], _feePerByte, [], true);

    if (change) {
      throw new Error('There should not be any change for sweeping transaction');
    }

    const _outputs = [{ address: externalChangeAddress, value: outputs[0].value }];

    // TODO: fix the inherited legacy code
    return this.buildTransaction(_outputs, feePerByte, inputs as unknown as Input[]);
  }
}
