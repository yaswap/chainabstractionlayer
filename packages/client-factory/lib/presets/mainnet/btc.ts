import { BitcoinEsploraBatchApiProvider } from '@yac-swap/bitcoin-esplora-batch-api-provider'
import { BitcoinJsWalletProvider } from '@yac-swap/bitcoin-js-wallet-provider'
import { BitcoinSwapProvider } from '@yac-swap/bitcoin-swap-provider'
import { BitcoinEsploraSwapFindProvider } from '@yac-swap/bitcoin-esplora-swap-find-provider'
import { BitcoinFeeApiProvider } from '@yac-swap/bitcoin-fee-api-provider'
import { BitcoinNetworks } from '@yac-swap/bitcoin-networks'

export default [
  {
    provider: BitcoinEsploraBatchApiProvider,
    optional: ['numberOfBlockConfirmation', 'defaultFeePerByte'],
    args: (config: any) => [
      'https://liquality.io/electrs-batch',
      'https://liquality.io/electrs',
      BitcoinNetworks.bitcoin,
      config.numberOfBlockConfirmation === undefined ? 1 : config.numberOfBlockConfirmation,
      config.defaultFeePerByte === undefined ? 3 : config.defaultFeePerByte
    ]
  },
  {
    provider: BitcoinJsWalletProvider,
    onlyIf: ['mnemonic'],
    args: (config: any) => [BitcoinNetworks.bitcoin, config.mnemonic]
  },
  {
    provider: BitcoinSwapProvider,
    args: [BitcoinNetworks.bitcoin]
  },
  {
    provider: BitcoinEsploraSwapFindProvider,
    args: ['https://liquality.io/electrs']
  },
  {
    provider: BitcoinFeeApiProvider
  }
]
