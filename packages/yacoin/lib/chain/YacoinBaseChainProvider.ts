import { AddressType, Transaction } from '@yaswap/types';
import { AddressTxCounts, UTXO, YacoinEsploraTypes } from '../types';

export abstract class YacoinBaseChainProvider {
    public abstract formatTransaction(tx: any): Promise<Transaction>;

    public abstract getRawTransactionByHash(transactionHash: string): Promise<string>;

    public abstract getTransactionHex(transactionHash: string): Promise<string>;
    public abstract getTransaction(transactionHash: string): Promise<Transaction>;

    public abstract getFeePerByte(numberOfBlocks?: number): Promise<number>;

    public abstract getUnspentTransactions(addresses: AddressType[]): Promise<UTXO[]>;
    public abstract getTokenUnspentTransactions(addresses: AddressType[], tokenName: string): Promise<UTXO[]>;
    public abstract getAllTokenUnspentTransactions(addresses: AddressType[]): Promise<YacoinEsploraTypes.BatchTokenUTXOInfo>;
    public abstract getNFTUnspentTransactions(addresses: AddressType[], tokenName: string): Promise<UTXO[]>;
    public abstract getAllNFTUnspentTransactions(addresses: AddressType[]): Promise<YacoinEsploraTypes.BatchTokenUTXOInfo>;

    public abstract getAddressTransactionCounts(_addresses: AddressType[]): Promise<AddressTxCounts>;

    public abstract getMinRelayFee(): Promise<number>;
}
