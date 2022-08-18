import { NodeProvider } from '@yac-swap/node-provider'
import { FeeProvider, FeeDetails } from '@yac-swap/types'

export default class YacoinFeeApiProvider extends NodeProvider implements FeeProvider {
  constructor(endpoint = 'https://mempool.space/api/v1/fees/recommended') {
    super({
      baseURL: endpoint
    })
  }

  async getFees(): Promise<FeeDetails> {
    return {
      slow: {
        fee: 11,
        wait: 60 * 60
      },
      average: {
        fee: 11,
        wait: 30 * 60
      },
      fast: {
        fee: 11,
        wait: 10 * 60
      }
    }
  }
}
