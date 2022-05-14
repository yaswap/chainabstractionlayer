import { Transaction, Address, yacoin, BigNumber, SwapParams, SwapProvider } from '@liquality/types'
import { Provider } from '@liquality/provider'
import {
  calculateFee,
  decodeRawTransaction,
  normalizeTransactionObject,
  getPubKeyHash,
  validateAddress
} from '@liquality/yacoin-utils'
import {
  addressToString,
  validateValue,
  validateSecret,
  validateSecretHash,
  validateSecretAndHash,
  validateExpiration
} from '@liquality/utils'
import { YacoinNetwork } from '@liquality/yacoin-networks'

import { Transaction as TransactionYacoinJs, TransactionBuilder, script as bScript, payments } from 'yacoinjs-lib'

interface YacoinSwapProviderOptions {
  network: YacoinNetwork
  mode?: yacoin.SwapMode
}

export default class YacoinSwapProvider extends Provider implements Partial<SwapProvider> {
  _network: YacoinNetwork
  _mode: yacoin.SwapMode

  constructor(options: YacoinSwapProviderOptions) {
    super()
    const { network, mode = yacoin.SwapMode.P2SH } = options
    const swapModes = Object.values(yacoin.SwapMode)
    if (!swapModes.includes(mode)) {
      throw new Error(`Mode must be one of ${swapModes.join(',')}`)
    }
    this._network = network
    this._mode = mode
  }

  validateSwapParams(swapParams: SwapParams) {
    validateValue(swapParams.value)
    validateAddress(swapParams.recipientAddress, this._network)
    validateAddress(swapParams.refundAddress, this._network)
    validateSecretHash(swapParams.secretHash)
    validateExpiration(swapParams.expiration)
  }

  // Return the redeem script (original custom locking script)
  getSwapOutput(swapParams: SwapParams) {
    this.validateSwapParams(swapParams)

    const secretHashBuff = Buffer.from(swapParams.secretHash, 'hex')
    const recipientPubKeyHash = getPubKeyHash(addressToString(swapParams.recipientAddress), this._network)
    const refundPubKeyHash = getPubKeyHash(addressToString(swapParams.refundAddress), this._network)
    const OPS = bScript.OPS

    const script = bScript.compile([
      OPS.OP_IF,
      OPS.OP_SIZE,
      bScript.number.encode(32),
      OPS.OP_EQUALVERIFY,
      OPS.OP_SHA256,
      secretHashBuff,
      OPS.OP_EQUALVERIFY,
      OPS.OP_DUP,
      OPS.OP_HASH160,
      recipientPubKeyHash,
      OPS.OP_ELSE,
      bScript.number.encode(swapParams.expiration),
      OPS.OP_CHECKLOCKTIMEVERIFY,
      OPS.OP_DROP,
      OPS.OP_DUP,
      OPS.OP_HASH160,
      refundPubKeyHash,
      OPS.OP_ENDIF,
      OPS.OP_EQUALVERIFY,
      OPS.OP_CHECKSIG
    ])

    if (![97, 98].includes(Buffer.byteLength(script))) {
      throw new Error('Invalid swap script')
    }

    return script
  }

  getSwapInput(sig: Buffer, pubKey: Buffer, isClaim: boolean, secret?: string) {
    const OPS = bScript.OPS
    const redeem = isClaim ? OPS.OP_TRUE : OPS.OP_FALSE
    const secretParams = isClaim ? [Buffer.from(secret, 'hex')] : []

    return bScript.compile([sig, pubKey, ...secretParams, redeem])
  }

  getSwapPaymentVariants(swapOutput: Buffer) {
    const p2sh = payments.p2sh({
      redeem: { output: swapOutput, network: this._network },
      network: this._network
    })

    return {
      [yacoin.SwapMode.P2SH]: p2sh
    }
  }

  async initiateSwap(swapParams: SwapParams, feePerByte: number) {
    this.validateSwapParams(swapParams)

    const swapOutput = this.getSwapOutput(swapParams)
    console.log("TACA ===> YacoinSwapProvider.ts, initiateSwap, swapOutput = ", swapOutput)
    // BY DEFAULT, USING SEGWIT ADDRESS
    const address = this.getSwapPaymentVariants(swapOutput)[this._mode].address
    console.log("TACA ===> YacoinSwapProvider.ts, initiateSwap, address = ", address)
    console.log("TACA ===> YacoinSwapProvider.ts, calling sendTransaction")
    return this.client.chain.sendTransaction({
      to: address,
      value: swapParams.value,
      fee: feePerByte
    })
  }

  async fundSwap(): Promise<null> {
    return null
  }

