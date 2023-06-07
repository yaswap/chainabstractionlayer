import { NftProvider, Address, Transaction } from '@yaswap/types'

export default class Nft implements NftProvider {
  client: any

  constructor(client: any) {
    this.client = client
  }

  /** @inheritdoc */
  async balance(contract: Address | string, tokenIDs?: number[]): Promise<number | number[]> {
    const balance = await this.client.getMethod('balance')(contract, tokenIDs)
    return balance
  }

  /** @inheritdoc */
  async transfer(
    contract: Address | string,
    receiver: Address | string,
    tokenIDs: number[],
    values?: number[],
    data?: string
  ): Promise<Transaction> {
    const transaction = await this.client.getMethod('transfer')(contract, receiver, tokenIDs, values, data)
    try {
      this.client.assertValidTransaction(transaction)
      return transaction
    } catch (err) {
      this.client.assertValidTransaction(transaction.tx)
      return transaction.tx
    }
  }

  /** @inheritdoc */
  async approve(contract: Address | string, operator: Address | string, tokenID: number): Promise<Transaction> {
    const transaction = await this.client.getMethod('approve')(contract, operator, tokenID)
    try {
      this.client.assertValidTransaction(transaction)
      return transaction
    } catch (err) {
      this.client.assertValidTransaction(transaction.tx)
      return transaction.tx
    }
  }

  /** @inheritdoc */
  async isApproved(contract: Address | string, tokenID: number): Promise<Address> {
    const operator = await this.client.getMethod('isApproved')(contract, tokenID)
    return operator
  }

  /** @inheritdoc */
  async approveAll(contract: Address | string, operator: Address | string, state?: boolean): Promise<Transaction> {
    const transaction = await this.client.getMethod('approveAll')(contract, operator, state)
    try {
      this.client.assertValidTransaction(transaction)
      return transaction
    } catch (err) {
      this.client.assertValidTransaction(transaction.tx)
      return transaction.tx
    }
  }

  /** @inheritdoc */
  async isApprovedForAll(contract: Address | string, operator: Address | string): Promise<boolean> {
    const state = await this.client.getMethod('isApprovedForAll')(contract, operator)
    return state
  }

  /** @inheritdoc */
  async fetch(): Promise<any> {
    const nftData = await this.client.getMethod('fetch')()
    return nftData
  }
}
