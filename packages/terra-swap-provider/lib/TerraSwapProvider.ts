import { SwapParams, SwapProvider, terra, Transaction } from '@yaswap/types'
import { Provider } from '@yaswap/provider'
import { TxNotFoundError, StandardError } from '@yaswap/errors'
import { validateSwapParams, doesTransactionMatchInitiation } from '@yaswap/terra-utils'
import { validateSecretAndHash } from '@yaswap/utils'
import { TerraNetwork } from '@yaswap/terra-networks'
import { isTxError, MsgExecuteContract, MsgInstantiateContract } from '@terra-money/terra.js'

export default class TerraSwapProvider extends Provider implements Partial<SwapProvider> {
  private _network: TerraNetwork
  private _asset: string

  constructor(network: TerraNetwork, asset: string) {
    super()
    this._network = network
    this._asset = asset
  }

  async getSwapSecret(claimTxHash: string): Promise<string> {
    const transaction = await this.getMethod('getTransactionByHash')(claimTxHash)

    if (!transaction) {
      throw new TxNotFoundError(`Transaction with hash: ${claimTxHash} was not found`)
    }

    return transaction?.secret
  }

  async initiateSwap(swapParams: SwapParams, fee: number): Promise<Transaction<terra.InputTransaction>> {
    validateSwapParams(swapParams)

    const initContractMsg = this._instantiateContractMessage(swapParams)

    return await this.getMethod('sendTransaction')({
      data: {
        msgs: [initContractMsg],
        fee
      },
      value: swapParams.value
    })
  }

  async claimSwap(
    swapParams: SwapParams,
    initiationTxHash: string,
    secret: string
  ): Promise<Transaction<terra.InputTransaction>> {
    validateSecretAndHash(secret, swapParams.secretHash)

    await this.verifyInitiateSwapTransaction(swapParams, initiationTxHash)

    const initTx = await this.getMethod('getTransactionByHash')(initiationTxHash)

    const executeContractMsg = this._executeContractMessage(initTx._raw.contractAddress, {
      claim: { secret }
    })

    const transaction = await this.getMethod('sendTransaction')({
      data: {
        msgs: [executeContractMsg]
      }
    })

    return transaction
  }

  async refundSwap(swapParams: SwapParams, initiationTxHash: string): Promise<Transaction<terra.InputTransaction>> {
    await this.verifyInitiateSwapTransaction(swapParams, initiationTxHash)

    const initTx = await this.getMethod('getTransactionByHash')(initiationTxHash)

    const executeContractMsg = this._executeContractMessage(initTx._raw.contractAddress, {
      refund: {}
    })

    const transaction = await this.getMethod('sendTransaction')({
      data: {
        msgs: [executeContractMsg]
      }
    })

    return transaction
  }

  async fundSwap(): Promise<null> {
    return null
  }

  async verifyInitiateSwapTransaction(swapParams: SwapParams, initiationTxHash: string): Promise<boolean> {
    validateSwapParams(swapParams)

    const initTx = await this.getMethod('getTransactionByHash')(initiationTxHash)

    if (!initTx) {
      throw new TxNotFoundError(`Transaction not found: ${initiationTxHash}`)
    }

    if (isTxError(initTx)) {
      throw new StandardError(`Encountered an error while running the transaction: ${initTx.code} ${initTx.codespace}`)
    }

    if (initTx['_raw']['codeId'] !== this._network.codeId) {
      throw new StandardError(`Transaction is from different template: ${initTx['codeId']}`)
    }

    if (!doesTransactionMatchInitiation(swapParams, initTx['_raw'])) {
      throw new StandardError('Transactions are not matching')
    }

    return true
  }

  _instantiateContractMessage(swapParams: SwapParams): MsgInstantiateContract {
    const address = this.getMethod('_getAccAddressKey')()

    const { codeId } = this._network

    return new MsgInstantiateContract(
      address,
      null,
      codeId,
      {
        buyer: swapParams.recipientAddress,
        seller: swapParams.refundAddress,
        expiration: swapParams.expiration,
        value: swapParams.value.toNumber(),
        secret_hash: swapParams.secretHash
      },
      { [this._asset]: swapParams.value.toNumber() }
    )
  }

  _executeContractMessage(contractAddress: string, method: any): MsgExecuteContract {
    const address = this.getMethod('_getAccAddressKey')()

    return new MsgExecuteContract(address, contractAddress, method)
  }
}