  async claimSwap(swapParams: SwapParams, initiationTxHash: string, secret: string, feePerByte: number) {
    this.validateSwapParams(swapParams)
    validateSecret(secret)
    validateSecretAndHash(secret, swapParams.secretHash)
    await this.verifyInitiateSwapTransaction(swapParams, initiationTxHash)

    return this._redeemSwap(swapParams, initiationTxHash, true, secret, feePerByte)
  }

  async refundSwap(swapParams: SwapParams, initiationTxHash: string, feePerByte: number) {
    this.validateSwapParams(swapParams)
    await this.verifyInitiateSwapTransaction(swapParams, initiationTxHash)

    return this._redeemSwap(swapParams, initiationTxHash, false, undefined, feePerByte)
  }

  async _redeemSwap(
    swapParams: SwapParams,
    initiationTxHash: string,
    isClaim: boolean,
    secret: string,
    feePerByte: number
  ) {
    const address = isClaim ? swapParams.recipientAddress : swapParams.refundAddress
    const swapOutput = this.getSwapOutput(swapParams)
    return this._redeemSwapOutput(
      initiationTxHash,
      swapParams.value,
      addressToString(address),
      swapOutput,
      swapParams.expiration,
      isClaim,
      secret,
      feePerByte
    )
  }

  async _redeemSwapOutput(
    initiationTxHash: string,
    value: BigNumber,
    address: string,
    swapOutput: Buffer,
    expiration: number,
    isClaim: boolean,
    secret: string,
    _feePerByte: number
  ) {
    const network = this._network
    const swapPaymentVariants = this.getSwapPaymentVariants(swapOutput)

    const initiationTxRaw = await this.getMethod('getRawTransactionByHash')(initiationTxHash)
    const initiationTx = decodeRawTransaction(initiationTxRaw, this._network)

    let swapVout
    let paymentVariant: payments.Payment
    for (const vout of initiationTx.vout) {
      const paymentVariantEntry = Object.entries(swapPaymentVariants).find(
        ([, payment]) => payment.output.toString('hex') === vout.scriptPubKey.hex
      )
      const voutValue = new BigNumber(vout.value).times(1e6)
      if (paymentVariantEntry && voutValue.eq(new BigNumber(value))) {
        paymentVariant = paymentVariantEntry[1]
        swapVout = vout
      }
    }

    if (!swapVout) {
      throw new Error('Valid swap output not found')
    }

    const feePerByte = _feePerByte || (await this.getMethod('getFeePerByte')())

    // TODO: Implement proper fee calculation that counts bytes in inputs and outputs
    const txfee = calculateFee(1, 1, feePerByte)
    const swapValue = new BigNumber(swapVout.value).times(1e6).toNumber()

    if (swapValue - txfee < 0) {
      throw new Error('Transaction amount does not cover fee.')
    }

    // BEGIN CHANGE
    var txb = new TransactionBuilder(network)
    if (!isClaim) {
      txb.setLockTime(expiration)
    }
    // Note: nSequence MUST be <= 0xfffffffe otherwise LockTime is ignored, and is immediately spendable.
    txb.addInput(initiationTxHash, swapVout.n, 0)
    txb.addOutput(address, swapValue - txfee)

    const tx = txb.buildIncomplete()
    const redeemScript = paymentVariant.redeem.output
    const hashType = TransactionYacoinJs.SIGHASH_ALL
    const signatureHash = tx.hashForSignature(0, redeemScript, hashType)

    // Sign transaction
    const walletAddress: Address = await this.getMethod('getWalletAddress')(address)
    const signedSignatureHash = await this.getMethod('signTx')(signatureHash, walletAddress.derivationPath)
    const swapInput = this.getSwapInput(
      bScript.signature.encode(signedSignatureHash, hashType),
      Buffer.from(walletAddress.publicKey, 'hex'),
      isClaim,
      secret
    )

    const redeemScriptSig = payments.p2sh({
      network: network,
      redeem: {
        network: network,
        output: redeemScript,
        input: swapInput
      }
    }).input
    tx.setInputScript(0, redeemScriptSig)
    // END CHANGE

    const hex = tx.toHex()
    await this.getMethod('sendRawTransaction')(hex)
    return normalizeTransactionObject(decodeRawTransaction(hex, this._network), txfee)
  }

  extractSwapParams(outputScript: string) {
    const buffer = bScript.decompile(Buffer.from(outputScript, 'hex')) as Buffer[]
    if (buffer.length !== 20) throw new Error('Invalid swap output script')
    const secretHash = buffer[5].reverse().toString('hex')
    const recipientPublicKey = buffer[9].reverse().toString('hex')
    const expiration = parseInt(buffer[11].reverse().toString('hex'), 16)
    const refundPublicKey = buffer[16].reverse().toString('hex')
    return { recipientPublicKey, refundPublicKey, secretHash, expiration }
  }

