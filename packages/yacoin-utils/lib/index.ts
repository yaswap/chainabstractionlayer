import { base58, padHexStart } from '@liquality/crypto'
import { YacoinNetworks, YacoinNetwork } from '@liquality/yacoin-networks'
import { Address, Transaction, yacoin as bT, TxStatus } from '@liquality/types'
import { addressToString } from '@liquality/utils'
import { InvalidAddressError } from '@liquality/errors'

import { findKey } from 'lodash'
import BigNumber from 'bignumber.js'
import * as yacoin from 'yacoinjs-lib'
import * as classify from 'yacoinjs-lib/src/classify'
import * as varuint from 'bip174/src/lib/converter/varint'
import coinselect from 'coinselect'
import coinselectAccumulative from 'coinselect/accumulative'

const AddressTypes = ['legacy', 'p2sh-segwit', 'bech32']

function calculateFee(numInputs: number, numOutputs: number, feePerByte: number) {
  return (numInputs * 148 + numOutputs * 34 + 10) * feePerByte
}

/**
 * Get compressed pubKey from pubKey.
 * @param {!string} pubKey - 65 byte string with prefix, x, y.
 * @return {string} Returns the compressed pubKey of uncompressed pubKey.
 */
function compressPubKey(pubKey: string) {
  const x = pubKey.substring(2, 66)
  const y = pubKey.substring(66, 130)
  const even = parseInt(y.substring(62, 64), 16) % 2 === 0
  const prefix = even ? '02' : '03'

  return prefix + x
}

/**
 * Get a network object from an address
 * @param {string} address The yacoin address
 * @return {Network}
 */
function getAddressNetwork(address: string) {
  // TODO: can this be simplified using just yacoinjs-lib??
  let networkKey

  const prefix = base58.decode(address).toString('hex').substring(0, 2)
  networkKey = findKey(YacoinNetworks, (network) => {
    const pubKeyHashPrefix = padHexStart(network.pubKeyHash.toString(16), 1)
    const scriptHashPrefix = padHexStart(network.scriptHash.toString(16), 1)
    return [pubKeyHashPrefix, scriptHashPrefix].includes(prefix)
  })

  return (YacoinNetworks as { [key: string]: YacoinNetwork })[networkKey]
}

type CoinSelectTarget = {
  value: number
  script?: Buffer
  id?: string
}

type CoinSelectResponse = {
  inputs: bT.UTXO[]
  outputs: CoinSelectTarget[]
  change: CoinSelectTarget
  fee: number
}

type CoinSelectFunction = (utxos: bT.UTXO[], targets: CoinSelectTarget[], feePerByte: number) => CoinSelectResponse

function selectCoins(utxos: bT.UTXO[], targets: CoinSelectTarget[], feePerByte: number, fixedInputs: bT.UTXO[] = []) {
  let selectUtxos = utxos

  // Default coinselect won't accumulate some inputs
  // TODO: does coinselect need to be modified to ABSOLUTELY not skip an input?
  const coinselectStrat: CoinSelectFunction = fixedInputs.length ? coinselectAccumulative : coinselect
  if (fixedInputs.length) {
    selectUtxos = [
      // Order fixed inputs to the start of the list so they are used
      ...fixedInputs,
      ...utxos.filter((utxo) => !fixedInputs.find((input) => input.vout === utxo.vout && input.txid === utxo.txid))
    ]
  }

  const { inputs, outputs, fee } = coinselectStrat(selectUtxos, targets, Math.ceil(feePerByte))

  let change
  if (inputs && outputs) {
    change = outputs.find((output) => output.id !== 'main')
  }

  return { inputs, outputs, fee, change }
}

const OUTPUT_TYPES_MAP = {
  [classify.types.P2WPKH]: 'witness_v0_keyhash',
  [classify.types.P2WSH]: 'witness_v0_scripthash'
}

function decodeRawTransaction(hex: string, network: YacoinNetwork): bT.Transaction {
  const bjsTx = yacoin.Transaction.fromHex(hex)

  const vin = bjsTx.ins.map((input) => {
    return <bT.Input>{
      txid: Buffer.from(input.hash).reverse().toString('hex'),
      vout: input.index,
      scriptSig: {
        asm: yacoin.script.toASM(input.script),
        hex: input.script.toString('hex')
      },
      sequence: input.sequence
    }
  })

  const vout = bjsTx.outs.map((output, n) => {
    const type = classify.output(output.script)

    const vout: bT.Output = {
      value: output.value / 1e6,
      n,
      scriptPubKey: {
        asm: yacoin.script.toASM(output.script),
        hex: output.script.toString('hex'),
        reqSigs: 1, // TODO: not sure how to derive this
        type: OUTPUT_TYPES_MAP[type] || type,
        addresses: []
      }
    }

    try {
      const address = yacoin.address.fromOutputScript(output.script, network)
      vout.scriptPubKey.addresses.push(address)
    } catch (e) {
      /** If output script is not parasable, we just skip it */
    }

    return vout
  })

  return {
    txid: bjsTx.getHash(false).reverse().toString('hex'),
    hash: bjsTx.getHash(true).reverse().toString('hex'),
    version: bjsTx.version,
    time: bjsTx.time,
    locktime: bjsTx.locktime,
    size: bjsTx.byteLength(),
    vsize: bjsTx.virtualSize(),
    weight: bjsTx.weight(),
    vin,
    vout,
    hex
  }
}

function normalizeTransactionObject(
  tx: bT.Transaction,
  fee: number,
  block?: { number: number; hash: string }
): Transaction<bT.Transaction> {
  const value = tx.vout.reduce((p, n) => p.plus(new BigNumber(n.value).times(1e8)), new BigNumber(0))
  const result = {
    hash: tx.txid,
    value: value.toNumber(),
    _raw: tx,
    confirmations: 0,
    status: tx.confirmations > 0 ? TxStatus.Success : TxStatus.Pending
  }

  if (fee) {
    const feePrice = Math.round(fee / tx.vsize)
    Object.assign(result, {
      fee,
      feePrice
    })
  }

  if (block) {
    Object.assign(result, {
      blockHash: block.hash,
      blockNumber: block.number,
      confirmations: tx.confirmations
    })
  }

  return result
}

function getPubKeyHash(address: string, network: YacoinNetwork) {
  const outputScript = yacoin.address.toOutputScript(address, network)
  const type = classify.output(outputScript)
  if (type !== classify.types.P2PKH) {
    throw new Error(
      `Yacoin swap doesn't support the address ${address} type of ${type}. Not possible to derive public key hash.`
    )
  }

  const base58 = yacoin.address.fromBase58Check(address)
  return base58.hash
}

function validateAddress(_address: Address | string, network: YacoinNetwork) {
  const address = addressToString(_address)

  if (typeof address !== 'string') {
    throw new InvalidAddressError(`Invalid address: ${address}`)
  }

  let pubKeyHash
  try {
    pubKeyHash = getPubKeyHash(address, network)
  } catch (e) {
    throw new InvalidAddressError(`Invalid Address. Failed to parse: ${address}`)
  }

  if (!pubKeyHash) {
    throw new InvalidAddressError(`Invalid Address: ${address}`)
  }
}

export {
  calculateFee,
  compressPubKey,
  getAddressNetwork,
  CoinSelectTarget,
  selectCoins,
  decodeRawTransaction,
  normalizeTransactionObject,
  AddressTypes,
  getPubKeyHash,
  validateAddress
}
