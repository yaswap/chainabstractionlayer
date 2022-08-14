import { YacoinWalletProvider } from '@yac-swap/yacoin-wallet-provider'
import { WalletProvider } from '@liquality/wallet-provider'
import { YacoinNetwork } from '@yac-swap/yacoin-networks'
import { yacoin } from '@liquality/types'

import { Psbt, ECPair, ECPairInterface, TransactionBuilder, Transaction as YacoinJsTransaction, script } from '@yac-swap/yacoinjs-lib'
import { signAsync as signYacoinMessage } from 'bitcoinjs-message'
import { mnemonicToSeed } from 'bip39'
import { BIP32Interface, fromSeed } from 'bip32'

type WalletProviderConstructor<T = WalletProvider> = new (...args: any[]) => T

interface YacoinJsWalletProviderOptions {
  network: YacoinNetwork
  mnemonic: string
  baseDerivationPath: string
  addressType?: yacoin.AddressType
}

export default class YacoinJsWalletProvider extends YacoinWalletProvider(
  WalletProvider as WalletProviderConstructor
) {
  _mnemonic: string
  _seedNode: BIP32Interface
  _baseDerivationNode: BIP32Interface

  constructor(options: YacoinJsWalletProviderOptions) {
    const { network, mnemonic, baseDerivationPath, addressType = yacoin.AddressType.LEGACY } = options
    super({ network, baseDerivationPath, addressType })

    if (!mnemonic) throw new Error('Mnemonic should not be empty')

    this._mnemonic = mnemonic
  }

  async seedNode() {
    if (this._seedNode) return this._seedNode

    const seed = await mnemonicToSeed(this._mnemonic)
    this._seedNode = fromSeed(seed, this._network)

    return this._seedNode
  }

  async baseDerivationNode() {
    if (this._baseDerivationNode) return this._baseDerivationNode

    const baseNode = await this.seedNode()
    this._baseDerivationNode = baseNode.derivePath(this._baseDerivationPath)

    return this._baseDerivationNode
  }

  async keyPair(derivationPath: string): Promise<ECPairInterface> {
    const wif = await this._toWIF(derivationPath)
    return ECPair.fromWIF(wif, this._network)
  }

  private async _toWIF(derivationPath: string): Promise<string> {
    const node = await this.seedNode()
    return node.derivePath(derivationPath).toWIF()
  }

  async exportPrivateKey() {
    return this._toWIF(this._baseDerivationPath)
  }

  async signMessage(message: string, from: string) {
    const address = await this.getWalletAddress(from)
    const keyPair = await this.keyPair(address.derivationPath)
    const signature = await signYacoinMessage(message, keyPair.privateKey, keyPair.compressed)
    return signature.toString('base64')
  }

  async _buildTransaction(targets: yacoin.OutputTarget[], feePerByte?: number, fixedInputs?: yacoin.Input[]) {
    const network = this._network

    const unusedAddress = await this.getUnusedAddress(true)
    const { inputs, change, fee } = await this.getInputsForAmount(targets, feePerByte, fixedInputs)

    if (change) {
      targets.push({
        address: unusedAddress.address,
        value: change.value
      })
    }

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

  async _buildSweepTransaction(externalChangeAddress: string, feePerByte: number) {
    let _feePerByte = feePerByte || null
    if (!_feePerByte) _feePerByte = await this.getMethod('getFeePerByte')()

    const { inputs, outputs, change } = await this.getInputsForAmount([], _feePerByte, [], 10, true)

    if (change) {
      throw new Error('There should not be any change for sweeping transaction')
    }

    const _outputs = [
      {
        address: externalChangeAddress,
        value: outputs[0].value
      }
    ]

    // @ts-ignore
    return this._buildTransaction(_outputs, feePerByte, inputs)
  }

  async signTx(transaction: string, hash: string, derivationPath: string, txfee: number) {
    const keyPair = await this.keyPair(derivationPath)
    const result = keyPair.sign(Buffer.from(hash, 'hex'))
    return result.toString('hex')
  }

  async signPSBT(data: string, inputs: yacoin.PsbtInputTarget[]) {
    const psbt = Psbt.fromBase64(data, { network: this._network })
    for (const input of inputs) {
      const keyPair = await this.keyPair(input.derivationPath)
      psbt.signInput(input.index, keyPair)
    }
    return psbt.toBase64()
  }

  async signBatchP2SHTransaction(
    inputs: [{ inputTxHex: string; index: number; vout: any; outputScript: Buffer; txInputIndex?: number }],
    addresses: string,
    tx: any,
    lockTime?: number,
    segwit?: boolean
  ) {
    const keyPairs = []
    for (const address of addresses) {
      const wallet = await this.getWalletAddress(address)
      const keyPair = await this.keyPair(wallet.derivationPath)
      keyPairs.push(keyPair)
    }

    const sigs = []
    for (let i = 0; i < inputs.length; i++) {
      const index = inputs[i].txInputIndex ? inputs[i].txInputIndex : inputs[i].index
      let sigHash
      if (segwit) {
        sigHash = tx.hashForWitnessV0(
          index,
          inputs[i].outputScript,
          inputs[i].vout.vSat,
          YacoinJsTransaction.SIGHASH_ALL
        )
      } else {
        sigHash = tx.hashForSignature(index, inputs[i].outputScript, YacoinJsTransaction.SIGHASH_ALL)
      }

      const sig = script.signature.encode(keyPairs[i].sign(sigHash), YacoinJsTransaction.SIGHASH_ALL)
      sigs.push(sig)
    }

    return sigs
  }

  getScriptType() {
    if (this._addressType === yacoin.AddressType.LEGACY) return 'p2pkh'
    else throw new Error('Unknown script type')
  }

  async getConnectedNetwork() {
    return this._network
  }

  async isWalletAvailable() {
    return true
  }
}
