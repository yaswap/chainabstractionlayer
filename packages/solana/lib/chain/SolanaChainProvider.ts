import { Chain } from '@yaswap/client';
import { BlockNotFoundError, TxNotFoundError, UnsupportedMethodError } from '@yaswap/errors';
import { Logger } from '@yaswap/logger';
import { AddressType, Asset, AssetTypes, BigNumber, Block, FeeDetails, Network, TokenDetails, Transaction } from '@yaswap/types';
import { compare, retry } from '@yaswap/utils';
import { AccountLayout, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { ENV, TokenInfo, TokenListProvider } from '@solana/spl-token-registry';
import { BlockResponse, Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { parseBlockResponse, parseTransactionResponse } from '../utils';

const LAMPORTS_PER_SIGNATURE = 5000 / LAMPORTS_PER_SOL;
const logger = new Logger('SolanaChainProvider');

export class SolanaChainProvider extends Chain<Connection, Network> {
    private tokenList: TokenInfo[];

    constructor(network: Network) {
        super(network);

        if (!this.provider && this.network.rpcUrl) {
            this.provider = new Connection(network.rpcUrl, {
                confirmTransactionInitialTimeout: 120000,
                commitment: 'confirmed',
            });
        }
    }

    public async getTokenDetails(tokenAddress: string): Promise<TokenDetails> {
        if (!this.tokenList) {
            this.tokenList = (await new TokenListProvider().resolve()).filterByChainId(ENV.MainnetBeta).getList();
        }

        const { name, symbol, decimals } = this.tokenList.find((t) => t.address === tokenAddress);

        return { name, symbol, decimals };
    }

    public async getBlockByNumber(blockNumber?: number, includeTx?: boolean): Promise<Block<BlockResponse, Transaction>> {
        return retry(async () => {
            try {
                const block = await this.provider.getBlock(blockNumber);

                if (!includeTx) {
                    return parseBlockResponse(block);
                }

                const txSignatures = block.transactions.map((tx) => tx.transaction.signatures[0]);
                const txDetails = await this.provider.getParsedTransactions(txSignatures);
                const transactions = txDetails.map((tx) => parseTransactionResponse(tx));

                return { ...parseBlockResponse(block), transactions };
            } catch (err) {
                logger.error(err);
                throw new BlockNotFoundError(`Block ${blockNumber} not found`);
            }
        });
    }

    public async getBlockHeight(): Promise<number> {
        return await this.provider.getSlot();
    }

    public async getTransactionByHash(txHash: string): Promise<Transaction> {
        return retry(
            async () => {
                try {
                    const [transaction, signatures] = await Promise.all([
                        this.provider.getParsedTransaction(txHash, 'confirmed'),
                        this.provider.getSignatureStatus(txHash, { searchTransactionHistory: true }),
                    ]);

                    return parseTransactionResponse(transaction, signatures);
                } catch (err) {
                    logger.error(err);
                    throw new TxNotFoundError(`Transaction not found: ${txHash}`);
                }
            },
            500,
            2,
            7
        );
    }

    public async getBalance(addresses: AddressType[], assets: Asset[]): Promise<BigNumber[]> {
        const address = new PublicKey(addresses[0].toString());

        const [nativeBalance, tokenData] = await Promise.all([
            this.provider.getBalance(address),
            this.provider.getTokenAccountsByOwner(address, { programId: TOKEN_PROGRAM_ID }),
        ]);

        const tokenBalances = tokenData.value.map((token) => {
            const { mint, amount } = AccountLayout.decode(token.account.data);
            return { contractAddress: mint.toString(), amount: new BigNumber(amount.toString()) };
        });

        const balances = assets.map((asset) => {
            if (asset.type === AssetTypes.native) {
                return new BigNumber(nativeBalance);
            } else {
                const token = tokenBalances.find((token) => compare(token.contractAddress, asset.contractAddress));

                if (token) {
                    return token.amount;
                } else {
                    return null;
                }
            }
        });

        return balances;
    }

    /**
     * Fee price is fixed in Solana and it's equal to 5000 / LAMPORTS_PER_SOL
     */
    public async getFees(): Promise<FeeDetails> {
        return {
            slow: {
                fee: LAMPORTS_PER_SIGNATURE,
            },
            average: {
                fee: LAMPORTS_PER_SIGNATURE,
            },
            fast: {
                fee: LAMPORTS_PER_SIGNATURE,
            },
        };
    }

    public async sendRawTransaction(rawTransaction: string): Promise<string> {
        const wireTransaciton = Buffer.from(rawTransaction);
        return await this.provider.sendRawTransaction(wireTransaciton);
    }

    public async sendRpcRequest(_method: string, _params: any[]): Promise<void> {
        throw new UnsupportedMethodError('Method not supported for Solana');
    }

    public async getBlockByHash(_blockHash: string): Promise<Block<Block, Transaction>> {
        throw new UnsupportedMethodError('Method not supported for Solana');
    }
}
