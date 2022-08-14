import { NodeProvider } from '@liquality/node-provider'
import { SwapParams, Transaction, yacoin } from '@liquality/types'
import { payments } from '@yac-swap/yacoinjs-lib'

type TransactionMatchesFunction = (tx: Transaction<yacoin.Transaction>) => boolean
type PaymentVariants = {
  [yacoin.SwapMode.P2SH]?: payments.Payment
}

export default class YacoinEsploraSwapFindProvider extends NodeProvider {
  constructor(url: string) {
    super({
      baseURL: url,
      responseType: 'text',
      transformResponse: undefined // https://github.com/axios/axios/issues/907,
    })
  }

  async findAddressTransaction(address: string, predicate: TransactionMatchesFunction) {
    // TODO: This does not go through pages as swap addresses have at most 2 transactions
    // Investigate whether retrieving more transactions is required.
    const addressInfo = await this.nodeGet(`/ext/getaddress/${address}`)

    for (const transaction of addressInfo.last_txs) {
      const formattedTransaction: Transaction<yacoin.Transaction> = await this.getMethod('getTransaction')(
        transaction.addresses
      )
      
      if (predicate(formattedTransaction)) {
        return formattedTransaction
      }
    }
  }

  async findSwapTransaction(swapParams: SwapParams, blockNumber: number, predicate: TransactionMatchesFunction) {
    const swapOutput: Buffer = this.getMethod('getSwapOutput')(swapParams)
    const paymentVariants: PaymentVariants = this.getMethod('getSwapPaymentVariants')(swapOutput)
    for (const paymentVariant of Object.values(paymentVariants)) {
      const addressTransaction = this.findAddressTransaction(paymentVariant.address, predicate)
      if (addressTransaction) return addressTransaction
    }
  }

  doesBlockScan() {
    return false
  }
}
