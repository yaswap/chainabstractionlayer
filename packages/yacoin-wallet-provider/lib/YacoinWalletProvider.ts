import {
  selectCoins,
  normalizeTransactionObject,
  decodeRawTransaction,
  CoinSelectTarget
} from '@liquality/yacoin-utils'
import { YacoinNetwork } from '@liquality/yacoin-networks'
import { yacoin, Transaction, Address, BigNumber, SendOptions, ChainProvider, WalletProvider } from '@liquality/types'
import { asyncSetImmediate, addressToString } from '@liquality/utils'
import { Provider } from '@liquality/provider'
import { InsufficientBalanceError } from '@liquality/errors'
import { BIP32Interface, payments, script } from 'yacoinjs-lib'
import memoize from 'memoizee'

const ADDRESS_GAP = 10
const NUMBER_ADDRESS_PER_CALL = ADDRESS_GAP
const NUMBER_ADDRESS_LIMIT = 200

export enum AddressSearchType {
  EXTERNAL,
  CHANGE,
  EXTERNAL_OR_CHANGE
}

type DerivationCache = { [index: string]: Address }

type Constructor<T = unknown> = new (...args: any[]) => T

interface YacoinWalletProviderOptions {
  network: YacoinNetwork
  baseDerivationPath: string
  addressType?: yacoin.AddressType
}

