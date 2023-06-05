import { Client } from '@yac-swap/client';
import * as Solana from '@yac-swap/solana';
import { Network, WalletOptions } from '@yac-swap/types';
import { SolanaConfig } from './config';

function getSolanaClient(network: Network) {
    const config = SolanaConfig(network);
    const chainProvider = new Solana.SolanaChainProvider(network);
    const walletProvider = new Solana.SolanaWalletProvider(config.walletOptions as WalletOptions, chainProvider);

    return new Client(chainProvider, walletProvider);
}

export const SolanaClient = getSolanaClient(Solana.SolanaNetworks.solana_testnet);
