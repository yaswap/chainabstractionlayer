import { InvalidSwapParamsError, PendingTxError, TxFailedError, TxNotFoundError, InvalidDestinationAddressError } from '@yaswap/errors';
import { Asset,AssetTypes, BigNumber, FeeType, SwapParams, SwapProvider, Transaction, TxStatus } from '@yaswap/types';
import { sha256, validateExpiration, validateSecretHash, validateValue } from '@yaswap/utils';
import Wallet from './Wallet';

export default abstract class Swap<T, S, WalletProvider extends Wallet<T, S> = Wallet<T, S>> implements SwapProvider {
    protected walletProvider: WalletProvider;

    constructor(walletProvider?: WalletProvider) {
        this.walletProvider = walletProvider;
    }

    public setWallet(wallet: WalletProvider): void {
        this.walletProvider = wallet;
        this.onWalletProviderUpdate(wallet);
    }

    public getWallet(): WalletProvider {
        return this.walletProvider;
    }

    public async doesBalanceMatchValue(contractAddress: string, asset: Asset, value: BigNumber) {
        const balance = await this.walletProvider.getChainProvider().getBalance([contractAddress], [asset])
        return balance[0].isEqualTo(value)
    }

    public async verifyInitiateSwapTransaction(swapParams: SwapParams, initTx: string | Transaction): Promise<boolean> {
        this.validateSwapParams(swapParams);
        const transaction = typeof initTx === 'string' ? await this.walletProvider.getChainProvider().getTransactionByHash(initTx) : initTx;

        if (!transaction) {
            throw new TxNotFoundError(`Transaction not found: ${initTx}`);
        }

        const doesMatch = await this.doesTransactionMatchInitiation(swapParams, transaction);

        if (!(transaction.confirmations > 0)) {
            throw new PendingTxError(`Transaction not confirmed ${transaction.confirmations}`);
        }

        if (transaction.status !== TxStatus.Success) {
            throw new TxFailedError('Transaction not successful');
        }

        if (!doesMatch) {
            throw new InvalidSwapParamsError(`Swap params does not match the transaction`);
        }

        // We need to check ERC20 token balance of atomic swap contract address
        if (swapParams.asset.type === AssetTypes.erc20) {
            const contractHasZeroBalance = await this.doesBalanceMatchValue(
                transaction.contractAddress, // This is atomic swap contract address
                swapParams.asset,
                new BigNumber(swapParams.value)
            )
            if (!contractHasZeroBalance) {
                throw new InvalidDestinationAddressError(`Contract is empty: ${transaction.contractAddress}`)
            }
        }


        return true;
    }

    public validateSwapParams(swapParams: SwapParams): void {
        validateValue(swapParams.value);
        validateSecretHash(swapParams.secretHash);
        validateExpiration(swapParams.expiration);
    }

    public async generateSecret(message: string): Promise<string> {
        const address = await this.walletProvider.getAddress();
        const signedMessage = await this.walletProvider.signMessage(message, address);
        const secret = sha256(signedMessage);
        return secret;
    }

    public abstract initiateSwap(swapParams: SwapParams, fee?: FeeType): Promise<Transaction>;
    public abstract findInitiateSwapTransaction(swapParams: SwapParams, _blockNumber?: number): Promise<Transaction>;
    public abstract fundSwap(swapParams: SwapParams, initiationTxHash: string, fee?: FeeType): Promise<Transaction | null>;
    public abstract findFundSwapTransaction(swapParams: SwapParams, initiationTxHash: string, blockNumber?: number): Promise<Transaction | null>;

    public abstract claimSwap(swapParams: SwapParams, initTx: string, secret: string, fee?: FeeType): Promise<Transaction>;
    public abstract findClaimSwapTransaction(swapParams: SwapParams, initTxHash: string, blockNumber?: number): Promise<Transaction>;

    public abstract refundSwap(swapParams: SwapParams, initTx: string, fee?: FeeType): Promise<Transaction>;
    public abstract findRefundSwapTransaction(swapParams: SwapParams, initiationTxHash: string, blockNumber?: number): Promise<Transaction>;

    public abstract getSwapSecret(claimTxHash: string, initTxHash?: string): Promise<string>;

    public abstract canUpdateFee(): boolean;
    public abstract updateTransactionFee(tx: string | Transaction, newFee: FeeType): Promise<Transaction>;

    protected abstract doesTransactionMatchInitiation(swapParams: SwapParams, transaction: Transaction): Promise<boolean> | boolean;

    protected abstract onWalletProviderUpdate(wallet: WalletProvider): void;
}
