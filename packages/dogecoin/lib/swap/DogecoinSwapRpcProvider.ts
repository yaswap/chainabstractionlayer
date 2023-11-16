import { SwapParams, Transaction } from '@yaswap/types';
import { DogecoinBaseChainProvider } from '../chain/DogecoinBaseChainProvider';
import { Transaction as DogecoinTransaction } from '../types';
import { IDogecoinWallet } from '../wallet/IDogecoinWallet';
import { DogecoinSwapBaseProvider } from './DogecoinSwapBaseProvider';
import { DogecoinSwapProviderOptions } from './types';

export class DogecoinSwapRpcProvider extends DogecoinSwapBaseProvider {
    constructor(options: DogecoinSwapProviderOptions, walletProvider?: IDogecoinWallet<DogecoinBaseChainProvider>) {
        super(options, walletProvider);
    }

    public async findSwapTransaction(
        _swapParams: SwapParams,
        blockNumber: number,
        predicate: (tx: Transaction<DogecoinTransaction>) => boolean
    ) {
        // TODO: Are mempool TXs possible?
        const block = await this.walletProvider.getChainProvider().getBlockByNumber(blockNumber, true);
        const swapTransaction = block.transactions.find(predicate);
        return swapTransaction;
    }
}
