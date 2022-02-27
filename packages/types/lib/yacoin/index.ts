import * as rpc from './rpc'

export interface OutputTarget {
  address?: string
  script?: Buffer
  value: number
}

export interface ScriptPubKey {
  asm: string
  hex: string
  reqSigs: number
  type: string
  addresses: string[]
}

export interface Output {
  value: number
  n: number
  scriptPubKey: ScriptPubKey
}

export interface Input {
  txid: string
  vout: number
  scriptSig: {
    asm: string
    hex: string
  }
  sequence: number
  coinbase?: string
}

export interface Transaction {
  txid: string
  hash: string
  version: number
  time: number
  locktime: number
  size: number
  vsize: number // DEPRECATED
  weight: number // DEPRECATED
  vin: Input[]
  vout: Output[]
  confirmations?: number
  hex: string
}

export interface UTXO {
  txid: string
  vout: number
  value: number
  address: string
  derivationPath?: string
}

export enum AddressType {
  LEGACY = 'legacy'
}

export enum SwapMode {
  P2SH = 'p2sh'
}

export type AddressTxCounts = { [index: string]: number }

export interface PsbtInputTarget {
  index: number
  derivationPath: string
}

export { rpc }
