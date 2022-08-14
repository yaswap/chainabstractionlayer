import { EthereumRpcProvider } from '@yac-swap/ethereum-rpc-provider'
import { EthereumJsWalletProvider } from '@yac-swap/ethereum-js-wallet-provider'
import { EthereumSwapProvider } from '@yac-swap/ethereum-swap-provider'
import { EthereumScraperSwapFindProvider } from '@yac-swap/ethereum-scraper-swap-find-provider'
import { EthereumRpcFeeProvider } from '@yac-swap/ethereum-rpc-fee-provider'
import { EthereumNetworks } from '@yac-swap/ethereum-networks'

export default [
  {
    provider: EthereumRpcProvider,
    optional: ['infuraProjectId'],
    args: (config: any) => [
      `https://rinkeby.infura.io/v3/${config.infuraProjectId || '1d8f7fb6ae924886bbd1733951332eb0'}`
    ]
  },
  {
    provider: EthereumJsWalletProvider,
    onlyIf: ['mnemonic'],
    args: (config: any) => [EthereumNetworks.rinkeby, config.mnemonic]
  },
  {
    provider: EthereumSwapProvider
  },
  {
    provider: EthereumScraperSwapFindProvider,
    args: ['https://liquality.io/eth-mainnet-api']
  },
  {
    provider: EthereumRpcFeeProvider
  }
]
