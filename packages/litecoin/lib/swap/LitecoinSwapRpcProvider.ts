import { SwapParams, Transaction } from '@yaswap/types';
import { LitecoinBaseChainProvider } from '../chain/LitecoinBaseChainProvider';
import { Transaction as LitecoinTransaction } from '../types';
import { ILitecoinWallet } from '../wallet/ILitecoinWallet';
import { LitecoinSwapBaseProvider } from './LitecoinSwapBaseProvider';
import { LitecoinSwapProviderOptions } from './types';

export class LitecoinSwapRpcProvider extends LitecoinSwapBaseProvider {
    constructor(options: LitecoinSwapProviderOptions, walletProvider?: ILitecoinWallet<LitecoinBaseChainProvider>) {
        super(options, walletProvider);
    }

    public async findSwapTransaction(
        _swapParams: SwapParams,
        blockNumber: number,
        predicate: (tx: Transaction<LitecoinTransaction>) => boolean
    ) {
        // TODO: Are mempool TXs possible?
        const block = await this.walletProvider.getChainProvider().getBlockByNumber(blockNumber, true);
        const swapTransaction = block.transactions.find(predicate);
        return swapTransaction;
    }
}
