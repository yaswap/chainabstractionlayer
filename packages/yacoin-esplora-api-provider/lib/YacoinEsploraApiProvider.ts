import { NodeProvider } from '@liquality/node-provider'
import { addressToString } from '@liquality/utils'
import { decodeRawTransaction, normalizeTransactionObject } from '@liquality/yacoin-utils'
import { TxNotFoundError, BlockNotFoundError } from '@liquality/errors'
import { ChainProvider, Address, yacoin, BigNumber } from '@liquality/types'
import * as esplora from './types'
import { YacoinNetwork } from '@liquality/yacoin-networks'

import { flatten } from 'lodash'

export interface EsploraApiProviderOptions {
  url: string
  network: YacoinNetwork
  // Default 1
  numberOfBlockConfirmation?: number
  // Default 3
  defaultFeePerByte?: number
}

export default class YacoinEsploraApiProvider extends NodeProvider implements Partial<ChainProvider> {
  _network: YacoinNetwork
  _numberOfBlockConfirmation: number
  _defaultFeePerByte: number
  _usedAddressCache: { [index: string]: boolean }

  constructor(options: EsploraApiProviderOptions) {
    const { url, network, numberOfBlockConfirmation = 1, defaultFeePerByte = 20 } = options
    super({
      baseURL: url,
      responseType: 'text',
      transformResponse: undefined // https://github.com/axios/axios/issues/907,
    })

    this._network = network
    this._numberOfBlockConfirmation = numberOfBlockConfirmation
    this._defaultFeePerByte = defaultFeePerByte
    this._usedAddressCache = {}
  }

  async getFeePerByte(numberOfBlocks = this._numberOfBlockConfirmation) {
    // try {
    //   const feeEstimates: esplora.FeeEstimates = await this.nodeGet('/fee-estimates')
    //   const blockOptions = Object.keys(feeEstimates).map((block) => parseInt(block))
    //   const closestBlockOption = blockOptions.reduce((prev, curr) => {
    //     return Math.abs(prev - numberOfBlocks) < Math.abs(curr - numberOfBlocks) ? prev : curr
    //   })
    //   const rate = Math.round(feeEstimates[closestBlockOption])
    //   return rate
    // } catch (e) {
      return this._defaultFeePerByte
    // }
  }

  async getMinRelayFee() {
    return 10 // min fee = 0.01 YAC/kb = 0.00001 YAC /byte = 10 satoshis / byte
  }

  async getBalance(_addresses: (string | Address)[]) {
    const addresses = _addresses.map(addressToString)
    const _utxos = await this.getUnspentTransactions(addresses)
    const utxos = flatten(_utxos)

    return utxos.reduce((acc, utxo) => acc.plus(utxo.value), new BigNumber(0))
  }

  async _getUnspentTransactions(address: string): Promise<yacoin.UTXO[]> {
    const data: esplora.UTXO[] = await this.nodeGet(`/address/${address}/utxo`)
    return data.map((utxo) => ({
      ...utxo,
      address,
      value: utxo.value,
      blockHeight: utxo.status.block_height
    }))
  }

  async getUnspentTransactions(_addresses: (Address | string)[]): Promise<yacoin.UTXO[]> {
    const addresses = _addresses.map(addressToString)
    const utxoSets = await Promise.all(addresses.map((addr) => this._getUnspentTransactions(addr)))
    const utxos = flatten(utxoSets)
    return utxos
  }

  async _getAddressTransactionCount(address: string) {
    const data: esplora.Address = await this.nodeGet(`/address/${address}`)
    return data.tx_count
  }

  async getAddressTransactionCounts(_addresses: (Address | string)[]) {
    const addresses = _addresses.map(addressToString)
    const transactionCountsArray = await Promise.all(
      addresses.map(async (addr) => {
        const txCount = await this._getAddressTransactionCount(addr)
        return { [addr]: txCount }
      })
    )
    const transactionCounts = Object.assign({}, ...transactionCountsArray)
    return transactionCounts
  }

  async getTransactionHex(transactionHash: string): Promise<string> {
    return this.nodeGet(`/tx/${transactionHash}/hex`)
  }

  async getTransaction(transactionHash: string) {
    let data: esplora.Transaction

    try {
      console.log("TACA ===> YacoinEsploraApiProvider, getTransaction, transactionHash = ", transactionHash)
      data = await this.nodeGet(`/tx/${transactionHash}`)
      console.log("TACA ===> YacoinEsploraApiProvider, getTransaction, data = ", data)
    } catch (e) {
      console.log("TACA ===> YacoinEsploraApiProvider, getTransaction, e = ", e)
      if (e.name === 'NodeError' && e.message.includes('Transaction not found')) {
        const { name, message, ...attrs } = e
        throw new TxNotFoundError(`Transaction not found: ${transactionHash}`, attrs)
      }

      throw e
    }

    return this.formatTransaction(data)
  }

  async formatTransaction(tx: esplora.Transaction) {
    const decodedTx = decodeRawTransaction(tx.hex, this._network)
    decodedTx.confirmations = tx.confirmations
    return normalizeTransactionObject(decodedTx, tx.fee, { hash: tx.block_hash, number: tx.block_height })
  }

  async getBlockByHash(blockHash: string) {
    let data

    try {
      data = await this.nodeGet(`/getblock?hash=${blockHash}`)
    } catch (e) {
      if (e.name === 'NodeError' && e.message.includes('Block not found')) {
        const { name, message, ...attrs } = e
        throw new BlockNotFoundError(`Block not found: ${blockHash}`, attrs)
      }

      throw e
    }

    const {
      hash,
      height: number,
      time,
      size,
      previousblockhash: parentHash,
      difficulty,
      nonce
    } = data

    return {
      hash,
      number,
      timestamp: time,
      size,
      parentHash,
      difficulty: Number.parseFloat(difficulty),
      nonce
    }
  }

  async getBlockHash(blockNumber: number): Promise<string> {
    return this.nodeGet(`/getblockhash?index=${blockNumber}`)
  }

  async getBlockByNumber(blockNumber: number) {
    return this.getBlockByHash(await this.getBlockHash(blockNumber))
  }

  async getBlockHeight(): Promise<number> {
    const data = await this.nodeGet('/getblockcount')
    return parseInt(data)
  }

  async getTransactionByHash(transactionHash: string) {
    return this.getTransaction(transactionHash)
  }

  async getRawTransactionByHash(transactionHash: string) {
    return this.getTransactionHex(transactionHash)
  }

  async sendRawTransaction(rawTransaction: string): Promise<string> {
    return this.nodePost('/tx', rawTransaction)
  }
}
