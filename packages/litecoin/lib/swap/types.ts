import { Transaction } from '@yaswap/types';
import { payments } from 'bitcoinjs-lib';
import { LitecoinNetwork, SwapMode, Transaction as LitecoinTransaction } from '../types';

export interface LitecoinSwapProviderOptions {
    network: LitecoinNetwork;
    mode?: SwapMode;
    scraperUrl?: string;
}

export type TransactionMatchesFunction = (tx: Transaction<LitecoinTransaction>) => boolean;

export type PaymentVariants = {
    [SwapMode.P2WSH]?: payments.Payment;
    [SwapMode.P2SH_SEGWIT]?: payments.Payment;
    [SwapMode.P2SH]?: payments.Payment;
};
