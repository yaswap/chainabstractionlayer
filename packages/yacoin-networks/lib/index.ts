import { networks, Network as YacoinJsLibNetwork } from 'yacoinjs-lib'
import { Network } from '@liquality/types'

export interface YacoinNetwork extends Network, YacoinJsLibNetwork {}

const yacoin: YacoinNetwork = {
  name: 'yacoin',
  ...networks.yacoin,
  coinType: '0',
  isTestnet: false
}

const yacoin_testnet: YacoinNetwork = {
  name: 'yacoin_testnet',
  ...networks.testnet,
  coinType: '1',
  isTestnet: true
}

const yacoin_regtest: YacoinNetwork = {
  name: 'yacoin_regtest',
  ...networks.regtest,
  coinType: '1',
  isTestnet: true
}

const YacoinNetworks = {
  yacoin,
  yacoin_testnet,
  yacoin_regtest
}

export { YacoinNetworks }
