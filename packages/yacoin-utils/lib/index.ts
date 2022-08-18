import { base58, padHexStart } from '@liquality/crypto'
import { YacoinNetworks, YacoinNetwork } from '@yac-swap/yacoin-networks'
import { Address, Transaction, yacoin as bT, TxStatus } from '@yac-swap/types'
import { addressToString } from '@liquality/utils'
import { InvalidAddressError } from '@liquality/errors'

import { findKey } from 'lodash'
import BigNumber from 'bignumber.js'
import * as yacoin from '@yac-swap/yacoinjs-lib'
import * as classify from '@yac-swap/yacoinjs-lib/src/classify'
import coinselect from 'coinselect'
import coinselectAccumulative from 'coinselect/accumulative'

const AddressTypes = ['legacy', 'p2sh-segwit', 'bech32']

function calculateFee(numInputs: number, numOutputs: number, feePerByte: number) {
//   {
//     "txid" : "bc744444f5410e5b03639a0a92d37737b4fa2d6d6f1e97c5a6ed0390e2acfbcf",
//     "version" : 2, // 4 bytes
//     "time" : 1653219764, // 8 bytes
//     "locktime" : 0, // 4 bytes
//     "vin" : [ // 1 byte indicates the upcoming number of inputs
//         {
//             "txid" : "bc2295b664e6cfe57cb0c228a7ec31ff243e177fc28b4f127b32f435ae1a13a7", // 32 bytes
//             "vout" : 0, // 4 bytes
//             "scriptSig" : { // total 240 bytes
//                 "asm" : "3045022100879e9310e63842164f585937a94bc4f4209056fec50f3b8e7c353d58bc6335c9022008c520fe57a6e6e7181f428b61c56fb439980db4e9ba745d799a3505297e86a001 021b0fb94962e76fca82bac5c2737bd805e8c8b4830d5f2209b1637a2758f0cad4 9619bad9da984eda018c722024073263167c366112e3bdd32349d08f1fd84d0c 1 6382012088a820d0602bf11c7f3c9d6ea5c4395e497d31b791ec817e9e9c9a9f6523b3a51ccc258876a9147dce63154e07772ff7a6b71c78c434f939c8a7c1670460ec8862b17576a9141a2e6ad533096f6f5bc4e420be190f7e9942d4306888ac",
//                 "hex" : "483045022100879e9310e63842164f585937a94bc4f4209056fec50f3b8e7c353d58bc6335c9022008c520fe57a6e6e7181f428b61c56fb439980db4e9ba745d799a3505297e86a00121021b0fb94962e76fca82bac5c2737bd805e8c8b4830d5f2209b1637a2758f0cad4209619bad9da984eda018c722024073263167c366112e3bdd32349d08f1fd84d0c514c616382012088a820d0602bf11c7f3c9d6ea5c4395e497d31b791ec817e9e9c9a9f6523b3a51ccc258876a9147dce63154e07772ff7a6b71c78c434f939c8a7c1670460ec8862b17576a9141a2e6ad533096f6f5bc4e420be190f7e9942d4306888ac"
//             },
//             "sequence" : 0 // 4 bytes
//         }
//     ],
//     "vout" : [ // 1 byte indicates the upcoming number of outputs
//         {
//             "value" : 1.9978880000000001, // 8 bytes
//             "n" : 0,
//             "scriptPubKey" : { // total 25 bytes (24 bytes data + 1 byte size)
//                 "asm" : "OP_DUP OP_HASH160 7dce63154e07772ff7a6b71c78c434f939c8a7c1 OP_EQUALVERIFY OP_CHECKSIG",
//                 "hex" : "76a9147dce63154e07772ff7a6b71c78c434f939c8a7c188ac",
//                 "reqSigs" : 1,
//                 "type" : "pubkeyhash",
//                 "addresses" : [
//                     "YBVeXN4vzg9HC4QywKZHkmC147LtuCFV2A"
//                 ]
//             }
//         }
//     ],
//     "size" : 333
// }
// 18 bytes are version + time + locktime + 2 byte indicates the upcoming number of inputs, output
  return (numInputs * 280 + numOutputs * 33 + 18) * feePerByte
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
  // TODO: can this be simplified using just @yac-swap/yacoinjs-lib??
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
    txid: bjsTx.getHash().reverse().toString('hex'),
    hash: bjsTx.getHash().reverse().toString('hex'),
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
  const value = tx.vout.reduce((p, n) => p.plus(new BigNumber(n.value).times(1e6)), new BigNumber(0))
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
