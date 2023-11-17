import { HttpClient } from '@yaswap/client';
import { SwapParams, Transaction } from '@yaswap/types';
import { Transaction as DogecoinTransaction } from '../types';
import { DogecoinBaseWalletProvider } from '../wallet/DogecoinBaseWallet';
import { DogecoinSwapBaseProvider } from './DogecoinSwapBaseProvider';
import { DogecoinSwapProviderOptions, PaymentVariants, TransactionMatchesFunction } from './types';

export class DogecoinSwapEsploraProvider extends DogecoinSwapBaseProvider {
    private _dogeChainClient: HttpClient;

    constructor(options: DogecoinSwapProviderOptions, walletProvider?: DogecoinBaseWalletProvider) {
        super(options, walletProvider);
        this._dogeChainClient = new HttpClient({ baseURL: "https://dogechain.info/api/v1" });
    }

    public async findSwapTransaction(swapParams: SwapParams, _blockNumber: number, predicate: TransactionMatchesFunction) {
        const currentHeight: number = await this.walletProvider.getChainProvider().getBlockHeight();
        const swapOutput: Buffer = this.getSwapOutput(swapParams);
        const paymentVariants: PaymentVariants = this.getSwapPaymentVariants(swapOutput);
        for (const paymentVariant of Object.values(paymentVariants)) {
            const addressTransaction = this.findAddressTransaction(paymentVariant.address, currentHeight, predicate);
            if (addressTransaction) return addressTransaction;
        }
    }

    private async findAddressTransaction(address: string, currentHeight: number, predicate: TransactionMatchesFunction) {
        // TODO: This does not go through pages as swap addresses have at most 2 transactions
        // Investigate whether retrieving more transactions is required.
        const data = await this._dogeChainClient.nodeGet(`/address/transactions/${address}/1`);

        for (const transaction of data.transactions) {
            const formattedTransaction: Transaction<DogecoinTransaction> = await this.walletProvider
                .getChainProvider()
                .getTransactionByHash(transaction.hash);
            if (predicate(formattedTransaction)) {
                return formattedTransaction;
            }
        }
    }
}