export default <T extends Constructor<Provider>>(superclass: T) => {
  abstract class YacoinWalletProvider extends superclass implements Partial<ChainProvider>, Partial<WalletProvider> {
    _baseDerivationPath: string
    _network: YacoinNetwork
    _addressType: yacoin.AddressType
    _derivationCache: DerivationCache

    constructor(...args: any[]) {
      const options = args[0] as YacoinWalletProviderOptions
      const { network, baseDerivationPath, addressType = yacoin.AddressType.LEGACY } = options
      const addressTypes = Object.values(yacoin.AddressType)
      if (!addressTypes.includes(addressType)) {
        throw new Error(`addressType must be one of ${addressTypes.join(',')}`)
      }

      super(options)

      this._baseDerivationPath = baseDerivationPath
      this._network = network
      this._addressType = addressType
      this._derivationCache = {}
    }

    abstract baseDerivationNode(): Promise<BIP32Interface>
    abstract _buildTransaction(
      targets: yacoin.OutputTarget[],
      feePerByte?: number,
      fixedInputs?: yacoin.Input[]
    ): Promise<{ hex: string; fee: number }>
    abstract _buildSweepTransaction(
      externalChangeAddress: string,
      feePerByte?: number
    ): Promise<{ hex: string; fee: number }>
    abstract signPSBT(data: string, inputs: yacoin.PsbtInputTarget[]): Promise<string>
    abstract signTx(hash: Buffer, derivationPath: string): Promise<Buffer>
    abstract signBatchP2SHTransaction(
      inputs: [{ inputTxHex: string; index: number; vout: any; outputScript: Buffer }],
      addresses: string,
      tx: any,
      lockTime?: number,
      segwit?: boolean
    ): Promise<Buffer[]>

    getDerivationCache() {
      return this._derivationCache
    }

    sendOptionsToOutputs(transactions: SendOptions[]): yacoin.OutputTarget[] {
      const targets: yacoin.OutputTarget[] = []

      transactions.forEach((tx) => {
        if (tx.to && tx.value && tx.value.gt(0)) {
          targets.push({
            address: addressToString(tx.to),
            value: tx.value.toNumber()
          })
        }

        if (tx.data) {
          const scriptBuffer = script.compile([script.OPS.OP_RETURN, Buffer.from(tx.data, 'hex')])
          targets.push({
            value: 0,
            script: scriptBuffer
          })
        }
      })

      return targets
    }

    async setDerivationCache(derivationCache: DerivationCache) {
      const address = await this.getDerivationPathAddress(Object.keys(derivationCache)[0])
      if (derivationCache[address.derivationPath].address !== address.address) {
        throw new Error(`derivationCache at ${address.derivationPath} does not match`)
      }
      this._derivationCache = derivationCache
    }

    async buildTransaction(output: yacoin.OutputTarget, feePerByte: number) {
      return this._buildTransaction([output], feePerByte)
    }

    async buildBatchTransaction(outputs: yacoin.OutputTarget[]) {
      return this._buildTransaction(outputs)
    }

    async _sendTransaction(transactions: yacoin.OutputTarget[], feePerByte?: number) {
      const { hex, fee } = await this._buildTransaction(transactions, feePerByte)
      const result =  await this.getMethod('sendRawTransaction')(`data=${hex}`)
      if (result == 'There was an error. Check your console.')
      {
        throw new Error(
          "Cannot send transaction, there might some reasons:\n 1) It might be the fee is not enough, please try increasing the fee.\n 2) The wallet haven't updated latest balance info, please wait 10 seconds and try again."
        )
      }
      return normalizeTransactionObject(decodeRawTransaction(hex, this._network), fee)
    }

    async sendTransaction(options: SendOptions) {
      return this._sendTransaction(this.sendOptionsToOutputs([options]), options.fee as number)
    }

    async sendBatchTransaction(transactions: SendOptions[]) {
      return this._sendTransaction(this.sendOptionsToOutputs(transactions))
    }

    async buildSweepTransaction(externalChangeAddress: string, feePerByte: number) {
      return this._buildSweepTransaction(externalChangeAddress, feePerByte)
    }

    async sendSweepTransaction(externalChangeAddress: Address | string, feePerByte: number) {
      const { hex, fee } = await this._buildSweepTransaction(addressToString(externalChangeAddress), feePerByte)
      await this.getMethod('sendRawTransaction')(`data=${hex}`)
      return normalizeTransactionObject(decodeRawTransaction(hex, this._network), fee)
    }

    async updateTransactionFee(tx: Transaction<yacoin.Transaction> | string, newFeePerByte: number) {
      const txHash = typeof tx === 'string' ? tx : tx.hash
      const transaction: yacoin.Transaction = (await this.getMethod('getTransactionByHash')(txHash))._raw
      const fixedInputs = [transaction.vin[0]] // TODO: should this pick more than 1 input? RBF doesn't mandate it

      const lookupAddresses = transaction.vout.map((vout) => vout.scriptPubKey.addresses[0])
      const changeAddress = await this.findAddress(lookupAddresses, true)
      const changeOutput = transaction.vout.find((vout) => vout.scriptPubKey.addresses[0] === changeAddress.address)

      let outputs = transaction.vout
      if (changeOutput) {
        outputs = outputs.filter((vout) => vout.scriptPubKey.addresses[0] !== changeOutput.scriptPubKey.addresses[0])
      }

      // TODO more checks?
      const transactions = outputs.map((output) => ({
        address: output.scriptPubKey.addresses[0],
        value: new BigNumber(output.value).times(1e6).toNumber()
      }))
      const { hex, fee } = await this._buildTransaction(transactions, newFeePerByte, fixedInputs)
      await this.getMethod('sendRawTransaction')(`data=${hex}`)
      return normalizeTransactionObject(decodeRawTransaction(hex, this._network), fee)
    }

    async findAddress(addresses: string[], change = false) {
      // A maximum number of addresses to lookup after which it is deemed that the wallet does not contain this address
      const maxAddresses = NUMBER_ADDRESS_LIMIT
      const addressesPerCall = 50
      let index = 0
      while (index < maxAddresses) {
        const walletAddresses = await this.getAddresses(index, addressesPerCall, change)
        const walletAddress = walletAddresses.find((walletAddr) =>
          addresses.find((addr) => walletAddr.address === addr)
        )
        if (walletAddress) return walletAddress
        index += addressesPerCall
      }
    }

    async getWalletAddress(address: string) {
      const externalAddress = await this.findAddress([address], false)
      if (externalAddress) return externalAddress
      const changeAddress = await this.findAddress([address], true)
      if (changeAddress) return changeAddress

      throw new Error('Wallet does not contain address')
    }

    getAddressFromPublicKey(publicKey: Buffer) {
      return this.getPaymentVariantFromPublicKey(publicKey).address
    }

    getPaymentVariantFromPublicKey(publicKey: Buffer) {
      if (this._addressType === yacoin.AddressType.LEGACY) {
        return payments.p2pkh({ pubkey: publicKey, network: this._network })
      } else throw new Error('Unknown script type')
    }

    async importAddresses() {
      const change = await this.getAddresses(0, 200, true)
      const nonChange = await this.getAddresses(0, 200, false)
      const all = [...nonChange, ...change].map((address) => address.address)
      await this.getMethod('importAddresses')(all)
    }

    async getDerivationPathAddress(path: string) {
      if (path in this._derivationCache) {
        return this._derivationCache[path]
      }

      const baseDerivationNode = await this.baseDerivationNode()
      const subPath = path.replace(this._baseDerivationPath + '/', '')
      const publicKey = baseDerivationNode.derivePath(subPath).publicKey
      const address = this.getAddressFromPublicKey(publicKey)
      const addressObject = new Address({
        address,
        publicKey: publicKey.toString('hex'),
        derivationPath: path
      })

      this._derivationCache[path] = addressObject
      return addressObject
    }

    async getAddresses(startingIndex = 0, numAddresses = 1, change = false) {
      if (numAddresses < 1) {
        throw new Error('You must return at least one address')
      }

      const addresses = []
      const lastIndex = startingIndex + numAddresses
      const changeVal = change ? '1' : '0'

      for (let currentIndex = startingIndex; currentIndex < lastIndex; currentIndex++) {
        const subPath = changeVal + '/' + currentIndex
        const path = this._baseDerivationPath + '/' + subPath
        const addressObject = await this.getDerivationPathAddress(path)
        addresses.push(addressObject)

        await asyncSetImmediate()
      }

      return addresses
    }

    async _getUsedUnusedAddresses(numAddressPerCall = NUMBER_ADDRESS_PER_CALL, addressType: AddressSearchType) {
      const usedAddresses = []
      const addressCountMap = { change: 0, external: 0 }
      const numAddressAlreadyGet = { change: 0, external: 0 }
      const unusedAddressMap: { change: Address; external: Address } = { change: null, external: null }

      let addrList: Address[]
      let uniqueAddresses: string[] = []
      let addressIndex = 0
      let changeAddresses: Address[] = []
      let externalAddresses: Address[] = []

      /* eslint-disable no-unmodified-loop-condition */
      while (
        (addressType === AddressSearchType.EXTERNAL_OR_CHANGE &&
          ((addressCountMap.change < ADDRESS_GAP && numAddressAlreadyGet['change'] < NUMBER_ADDRESS_LIMIT) ||
            (addressCountMap.external < ADDRESS_GAP && numAddressAlreadyGet['external'] < NUMBER_ADDRESS_LIMIT)) ||
        (addressType === AddressSearchType.EXTERNAL &&
          addressCountMap.external < ADDRESS_GAP && numAddressAlreadyGet['external'] < NUMBER_ADDRESS_LIMIT) ||
        (addressType === AddressSearchType.CHANGE &&
          addressCountMap.change < ADDRESS_GAP && numAddressAlreadyGet['change'] < NUMBER_ADDRESS_LIMIT))
      ) {
        /* eslint-enable no-unmodified-loop-condition */
        addrList = []

        if (
          (addressType === AddressSearchType.EXTERNAL_OR_CHANGE || addressType === AddressSearchType.CHANGE) &&
          addressCountMap.change < ADDRESS_GAP && numAddressAlreadyGet['change'] < NUMBER_ADDRESS_LIMIT
        ) {
          // Scanning for change addr
          changeAddresses = await this.getAddresses(addressIndex, numAddressPerCall, true)
          addrList = addrList.concat(changeAddresses)
          numAddressAlreadyGet['change'] += numAddressPerCall
        } else {
          changeAddresses = []
        }

        if (
          (addressType === AddressSearchType.EXTERNAL_OR_CHANGE || addressType === AddressSearchType.EXTERNAL) &&
          addressCountMap.external < ADDRESS_GAP && numAddressAlreadyGet['external'] < NUMBER_ADDRESS_LIMIT
        ) {
          // Scanning for non change addr
          externalAddresses = await this.getAddresses(addressIndex, numAddressPerCall, false)
          addrList = addrList.concat(externalAddresses)
          numAddressAlreadyGet['external'] += numAddressPerCall
        }

        const transactionCounts: yacoin.AddressTxCounts = await this.getMethod('getAddressTransactionCounts')(addrList)

        for (const address of addrList) {
            // Remove duplicate addresses
            if (!uniqueAddresses.includes(address.address)) {
              uniqueAddresses.push(address.address);
            } else {
              continue
            }

          const isUsed = transactionCounts[address.address] > 0
          const isChangeAddress = changeAddresses.find((a) => address.address === a.address)
          const key = isChangeAddress ? 'change' : 'external'

          if (isUsed) {
            usedAddresses.push(address)
            addressCountMap[key] = 0
            unusedAddressMap[key] = null
          } else {
            addressCountMap[key]++

            if (!unusedAddressMap[key]) {
              unusedAddressMap[key] = address
            }
          }
        }

        addressIndex += numAddressPerCall
      }

      if (!unusedAddressMap['change']) {
        unusedAddressMap['change'] = changeAddresses[0]
      }

      if (!unusedAddressMap['external']) {
        unusedAddressMap['external'] = externalAddresses[0]
      }



      return {
        usedAddresses,
        unusedAddress: unusedAddressMap
      }
    }

    async getUsedAddresses(numAddressPerCall = NUMBER_ADDRESS_PER_CALL) {
      return this._getUsedUnusedAddresses(numAddressPerCall, AddressSearchType.EXTERNAL_OR_CHANGE).then(
        ({ usedAddresses }) => {
          return usedAddresses
        }
      )
    }

    async getUnusedAddress(change = false, numAddressPerCall = NUMBER_ADDRESS_PER_CALL) {
      const addressType = change ? AddressSearchType.CHANGE : AddressSearchType.EXTERNAL
      const key = change ? 'change' : 'external'
      return this._getUsedUnusedAddresses(numAddressPerCall, addressType).then(
        ({ unusedAddress }) => {
          return unusedAddress[key]
        }
      )
    }

    async withCachedUtxos(func: () => any) {
      const originalGetMethod = this.getMethod
      const memoizedGetFeePerByte = memoize(this.getMethod('getFeePerByte'), { primitive: true })
      const memoizedGetUnspentTransactions = memoize(this.getMethod('getUnspentTransactions'), { primitive: true })
      const memoizedGetAddressTransactionCounts = memoize(this.getMethod('getAddressTransactionCounts'), {
        primitive: true
      })
      this.getMethod = (method: string, requestor: any = this) => {
        if (method === 'getFeePerByte') return memoizedGetFeePerByte
        if (method === 'getUnspentTransactions') return memoizedGetUnspentTransactions
        else if (method === 'getAddressTransactionCounts') return memoizedGetAddressTransactionCounts
        else return originalGetMethod.bind(this)(method, requestor)
      }

      const result = await func.bind(this)()

      this.getMethod = originalGetMethod

      return result
    }

    async getTotalFee(opts: SendOptions, max: boolean) {
      const targets = this.sendOptionsToOutputs([opts])
      if (!max) {
        const { fee } = await this.getInputsForAmount(targets, opts.fee as number)
        return fee
      } else {
        const { fee } = await this.getInputsForAmount(
          targets.filter((t) => !t.value),
          opts.fee as number,
          [],
          NUMBER_ADDRESS_PER_CALL,
          true
        )
        return fee
      }
    }

    async getTotalFees(transactions: SendOptions[], max: boolean) {
      const fees = await this.withCachedUtxos(async () => {
        const fees: { [index: number]: BigNumber } = {}
        for (const tx of transactions) {
          const fee = await this.getTotalFee(tx, max)
          fees[tx.fee as number] = new BigNumber(fee)
        }
        return fees
      })
      return fees
    }

    async getInputsForAmount(
      _targets: yacoin.OutputTarget[],
      feePerByte?: number,
      fixedInputs: yacoin.Input[] = [],
      numAddressPerCall = NUMBER_ADDRESS_PER_CALL,
      sweep = false
    ) {
      let addressIndex = 0
      let changeAddresses: Address[] = []
      let externalAddresses: Address[] = []
      const addressCountMap = {
        change: 0,
        nonChange: 0
      }

      const feePerBytePromise = this.getMethod('getFeePerByte')()
      let utxos: yacoin.UTXO[] = []

      while (addressCountMap.change < ADDRESS_GAP || addressCountMap.nonChange < ADDRESS_GAP) {
        let addrList: Address[] = []

        if (addressCountMap.change < ADDRESS_GAP) {
          // Scanning for change addr
          changeAddresses = await this.getAddresses(addressIndex, numAddressPerCall, true)
          addrList = addrList.concat(changeAddresses)
        } else {
          changeAddresses = []
        }

        if (addressCountMap.nonChange < ADDRESS_GAP) {
          // Scanning for non change addr
          externalAddresses = await this.getAddresses(addressIndex, numAddressPerCall, false)
          addrList = addrList.concat(externalAddresses)
        }

        const fixedUtxos: yacoin.UTXO[] = []
        if (fixedInputs.length > 0) {
          for (const input of fixedInputs) {
            const txHex = await this.getMethod('getRawTransactionByHash')(input.txid)
            const tx = decodeRawTransaction(txHex, this._network)
            const value = new BigNumber(tx.vout[input.vout].value).times(1e6).toNumber()
            const address = tx.vout[input.vout].scriptPubKey.addresses[0]
            const walletAddress = await this.getWalletAddress(address)
            const utxo = { ...input, value, address, derivationPath: walletAddress.derivationPath }
            fixedUtxos.push(utxo)
          }
        }

        if (!sweep || fixedUtxos.length === 0) {
          const _utxos: yacoin.UTXO[] = await this.getMethod('getUnspentTransactions')(addrList)
          utxos.push(
            ..._utxos.map((utxo) => {
              const addr = addrList.find((a) => a.address === utxo.address)
              return {
                ...utxo,
                derivationPath: addr.derivationPath
              }
            })
          )
        } else {
          utxos = fixedUtxos
        }

        const utxoBalance = utxos.reduce((a, b) => a + (b.value || 0), 0)

        const transactionCounts: yacoin.AddressTxCounts = await this.getMethod('getAddressTransactionCounts')(addrList)

        if (!feePerByte) feePerByte = await feePerBytePromise
        const minRelayFee = await this.getMethod('getMinRelayFee')()
        if (feePerByte < minRelayFee) {
          throw new Error(`Fee supplied (${feePerByte} sat/b) too low. Minimum relay fee is ${minRelayFee} sat/b`)
        }

        let targets: CoinSelectTarget[]
        if (sweep) {
          const outputBalance = _targets.reduce((a, b) => a + (b['value'] || 0), 0)

          const sweepOutputSize = 39
          const paymentOutputSize = _targets.filter((t) => t.value && t.address).length * 39
          const scriptOutputSize = _targets
            .filter((t) => !t.value && t.script)
            .reduce((size, t) => size + 39 + t.script.byteLength, 0)

          const outputSize = sweepOutputSize + paymentOutputSize + scriptOutputSize
          const inputSize = utxos.length * 153

          const sweepFee = feePerByte * (inputSize + outputSize)
          const amountToSend = new BigNumber(utxoBalance).minus(sweepFee)

          targets = _targets.map((target) => ({ id: 'main', value: target.value, script: target.script }))
          targets.push({ id: 'main', value: amountToSend.minus(outputBalance).toNumber() })
        } else {
          targets = _targets.map((target) => ({ id: 'main', value: target.value, script: target.script }))
        }

        const { inputs, outputs, change, fee } = selectCoins(utxos, targets, Math.ceil(feePerByte), fixedUtxos)

        if (inputs && outputs) {
          return {
            inputs,
            change,
            outputs,
            fee
          }
        }

        for (const address of addrList) {
          const isUsed = transactionCounts[address.address]
          const isChangeAddress = changeAddresses.find((a) => address.address === a.address)
          const key = isChangeAddress ? 'change' : 'nonChange'

          if (isUsed) {
            addressCountMap[key] = 0
          } else {
            addressCountMap[key]++
          }
        }

        addressIndex += numAddressPerCall
      }

      throw new InsufficientBalanceError('Not enough balance')
    }
  }
  return YacoinWalletProvider
}
