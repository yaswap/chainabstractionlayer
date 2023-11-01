import { HttpClient } from '@yaswap/client';
import { SwapParams, Transaction } from '@yaswap/types';
import { Transaction as LitecoinTransaction } from '../types';
import { LitecoinBaseWalletProvider } from '../wallet/LitecoinBaseWallet';
import { LitecoinSwapBaseProvider } from './LitecoinSwapBaseProvider';
import { LitecoinSwapProviderOptions, PaymentVariants, TransactionMatchesFunction } from './types';

export class LitecoinSwapEsploraProvider extends LitecoinSwapBaseProvider {
    private _httpClient: HttpClient;

    constructor(options: LitecoinSwapProviderOptions, walletProvider?: LitecoinBaseWalletProvider) {
        super(options, walletProvider);
        this._httpClient = new HttpClient({ baseURL: options.scraperUrl });
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
        const transactions = await this._httpClient.nodeGet(`/address/${address}/txs`);

        for (const transaction of transactions) {
            const formattedTransaction: Transaction<LitecoinTransaction> = await this.walletProvider
                .getChainProvider()
                .getProvider()
                .formatTransaction(transaction, currentHeight);
            if (predicate(formattedTransaction)) {
                return formattedTransaction;
            }
        }
    }
}
