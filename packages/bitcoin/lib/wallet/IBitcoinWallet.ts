import { Chain, Wallet } from '@yaswap/client';
import { Address, FeeType, Transaction, TransactionRequest } from '@yaswap/types';
import { PsbtInputTarget } from '../types';

export interface IBitcoinWallet<T, S = any> extends Wallet<T, S> {
    getChainProvider(): Chain<T>;

    sendTransaction(txRequest: TransactionRequest): Promise<Transaction>;

    updateTransactionFee(tx: string | Transaction, newFee: FeeType): Promise<Transaction>;

    getWalletAddress(address: string): Promise<Address>;

    signPSBT(data: string, inputs: PsbtInputTarget[]): Promise<string>;
}
