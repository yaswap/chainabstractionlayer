import { Transaction } from '@chainify/types';
import { payments } from '@yaswap/yacoinjs-lib';
import { YacoinNetwork, SwapMode, Transaction as YacoinTransaction } from '../types';

export interface YacoinSwapProviderOptions {
    network: YacoinNetwork;
    mode?: SwapMode;
    scraperUrl?: string;
}

export type TransactionMatchesFunction = (tx: Transaction<YacoinTransaction>) => boolean;

export type PaymentVariants = {
    [SwapMode.P2SH]?: payments.Payment;
};
