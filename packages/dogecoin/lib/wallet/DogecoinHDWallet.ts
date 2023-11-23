import { Chain } from '@yaswap/client';
import { AddressType, Asset, BigNumber } from '@yaswap/types';
import { BIP32Interface, fromSeed } from 'bip32';
import { mnemonicToSeed } from 'bip39';
import { ECPair, ECPairInterface, Psbt, script, TransactionBuilder, Transaction as DogecoinJsTransaction } from 'bitcoinjs-lib';
import { signAsync as signDogecoinMessage } from 'bitcoinjs-message';
import { DogecoinBaseChainProvider } from '../chain/DogecoinBaseChainProvider';
import { AddressType as DogecoinAddressType, DogecoinHDWalletProviderOptions, Input, OutputTarget, PsbtInputTarget } from '../types';
import { DogecoinBaseWalletProvider } from './DogecoinBaseWallet';
import { IDogecoinWallet } from './IDogecoinWallet';

export class DogecoinHDWalletProvider extends DogecoinBaseWalletProvider implements IDogecoinWallet<DogecoinBaseChainProvider> {
    private _mnemonic: string;
    private _seedNode: BIP32Interface;
    private _baseDerivationNode: BIP32Interface;

    constructor(options: DogecoinHDWalletProviderOptions, chainProvider?: Chain<DogecoinBaseChainProvider>) {
        const { mnemonic, baseDerivationPath, addressType = DogecoinAddressType.LEGACY, network } = options;
        super({ baseDerivationPath, addressType, network }, chainProvider);

        if (!mnemonic) {
            throw new Error('Mnemonic should not be empty');
        }
        this._mnemonic = mnemonic;
    }

    public canUpdateFee() {
        return true;
    }

    public async getSigner(): Promise<null> {
        return null;
    }

    public async getAddress(): Promise<AddressType> {
        const addresses = await this.getAddresses();
        return addresses[0];
    }

    public async getBalance(_assets: Asset[]): Promise<BigNumber[]> {
        const addresses = await this.getAddresses();
        return await this.chainProvider.getBalance(addresses, _assets);
    }

    public async signMessage(message: string, from: string) {
        const address = await this.getWalletAddress(from);
        const keyPair = await this.keyPair(address.derivationPath);
        const signature = await signDogecoinMessage(message, keyPair.privateKey, keyPair.compressed);
        return signature.toString('hex');
    }

    public async exportPrivateKey() {
        return this._toWIF(this._baseDerivationPath);
    }

    public async getConnectedNetwork() {
        return this._network;
    }

    public async isWalletAvailable() {
        return true;
    }

    protected async baseDerivationNode() {
        if (this._baseDerivationNode) {
            return this._baseDerivationNode;
        }
        const baseNode = await this.seedNode();
        this._baseDerivationNode = baseNode.derivePath(this._baseDerivationPath);
        return this._baseDerivationNode;
    }

    protected async buildTransaction(targets: OutputTarget[], feePerByte?: number, fixedInputs?: Input[]) {
        const network = this._network

        const unusedAddress = await this.getUnusedAddress(true)
        const { inputs, change, fee } = await this.getInputsForAmount(targets, feePerByte, fixedInputs);

        if (change) {
          targets.push({
            address: unusedAddress.address,
            value: change.value,
          })
        }

        console.log("TACA ===> DogecoinHDWallet.ts, buildTransaction, targets = ", targets)

        var tx = new TransactionBuilder(network);
        // Add input
        for (let i = 0; i < inputs.length; i++) {
          tx.addInput(inputs[i].txid, inputs[i].vout)
        }

        // Add output
        for (const output of targets) {
          if (output.script) {
            tx.addOutput(output.script, output.value)
          } else {
            tx.addOutput(output.address, output.value)
          }
        }

        // Sign transaction
        for (let i = 0; i < inputs.length; i++) {
          const wallet = await this.getWalletAddress(inputs[i].address)
          const keyPair = await this.keyPair(wallet.derivationPath)
          tx.sign(i, keyPair)
        }

        return { hex: tx.build().toHex(), fee }
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

    public async signPSBT(data: string, inputs: PsbtInputTarget[]) {
        const psbt = Psbt.fromBase64(data, { network: this._network });
        for (const input of inputs) {
            const keyPair = await this.keyPair(input.derivationPath);
            psbt.signInput(input.index, keyPair);
        }
        return psbt.toBase64();
    }

    public async signTx(transaction: string, hash: string, derivationPath: string, txfee: number) {
        const keyPair = await this.keyPair(derivationPath)
        const result = keyPair.sign(Buffer.from(hash, 'hex'))
        return result.toString('hex')
    }

    public async signBatchP2SHTransaction(
        inputs: [{ inputTxHex: string; index: number; vout: any; outputScript: Buffer; txInputIndex?: number }],
        addresses: string,
        tx: any,
        lockTime?: number,
        segwit?: boolean
    ) {
        const keyPairs = [];
        for (const address of addresses) {
            const wallet = await this.getWalletAddress(address);
            const keyPair = await this.keyPair(wallet.derivationPath);
            keyPairs.push(keyPair);
        }

        const sigs = [];
        for (let i = 0; i < inputs.length; i++) {
            const index = inputs[i].txInputIndex ? inputs[i].txInputIndex : inputs[i].index;
            let sigHash;
            if (segwit) {
                sigHash = tx.hashForWitnessV0(index, inputs[i].outputScript, inputs[i].vout.vSat, DogecoinJsTransaction.SIGHASH_ALL);
            } else {
                sigHash = tx.hashForSignature(index, inputs[i].outputScript, DogecoinJsTransaction.SIGHASH_ALL);
            }

            const sig = script.signature.encode(keyPairs[i].sign(sigHash), DogecoinJsTransaction.SIGHASH_ALL);
            sigs.push(sig);
        }

        return sigs;
    }

    private async keyPair(derivationPath: string): Promise<ECPairInterface> {
        const wif = await this._toWIF(derivationPath);
        return ECPair.fromWIF(wif, this._network);
    }

    private async _toWIF(derivationPath: string): Promise<string> {
        const node = await this.seedNode();
        return node.derivePath(derivationPath).toWIF();
    }

    private async seedNode() {
        if (this._seedNode) {
            return this._seedNode;
        }

        const seed = await mnemonicToSeed(this._mnemonic);
        this._seedNode = fromSeed(seed, this._network);

        return this._seedNode;
    }
}