  /**
   * Only to be used for situations where transaction is trusted. e.g to bump fee
   * DO NOT USE THIS TO VERIFY THE REDEEM
   */
  async UNSAFE_isSwapRedeemTransaction(transaction: Transaction<yacoin.Transaction>) {
    // eslint-disable-line
    if (transaction._raw.vin.length === 1 && transaction._raw.vout.length === 1) {
      const swapInput = transaction._raw.vin[0]
      const inputScript = this.getInputScript(swapInput)
      const initiationTransaction: Transaction<yacoin.Transaction> = await this.getMethod('getTransactionByHash')(
        transaction._raw.vin[0].txid
      )
      const scriptType = initiationTransaction._raw.vout[transaction._raw.vin[0].vout].scriptPubKey.type
      if (['scripthash', 'witness_v0_scripthash'].includes(scriptType) && [4, 5].includes(inputScript.length))
        return true
    }
    return false
  }

  async updateTransactionFee(tx: Transaction<yacoin.Transaction> | string, newFeePerByte: number) {
    const txHash = typeof tx === 'string' ? tx : tx.hash
    const transaction: Transaction<yacoin.Transaction> = await this.getMethod('getTransactionByHash')(txHash)
    if (await this.UNSAFE_isSwapRedeemTransaction(transaction)) {
      const swapInput = transaction._raw.vin[0]
      const inputScript = this.getInputScript(swapInput)
      const initiationTxHash = swapInput.txid
      const initiationTx: Transaction<yacoin.Transaction> = await this.getMethod('getTransactionByHash')(
        initiationTxHash
      )
      const swapOutput = initiationTx._raw.vout[swapInput.vout]
      const value = new BigNumber(swapOutput.value).times(1e6)
      const address = transaction._raw.vout[0].scriptPubKey.addresses[0]
      const isClaim = inputScript.length === 5
      const secret = isClaim ? inputScript[2] : undefined
      const outputScript = isClaim ? inputScript[4] : inputScript[3]
      const { expiration } = this.extractSwapParams(outputScript)
      return this._redeemSwapOutput(
        initiationTxHash,
        value,
        address,
        Buffer.from(outputScript, 'hex'),
        expiration,
        isClaim,
        secret,
        newFeePerByte
      )
    }
    return this.getMethod('updateTransactionFee')(tx, newFeePerByte)
  }

  getInputScript(vin: yacoin.Input) {
    // const inputScript = vin.txinwitness
    //   ? vin.txinwitness
    //   : bScript
    //       .decompile(Buffer.from(vin.scriptSig.hex, 'hex'))
    //       .map((b) => (Buffer.isBuffer(b) ? b.toString('hex') : b))
    // return inputScript as string[]
    const inputScript = bScript
      .decompile(Buffer.from(vin.scriptSig.hex, 'hex'))
      .map((b) => (Buffer.isBuffer(b) ? b.toString('hex') : b))
    return inputScript as string[]
  }

  doesTransactionMatchRedeem(initiationTxHash: string, tx: Transaction<yacoin.Transaction>, isRefund: boolean) {
    console.log("TACA ===> YacoinSwapProvider.ts, doesTransactionMatchRedeem, initiationTxHash = ", initiationTxHash)
    console.log("TACA ===> YacoinSwapProvider.ts, doesTransactionMatchRedeem, tx = ", tx)
    console.log("TACA ===> YacoinSwapProvider.ts, doesTransactionMatchRedeem, isRefund = ", isRefund)

    const swapInput = tx._raw.vin.find((vin) => vin.txid === initiationTxHash)
    console.log("TACA ===> YacoinSwapProvider.ts, doesTransactionMatchRedeem, swapInput = ", swapInput)
    if (!swapInput) return false
    const inputScript = this.getInputScript(swapInput)
    if (!inputScript) return false
    if (isRefund) {
      if (inputScript.length !== 4) return false // 4 because there is 4 parameters: signature, pubkey, false, original redeemscript
    } else {
      if (inputScript.length !== 5) return false // 5 because there is 5 parameters: signature, pubkey, secretHash, true, original redeemscript
    }
    return true
  }

