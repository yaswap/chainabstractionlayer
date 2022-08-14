import { BitcoinEsploraBatchApiProvider } from '@yac-swap/bitcoin-esplora-batch-api-provider'
import { BitcoinJsWalletProvider } from '@yac-swap/bitcoin-js-wallet-provider'
import { BitcoinSwapProvider } from '@yac-swap/bitcoin-swap-provider'
import { BitcoinEsploraSwapFindProvider } from '@yac-swap/bitcoin-esplora-swap-find-provider'
import { BitcoinRpcFeeProvider } from '@yac-swap/bitcoin-rpc-fee-provider'
import { BitcoinNetworks } from '@yac-swap/bitcoin-networks'

export default [
  {
    provider: BitcoinEsploraBatchApiProvider,
    optional: ['numberOfBlockConfirmation', 'defaultFeePerByte'],
    args: (config: any) => [
      'https://liquality.io/electrs-testnet-batch',
      'https://liquality.io/testnet/electrs',
      BitcoinNetworks.bitcoin_testnet,
      config.numberOfBlockConfirmation === undefined ? 1 : config.numberOfBlockConfirmation,
      config.defaultFeePerByte === undefined ? 3 : config.defaultFeePerByte
    ]
  },
  {
    provider: BitcoinJsWalletProvider,
    onlyIf: ['mnemonic'],
    args: (config: any) => [BitcoinNetworks.bitcoin_testnet, config.mnemonic]
  },
  {
    provider: BitcoinSwapProvider,
    args: [BitcoinNetworks.bitcoin_testnet]
  },
  {
    provider: BitcoinEsploraSwapFindProvider,
    args: ['https://liquality.io/electrs']
  },
  {
    provider: BitcoinRpcFeeProvider
  }
]
