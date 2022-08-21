import { EthereumRpcProvider } from '@yaswap/ethereum-rpc-provider'
import { EthereumJsWalletProvider } from '@yaswap/ethereum-js-wallet-provider'
import { EthereumSwapProvider } from '@yaswap/ethereum-swap-provider'
import { EthereumScraperSwapFindProvider } from '@yaswap/ethereum-scraper-swap-find-provider'
import { EthereumRpcFeeProvider } from '@yaswap/ethereum-rpc-fee-provider'
import { EthereumNetworks } from '@yaswap/ethereum-networks'

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
