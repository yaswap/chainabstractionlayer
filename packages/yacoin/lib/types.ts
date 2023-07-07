import { Network } from '@yaswap/types';
import { Network as YacoinJsLibNetwork } from '@yaswap/yacoinjs-lib';

export * as YacoinEsploraTypes from './chain/esplora/types';
export * from './swap/types';

export interface YacoinNetwork extends Network, YacoinJsLibNetwork {}

export interface YacoinNodeWalletOptions {
    addressType?: AddressType;
    network?: YacoinNetwork;
}
export interface YacoinWalletProviderOptions extends YacoinNodeWalletOptions {
    baseDerivationPath: string;
}

export interface YacoinHDWalletProviderOptions extends YacoinWalletProviderOptions {
    mnemonic: string;
}

export interface OutputTarget {
    address?: string;
    script?: Buffer;
    tokenName?: string;
    token_value?: number;
    value: number;
}

export interface ScriptPubKey {
    asm: string;
    hex: string;
    reqSigs: number;
    type: string;
    addresses: string[];
}

export interface Output {
    value: number;
    n: number;
    scriptPubKey: ScriptPubKey;
}

export interface Input {
    txid: string;
    vout: number;
    scriptSig: {
        asm: string;
        hex: string;
    };
    sequence: number;
    coinbase?: string;
}

export interface Transaction {
    txid: string;
    hash: string;
    version: number;
    time: number
    locktime: number;
    size: number;
    vsize: number; // DEPRECATED
    weight: number; // DEPRECATED
    vin: Input[];
    vout: Output[];
    confirmations?: number;
    hex: string;
}

export interface UTXO {
    txid: string;
    vout: number;
    value: number;
    token_value?: number;
    address: string;
    script?: string;
    derivationPath?: string;
}

export enum AddressType {
    LEGACY = 'legacy'
}

export enum SwapMode {
    P2SH = 'p2sh'
}

export type AddressTxCounts = { [index: string]: number };

export interface PsbtInputTarget {
    index: number;
    derivationPath: string;
}

export interface P2SHInput {
    inputTxHex: string;
    index: number;
    vout: any;
    outputScript: Buffer;
}
