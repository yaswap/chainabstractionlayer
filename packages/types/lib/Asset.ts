import { ChainId } from '@yaswap/cryptoassets';
export { ChainId } from '@yaswap/cryptoassets';

export type AssetType = 'native' | 'erc20' | 'nft';

export enum AssetTypes {
    native = 'native',
    erc20 = 'erc20',
    nft = 'nft',
}

export interface Asset {
    name: string;
    code: string;
    chain: ChainId;
    type: AssetType;
    decimals: number;
    contractAddress?: string;
}

export interface TokenDetails {
    decimals: number;
    name: string;
    symbol: string;
}

export enum TokenType {
    token = 'YA-Token',
    nft = 'YA-NFT',
}

export enum TokenScriptType {
    newToken = 'newToken',
    tokenOwner = 'tokenOwner',
    transfer = 'transfer',
    reissue = 'reissue',
}

export type TokenInfo = {
    token_type: string;
    amount: number;
    units: number;
    reissuable: boolean;
    block_hash?: string;
    ipfs_hash?: string;
};
export interface TokenBalance { // for Yacoin only
    name: string;
    balance: number;
    totalSupply: number;
    units: number;
    reissuable: boolean;
    blockHash: string;
    ipfsHash: string;
}