  doesTransactionMatchInitiation(swapParams: SwapParams, transaction: Transaction<yacoin.Transaction>) {
    console.log("TACA ===> YacoinSwapProvider.ts, doesTransactionMatchInitiation, transaction = ", transaction)
    const swapOutput = this.getSwapOutput(swapParams)
    const swapPaymentVariants = this.getSwapPaymentVariants(swapOutput)
    const vout = transaction._raw.vout.find((vout) =>
      Object.values(swapPaymentVariants).find(
        (payment) =>
          payment.output.toString('hex') === vout.scriptPubKey.hex &&
          new BigNumber(vout.value).times(1e6).eq(new BigNumber(swapParams.value))
      )
    )
    console.log("TACA ===> YacoinSwapProvider.ts, doesTransactionMatchInitiation, swapOutput = ", swapOutput)
    console.log("TACA ===> YacoinSwapProvider.ts, doesTransactionMatchInitiation, swapPaymentVariants = ", swapPaymentVariants)
    console.log("TACA ===> YacoinSwapProvider.ts, doesTransactionMatchInitiation, vout = ", vout)
    return Boolean(vout)
  }

  async verifyInitiateSwapTransaction(swapParams: SwapParams, initiationTxHash: string) {
    this.validateSwapParams(swapParams)

    const initiationTransaction = await this.getMethod('getTransactionByHash')(initiationTxHash)
    return this.doesTransactionMatchInitiation(swapParams, initiationTransaction)
  }

  async findSwapTransaction(
    swapParams: SwapParams,
    blockNumber: number,
    predicate: (tx: Transaction<yacoin.Transaction>) => boolean
  ) {
    // It doesn't go here, it goes to YacoinEsploraSwapFindProvider
    console.log("TACA ===> YacoinSwapProvider.ts, findSwapTransaction, blockNumber = ", blockNumber)
    // TODO: Are mempool TXs possible?
    const block = await this.getMethod('getBlockByNumber')(blockNumber, true)
    const swapTransaction = block.transactions.find(predicate)
    console.log("TACA ===> YacoinSwapProvider.ts, findSwapTransaction, swapTransaction = ", swapTransaction)
    return swapTransaction
  }

  async findInitiateSwapTransaction(swapParams: SwapParams, blockNumber: number) {
    this.validateSwapParams(swapParams)

    console.log("TACA ===> YacoinSwapProvider.ts, findInitiateSwapTransaction, swapParams = ", swapParams)
    console.log("TACA ===> YacoinSwapProvider.ts, findInitiateSwapTransaction, blockNumber = ", blockNumber)
    return this.getMethod('findSwapTransaction', false)(
      swapParams,
      blockNumber,
      (tx: Transaction<yacoin.Transaction>) => this.doesTransactionMatchInitiation(swapParams, tx)
    )
  }

  async findClaimSwapTransaction(swapParams: SwapParams, initiationTxHash: string, blockNumber: number) {
    this.validateSwapParams(swapParams)

    console.log("TACA ===> YacoinSwapProvider.ts, findClaimSwapTransaction, swapParams = ", swapParams)
    console.log("TACA ===> YacoinSwapProvider.ts, findClaimSwapTransaction, initiationTxHash = ", initiationTxHash)
    console.log("TACA ===> YacoinSwapProvider.ts, findClaimSwapTransaction, blockNumber = ", blockNumber)
    const claimSwapTransaction: Transaction<yacoin.Transaction> = await this.getMethod(
      'findSwapTransaction',
      false
    )(swapParams, blockNumber, (tx: Transaction<yacoin.Transaction>) =>
      this.doesTransactionMatchRedeem(initiationTxHash, tx, false)
    )

    if (claimSwapTransaction) {
      const swapInput = claimSwapTransaction._raw.vin.find((vin) => vin.txid === initiationTxHash)
      if (!swapInput) {
        throw new Error('Claim input missing')
      }
      const inputScript = this.getInputScript(swapInput)
      const secret = inputScript[2] as string
      validateSecretAndHash(secret, swapParams.secretHash)
      return {
        ...claimSwapTransaction,
        secret
      }
    }
  }

  async findRefundSwapTransaction(swapParams: SwapParams, initiationTxHash: string, blockNumber: number) {
    this.validateSwapParams(swapParams)

    console.log("TACA ===> YacoinSwapProvider.ts, findRefundSwapTransaction, swapParams = ", swapParams)
    console.log("TACA ===> YacoinSwapProvider.ts, findRefundSwapTransaction, initiationTxHash = ", initiationTxHash)
    console.log("TACA ===> YacoinSwapProvider.ts, findRefundSwapTransaction, blockNumber = ", blockNumber)
    const refundSwapTransaction = await this.getMethod('findSwapTransaction', false)(
      swapParams,
      blockNumber,
      (tx: Transaction<yacoin.Transaction>) => this.doesTransactionMatchRedeem(initiationTxHash, tx, true)
    )
    return refundSwapTransaction
  }

  async findFundSwapTransaction(): Promise<null> {
    return null
  }
}
