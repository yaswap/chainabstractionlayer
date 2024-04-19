import { YacoinNetwork } from '../../types';
import { TokenInfo } from '@yaswap/types';

export type FeeEstimates = { [index: string]: number };

export type TxStatus = {
    confirmed: boolean;
    block_hash?: string;
    block_height?: number;
    block_time?: number;
};

export type UTXO = {
    txid: string;
    vout: number;
    status: TxStatus;
    value: number;
    token_value?: number;
    script?: string;
};

export type BatchUTXOs = { address: string; utxo: UTXO[] }[];

export type TokenUTXOInfo = {
    token_name: string;
    balance: number;
    earliest_block_height: number;
    latest_block_height: number;
    earliest_timestamp: number;
    latest_timestamp: number;
    token_info: TokenInfo;
    token_utxos: BatchUTXOs;
};

export type BatchTokenUTXOInfo = TokenUTXOInfo[];

export type Address = {
    address: string
    funded_txo_count: number
    funded_txo_sum: number
    spent_txo_count: number
    spent_txo_sum: number
    tx_count: number
}

export type Vout = {
    scriptpubkey: string;
    scriptpubkey_asm: string;
    scriptpubkey_type: string;
    scriptpubkey_address?: string;
    value: number;
};

export type Vin = {
    txid: string;
    vout: number;
    prevout: Vout;
    scriptsig: string;
    scriptsig_asm: string;
    is_coinbase: boolean;
    sequence: number;
};

export type Transaction = {
    hex: string
    block_hash: string
    confirmations: number
    block_height: number
    fee: number
}

export type Block = {
    id: string;
    height: number;
    version: number;
    timestamp: number;
    tx_count: number;
    size: number;
    weight: number;
    merlke_root: string;
    previousblockhash: string;
    mediantime: number;
    nonce: number;
    bits: number;
    difficulty: number;
};

export interface EsploraApiProviderOptions {
    url: string;
    network: YacoinNetwork;
    numberOfBlockConfirmation?: number;
    defaultFeePerByte?: number;
}

export interface EsploraBatchApiProviderOptions extends EsploraApiProviderOptions {
    batchUrl: string;
}

export type FeeOptions = {
    slowTargetBlocks?: number;
    averageTargetBlocks?: number;
    fastTargetBlocks?: number;
};
