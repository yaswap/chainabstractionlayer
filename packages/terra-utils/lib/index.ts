import { Block, SwapParams, Transaction, terra, TxStatus } from '@yaswap/types'
import { addressToString, validateExpiration, validateSecretHash, validateValue } from '@yaswap/utils'
import { InvalidAddressError } from '@yaswap/errors'
import { DateTime } from 'luxon'

export const normalizeBlock = (data: any): Block => ({
  hash: data.block_id.hash,
  timestamp: convertDateToTimestamp(data.block.header.time),
  size: Number(data.block.header.height),
  number: Number(data.block.header.height),
  parentHash: data.block.last_commit.block_id.hash
})

export const normalizeTransaction = (
  data: any,
  asset: string,
  currentBlock?: number
): Transaction<terra.InputTransaction> => {
  const denom = Object.keys(data.tx.fee?.amount?._coins || {})?.[0]

  const fee = data.tx.fee?.amount?._coins?.[denom]?.amount?.toNumber()
  const msg = data.tx.body?.messages?.[0] || data.tx.value?.msg?.[0]?.value

  let value = 0

  if (Array.isArray(msg?.init_coins)) {
    value = msg.init_coins.find((e: any) => e.denom === asset)?.amount
  } else if (typeof msg?.init_coins === 'object') {
    value = msg.init_coins.get(asset)?.amount
  }

  const codeId = msg.code_id
  let txParams = msg?.init_msg || msg?.execute_msg || {}

  if (Object.keys(txParams).length) {
    const initMsg = msg?.init_msg
    const executeMsg = msg?.execute_msg

    if (initMsg) {
      txParams = initMsg
    }

    if (executeMsg && typeof txParams !== 'string') {
      txParams.method = executeMsg

      if (txParams.method.claim) {
        txParams.secret = txParams.method.claim.secret
      }
    }
  }

  const logs = data.logs?.[0]

  const contractAddress =
    logs?.eventsByType?.execute_contract?.contract_address[0] ||
    logs?.events?.find((e: any) => e.type === 'wasm')?.attributes.find((e: any) => e.key === 'contract_address')
      .value ||
    ''

  const status = data.raw_log?.includes('failed to execute message') ? TxStatus.Failed : TxStatus.Success

  return {
    value: Number(value),
    hash: data.txhash,
    confirmations: Math.min(currentBlock - data.height, 10),
    ...(txParams?.secret && { secret: txParams.secret }),
    fee,
    status,
    _raw: {
      ...txParams,
      contractAddress,
      codeId
    }
  }
}

export const doesTransactionMatchInitiation = (swapParams: SwapParams, transactionParams: any): boolean => {
  return (
    swapParams.recipientAddress === transactionParams.buyer &&
    swapParams.refundAddress === transactionParams.seller &&
    swapParams.secretHash === transactionParams.secret_hash &&
    swapParams.expiration === transactionParams.expiration &&
    swapParams.value.eq(transactionParams.value)
  )
}

export const validateSwapParams = (swapParams: SwapParams) => {
  validateValue(swapParams.value)
  validateSecretHash(swapParams.secretHash)
  validateExpiration(swapParams.expiration)
  validateAddress(addressToString(swapParams.recipientAddress))
  validateAddress(addressToString(swapParams.refundAddress))
}

const convertDateToTimestamp = (fullDate: string): number => {
  return DateTime.fromISO(fullDate).toSeconds()
}

const validateAddress = (address: string): void => {
  if (typeof address !== 'string' || address.length !== 44) {
    throw new InvalidAddressError(`Invalid address: ${address}`)
  }
}
