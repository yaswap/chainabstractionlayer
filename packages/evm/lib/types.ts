import { AddressType, FeeType, TransactionRequest } from '@chainify/types';
import { Fragment, JsonFragment } from '@ethersproject/abi';
import { BlockWithTransactions as EthersBlockWithTransactions } from '@ethersproject/abstract-provider';
import { PopulatedTransaction as EthersPopulatedTransaction } from '@ethersproject/contracts';
import { Block as EthersBlock, TransactionResponse as EthersTransactionResponse } from '@ethersproject/providers';
import { MessageTypes, SignTypedDataVersion, TypedDataV1, TypedMessage } from '@metamask/eth-sig-util';

export interface SignTypedMessageType<V extends SignTypedDataVersion = SignTypedDataVersion, T extends MessageTypes = MessageTypes> {
    data: V extends 'V1' ? TypedDataV1 : TypedMessage<T>;
    version: SignTypedDataVersion;
    from: string;
}

export interface EvmSwapOptions {
    // contractAddress: string;
    // numberOfBlocksPerRequest?: number;
    // totalNumberOfBlocks?: number;
    // gasLimitMargin?: number;
    contractAddress?: string; // Used to deploy a specialized contract address used for atomic swap
    scraperUrl?: string;
}

export type FeeOptions = {
    slowMultiplier?: number;
    averageMultiplier?: number;
    fastMultiplier?: number;
};

export type EthereumTransactionRequest = TransactionRequest & {
    from?: AddressType;
    nonce?: number;
    gasLimit?: number;
    gasPrice?: number;
    chainId?: number;
    type?: number;
    maxPriorityFeePerGas?: number;
    maxFeePerGas?: number;
};

export type EthereumFeeData = FeeType & {
    maxFeePerGas?: null | number;
    maxPriorityFeePerGas?: null | number;
    gasPrice?: null | number;
};

export { EthersTransactionResponse, EthersBlock, EthersBlockWithTransactions, EthersPopulatedTransaction };

export enum NftTypes {
    ERC721 = 'ERC721',
    ERC1155 = 'ERC1155',
}

export type NftProviderConfig = {
    url: string;
    apiKey: string;
};

export type MoralisConfig = NftProviderConfig & {
    appId: string;
};

export interface MulticallData {
    target: string;
    abi: ReadonlyArray<Fragment | JsonFragment | string>;
    name: string;
    params: ReadonlyArray<Fragment | JsonFragment | string>;
}

/**
 * @pattern ^0x[a-fA-F0-9]*$
 */
export type Hex = string
/**
 * @pattern ^0x[a-fA-F0-9]{64}$
 */
export type Hex256 = string
/**
 * @pattern ^0x[a-fA-F0-9]{40}$
 */
export type Hex160 = string
export type Address = Hex160
// 0x0 (FAILURE) or 0x1 (SUCCESS)
export type TransactionReceiptStatus = '0x0' | '0x1'
export interface EvmPartialTransaction {
    hash?: Hex256
    nonce?: Hex
  
    from: Address
    to?: Address | null
    value: Hex
    gas?: Hex
    gasPrice?: Hex
    input?: Hex
  
    // these are included by both geth and parity but not required
    v?: Hex
    r?: Hex
    s?: Hex
  
    // only mined transactions
    blockHash?: Hex256
    blockNumber?: Hex
    transactionIndex?: Hex
  }
  
  export interface EvmTransaction extends EvmPartialTransaction {
    hash: Hex256
    nonce: Hex
  
    to: Address | null
    gas: Hex
    gasPrice: Hex
    input: Hex
  }

  export interface ScraperTransaction {
    from: Address
    to: Address | null
    hash: Hex256
    value: Hex
    gas?: Hex
    gasPrice?: Hex
    input?: Hex
    secret?: Hex
    blockHash: Hex256
    blockNumber: Hex
    status: TransactionReceiptStatus
    contractAddress: Address
    timestamp: Hex
    confirmations: number
  }