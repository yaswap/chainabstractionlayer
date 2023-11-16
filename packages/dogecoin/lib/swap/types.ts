import { Transaction } from '@yaswap/types';
import { payments } from 'bitcoinjs-lib';
import { DogecoinNetwork, SwapMode, Transaction as DogecoinTransaction } from '../types';

export interface DogecoinSwapProviderOptions {
    network: DogecoinNetwork;
    mode?: SwapMode;
    scraperUrl?: string;
}

export type TransactionMatchesFunction = (tx: Transaction<DogecoinTransaction>) => boolean;

export type PaymentVariants = {
    [SwapMode.P2WSH]?: payments.Payment;
    [SwapMode.P2SH_SEGWIT]?: payments.Payment;
    [SwapMode.P2SH]?: payments.Payment;
};
