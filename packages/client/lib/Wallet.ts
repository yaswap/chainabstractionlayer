import { UnsupportedMethodError } from '@yaswap/errors';
import {
    Address,
    AddressType,
    Asset,
    BigNumber,
    FeeType,
    NamingProvider,
    Network,
    Transaction,
    TransactionRequest,
    WalletProvider,
} from '@yaswap/types';
import Chain from './Chain';

export default abstract class Wallet<T, S> implements WalletProvider {
    protected chainProvider: Chain<T>;
    protected namingProvider: NamingProvider;

    constructor(chainProvider?: Chain<T>, namingProvider?: NamingProvider) {
        this.chainProvider = chainProvider;
        this.namingProvider = namingProvider;
    }

    public setChainProvider(chainProvider: Chain<T>): void {
        this.chainProvider = chainProvider;
        this.onChainProviderUpdate(chainProvider);
    }

    public getChainProvider(): Chain<T> {
        return this.chainProvider;
    }

    public setNamingProvider(namingProvider: NamingProvider) {
        this.namingProvider = namingProvider;
    }

    public getNamingProvider(): NamingProvider {
        return this.namingProvider;
    }

    public signTypedData(_data: any): Promise<string> {
        throw new UnsupportedMethodError('Method not supported');
    }

    public abstract getConnectedNetwork(): Promise<Network>;

    public abstract getSigner(): S;

    public abstract getAddress(): Promise<AddressType>;

    public abstract getUnusedAddress(change?: boolean, numAddressPerCall?: number): Promise<Address>;

    public abstract getUsedAddresses(numAddressPerCall?: number): Promise<Address[]>;

    public abstract getAddresses(start?: number, numAddresses?: number, change?: boolean): Promise<Address[]>;

    public abstract signMessage(message: string, from: AddressType): Promise<string>;

    public abstract sendTransaction(txRequest: TransactionRequest): Promise<Transaction>;

    public abstract sendBatchTransaction(txRequests: TransactionRequest[]): Promise<Transaction[]>;

    public abstract sendSweepTransaction(address: AddressType, asset: Asset, fee?: FeeType): Promise<Transaction>;

    public abstract updateTransactionFee(tx: string | Transaction, newFee: FeeType): Promise<Transaction>;

    public abstract getBalance(assets: Asset[]): Promise<BigNumber[]>;

    public abstract exportPrivateKey(): Promise<string>;

    public abstract isWalletAvailable(): Promise<boolean>;

    public abstract canUpdateFee(): boolean;

    protected abstract onChainProviderUpdate(chainProvider: Chain<T>): void;
}
