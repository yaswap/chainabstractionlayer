import { YacoinWalletProvider } from '@yaswap/yacoin-wallet-provider'
import { WalletProvider } from '@yaswap/wallet-provider'
import { YacoinNetwork } from '@yaswap/yacoin-networks'
import { Address, yacoin, SendOptions } from '@yaswap/types'

declare global {
  interface Window {
    yacoin: {
      enable: () => Promise<Address[]>
      request: (request: { method: string; params: any[] }) => Promise<any>
    }
  }
}

interface YacoinWalletApiProviderOptions {
  network: YacoinNetwork
  addressType: yacoin.AddressType
}

type WalletProviderConstructor<T = WalletProvider> = new (...args: any[]) => T

export default class YacoinWalletApiProvider extends YacoinWalletProvider(
  WalletProvider as WalletProviderConstructor
) {
  constructor(options: YacoinWalletApiProviderOptions) {
    const { network, addressType = yacoin.AddressType.LEGACY } = options
    super({ network, addressType })
  }

  async request(method: string, ...params: any[]) {
    await window.yacoin.enable()
    return window.yacoin.request({ method, params })
  }

  async getAddresses(index = 0, num = 1, change = false) {
    return this.request('wallet_getAddresses', index, num, change)
  }

  async signMessage(message: string, address: string) {
    return this.request('wallet_signMessage', message, address)
  }

  async signTx(transaction: string, hash: string, derivationPath: string, txfee: number) {
    return this.request('wallet_signTx', transaction, hash, derivationPath, txfee)
  }

  async sendTransaction(sendOptions: SendOptions) {
    return this.request('wallet_sendTransaction', { ...sendOptions, value: sendOptions.value.toNumber() })
  }

  async getConnectedNetwork() {
    return this.request('wallet_getConnectedNetwork')
  }

  async isWalletAvailable() {
    const addresses = await this.getAddresses()
    return addresses.length > 0
  }
}
