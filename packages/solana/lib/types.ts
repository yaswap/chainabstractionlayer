import { TransactionRequest } from '@yac-swap/types';
import { Transaction } from '@solana/web3.js';

export interface SolanaTxRequest extends TransactionRequest {
    transaction?: Transaction;
}
