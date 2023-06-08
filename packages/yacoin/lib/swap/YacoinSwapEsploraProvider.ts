import { HttpClient } from '@yaswap/client';
import { PendingTxError } from '@yaswap/errors';
import { SwapParams, Transaction } from '@yaswap/types';
import { Transaction as YacoinTransaction } from '../types';
import { YacoinBaseWalletProvider } from '../wallet/YacoinBaseWallet';
import { YacoinSwapBaseProvider } from './YacoinSwapBaseProvider';
import { YacoinSwapProviderOptions, PaymentVariants, TransactionMatchesFunction } from './types';

export class YacoinSwapEsploraProvider extends YacoinSwapBaseProvider {
    private _httpClient: HttpClient;

    constructor(options: YacoinSwapProviderOptions, walletProvider?: YacoinBaseWalletProvider) {
        super(options, walletProvider);
        this._httpClient = new HttpClient({ baseURL: options.scraperUrl });
    }

    public async findSwapTransaction(swapParams: SwapParams, _blockNumber: number, predicate: TransactionMatchesFunction) {
        const swapOutput: Buffer = this.getSwapOutput(swapParams);
        const paymentVariants: PaymentVariants = this.getSwapPaymentVariants(swapOutput);
        for (const paymentVariant of Object.values(paymentVariants)) {
            const addressTransaction = this.findAddressTransaction(paymentVariant.address, predicate);
            if (addressTransaction) return addressTransaction;
        }
    }

    private async findAddressTransaction(address: string, predicate: TransactionMatchesFunction) {
        // TODO: This does not go through pages as swap addresses have at most 2 transactions
        // Investigate whether retrieving more transactions is required.
        const addressInfo = await this._httpClient.nodeGet(`/ext/getaddress/${address}`);

        try {
            for (const transaction of addressInfo.last_txs) {
                const formattedTransaction: Transaction<YacoinTransaction> = await this.walletProvider
                    .getChainProvider()
                    .getProvider()
                    .getTransaction(transaction.addresses);
                if (predicate(formattedTransaction)) {
                    return formattedTransaction;
                }
            }
        } catch (error) {
            if (['TypeError'].includes(error.name)) throw new PendingTxError(`Transaction not confirmed`);
        }

    }
}
