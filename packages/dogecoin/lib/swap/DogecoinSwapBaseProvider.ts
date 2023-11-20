import { Swap } from '@yaswap/client';
import { Address, BigNumber, SwapParams, Transaction } from '@yaswap/types';
import { validateExpiration, validateSecret, validateSecretAndHash, validateSecretHash, validateValue } from '@yaswap/utils';
import { Transaction as TransactionDogecoinJs, payments, script as bScript,address as AddressDogecoinJs } from 'bitcoinjs-lib';
import { DogecoinBaseChainProvider } from '../chain/DogecoinBaseChainProvider';
import { DogecoinNetwork, Input, SwapMode, Transaction as DogecoinTransaction } from '../types';
import {
    calculateFee,
    decodeRawTransaction,
    getPubKeyHash,
    normalizeTransactionObject,
    validateAddress,
} from '../utils';
import { IDogecoinWallet } from '../wallet/IDogecoinWallet';
import { DogecoinSwapProviderOptions, TransactionMatchesFunction } from './types';

export abstract class DogecoinSwapBaseProvider extends Swap<DogecoinBaseChainProvider, null, IDogecoinWallet<DogecoinBaseChainProvider>> {
    protected _network: DogecoinNetwork;
    protected _mode: SwapMode;

    constructor(options: DogecoinSwapProviderOptions, walletProvider?: IDogecoinWallet<DogecoinBaseChainProvider>) {
        super(walletProvider);
        const { network, mode = SwapMode.P2SH } = options;
        const swapModes = Object.values(SwapMode);
        if (!swapModes.includes(mode)) {
            throw new Error(`Mode must be one of ${swapModes.join(',')}`);
        }
        this._network = network;
        this._mode = mode;
    }

    public validateSwapParams(swapParams: SwapParams) {
        validateValue(swapParams.value);
        validateAddress(swapParams.recipientAddress, this._network);
        validateAddress(swapParams.refundAddress, this._network);
        validateSecretHash(swapParams.secretHash);
        validateExpiration(swapParams.expiration);
    }

    public async initiateSwap(swapParams: SwapParams, feePerByte: number) {
        this.validateSwapParams(swapParams);

        const swapOutput = this.getSwapOutput(swapParams);
        const address = this.getSwapPaymentVariants(swapOutput)[this._mode].address;

        return this.walletProvider.sendTransaction({
            to: address,
            value: swapParams.value,
            fee: feePerByte,
        });
    }

    public async fundSwap(): Promise<null> {
        return null
    }
    public async findFundSwapTransaction(): Promise<null> {
        return null
    }

    public async claimSwap(swapParams: SwapParams, initiationTxHash: string, secret: string, feePerByte: number) {
        this.validateSwapParams(swapParams);
        validateSecret(secret);
        validateSecretAndHash(secret, swapParams.secretHash);
        await this.verifyInitiateSwapTransaction(swapParams, initiationTxHash);
        return this._redeemSwap(swapParams, initiationTxHash, true, secret, feePerByte);
    }

    public async refundSwap(swapParams: SwapParams, initiationTxHash: string, feePerByte: number) {
        this.validateSwapParams(swapParams);
        await this.verifyInitiateSwapTransaction(swapParams, initiationTxHash);
        return this._redeemSwap(swapParams, initiationTxHash, false, undefined, feePerByte);
    }

    public findInitiateSwapTransaction(swapParams: SwapParams, blockNumber?: number): Promise<Transaction<any>> {
        this.validateSwapParams(swapParams);
        return this.findSwapTransaction(swapParams, blockNumber, (tx: Transaction<DogecoinTransaction>) =>
            this.doesTransactionMatchInitiation(swapParams, tx)
        );
    }

    public async getSwapSecret(claimTxHash: string, initTxHash: string): Promise<string> {
        const claimSwapTransaction: Transaction<DogecoinTransaction> = await this.walletProvider
            .getChainProvider()
            .getTransactionByHash(claimTxHash);

        if (claimSwapTransaction) {
            const swapInput = claimSwapTransaction._raw.vin.find((vin) => vin.txid === initTxHash);
            if (!swapInput) {
                throw new Error('Claim input missing');
            }
            const inputScript = this.getInputScript(swapInput);
            const secret = inputScript[2] as string;
            return secret;
        }
    }

    public async findClaimSwapTransaction(swapParams: SwapParams, initTxHash: string, blockNumber?: number): Promise<Transaction<any>> {
        this.validateSwapParams(swapParams);

        const claimSwapTransaction: Transaction<DogecoinTransaction> = await this.findSwapTransaction(
            swapParams,
            blockNumber,
            (tx: Transaction<DogecoinTransaction>) => this.doesTransactionMatchRedeem(initTxHash, tx, false)
        );

        if (claimSwapTransaction) {
            const swapInput = claimSwapTransaction._raw.vin.find((vin) => vin.txid === initTxHash);
            if (!swapInput) {
                throw new Error('Claim input missing');
            }
            const inputScript = this.getInputScript(swapInput);
            const secret = inputScript[2] as string;
            validateSecretAndHash(secret, swapParams.secretHash);
            return { ...claimSwapTransaction, secret, _raw: claimSwapTransaction };
        }
    }

    public async findRefundSwapTransaction(
        swapParams: SwapParams,
        initiationTxHash: string,
        blockNumber?: number
    ): Promise<Transaction<any>> {
        this.validateSwapParams(swapParams);

        const refundSwapTransaction = await this.findSwapTransaction(swapParams, blockNumber, (tx: Transaction<DogecoinTransaction>) =>
            this.doesTransactionMatchRedeem(initiationTxHash, tx, true)
        );
        return refundSwapTransaction;
    }

    protected onWalletProviderUpdate(_wallet: IDogecoinWallet<DogecoinBaseChainProvider, any>): void {
        // do nothing
    }

    protected getSwapOutput(swapParams: SwapParams) {
        this.validateSwapParams(swapParams);

        const secretHashBuff = Buffer.from(swapParams.secretHash, 'hex');
        const recipientPubKeyHash = getPubKeyHash(swapParams.recipientAddress.toString(), this._network);
        const refundPubKeyHash = getPubKeyHash(swapParams.refundAddress.toString(), this._network);
        const OPS = bScript.OPS;

        const script = bScript.compile([
            OPS.OP_IF,
            OPS.OP_SIZE,
            bScript.number.encode(32),
            OPS.OP_EQUALVERIFY,
            OPS.OP_SHA256,
            secretHashBuff,
            OPS.OP_EQUALVERIFY,
            OPS.OP_DUP,
            OPS.OP_HASH160,
            recipientPubKeyHash,
            OPS.OP_ELSE,
            bScript.number.encode(swapParams.expiration),
            OPS.OP_CHECKLOCKTIMEVERIFY,
            OPS.OP_DROP,
            OPS.OP_DUP,
            OPS.OP_HASH160,
            refundPubKeyHash,
            OPS.OP_ENDIF,
            OPS.OP_EQUALVERIFY,
            OPS.OP_CHECKSIG,
        ]);

        if (![97, 98].includes(Buffer.byteLength(script))) {
            throw new Error('Invalid swap script');
        }

        return script;
    }

    private getSwapInput(sig: Buffer, pubKey: Buffer, isClaim: boolean, secret?: string) {
        const OPS = bScript.OPS;
        const redeem = isClaim ? OPS.OP_TRUE : OPS.OP_FALSE;
        const secretParams = isClaim ? [Buffer.from(secret, 'hex')] : [];
        return bScript.compile([sig, pubKey, ...secretParams, redeem]);
    }

    protected getSwapPaymentVariants(swapOutput: Buffer) {
        const p2sh = payments.p2sh({
            redeem: { output: swapOutput, network: this._network },
            network: this._network,
        });

        return {
            [SwapMode.P2SH]: p2sh,
        };
    }

    private async _redeemSwap(swapParams: SwapParams, initiationTxHash: string, isClaim: boolean, secret: string, feePerByte: number) {
        const address = isClaim ? swapParams.recipientAddress : swapParams.refundAddress;
        const swapOutput = this.getSwapOutput(swapParams);
        return this._redeemSwapOutput(
            initiationTxHash,
            swapParams.value,
            address.toString(),
            swapOutput,
            swapParams.expiration,
            isClaim,
            secret,
            feePerByte
        );
    }

    private async _redeemSwapOutput(
        initiationTxHash: string,
        value: BigNumber,
        address: string,
        swapOutput: Buffer,
        expiration: number,
        isClaim: boolean,
        secret: string,
        _feePerByte: number
    ) {
        const network = this._network;
        const swapPaymentVariants = this.getSwapPaymentVariants(swapOutput);

        const initiationTxRaw = await this.walletProvider.getChainProvider().getProvider().getRawTransactionByHash(initiationTxHash);
        const initiationTx = decodeRawTransaction(initiationTxRaw, this._network);

        let swapVout;
        let paymentVariant: payments.Payment;
        for (const vout of initiationTx.vout) {
            const paymentVariantEntry = Object.entries(swapPaymentVariants).find(
                ([, payment]) => payment.output.toString('hex') === vout.scriptPubKey.hex
            );
            const voutValue = new BigNumber(vout.value).times(1e8);
            if (paymentVariantEntry && voutValue.eq(new BigNumber(value))) {
                paymentVariant = paymentVariantEntry[1];
                swapVout = vout;
            }
        }

        if (!swapVout) {
            throw new Error('Valid swap output not found');
        }

        const feePerByte = _feePerByte || (await this.walletProvider.getChainProvider().getProvider().getFeePerByte());

        // TODO: Implement proper fee calculation that counts bytes in inputs and outputs
        const txfee = calculateFee(1, 1, feePerByte);
        const swapValue = new BigNumber(swapVout.value).times(1e8).toNumber();

        if (swapValue - txfee < 0) {
            throw new Error('Transaction amount does not cover fee.');
        }

        // BEGIN CHANGE
        const hashType = TransactionDogecoinJs.SIGHASH_ALL
        const redeemScript = paymentVariant.redeem.output

        var tx = new TransactionDogecoinJs()

        if (!isClaim) {
          tx.locktime = expiration
        }
        tx.addInput(Buffer.from(initiationTxHash, 'hex').reverse(), swapVout.n, 0)
        tx.addOutput(AddressDogecoinJs.toOutputScript(address, network), swapValue - txfee)
        let signatureHash = tx.hashForSignature(0, redeemScript, hashType)

        // Sign transaction
        const walletAddress: Address = await this.walletProvider.getWalletAddress(address);
        const signedSignatureHash = await this.walletProvider.signTx(tx.toHex(), signatureHash.toString('hex'), walletAddress.derivationPath, txfee)
        const swapInput = this.getSwapInput(
          bScript.signature.encode(Buffer.from(signedSignatureHash, 'hex'), hashType),
          Buffer.from(walletAddress.publicKey, 'hex'),
          isClaim,
          secret
        )

        const redeemScriptSig = payments.p2sh({
          network: network,
          redeem: {
            network: network,
            output: redeemScript,
            input: swapInput
          }
        }).input
        tx.setInputScript(0, redeemScriptSig)
        // END CHANGE

        const hex = tx.toHex();
        await this.walletProvider.getChainProvider().sendRawTransaction(hex);
        return normalizeTransactionObject(decodeRawTransaction(hex, this._network), txfee);
    }

    protected extractSwapParams(outputScript: string) {
        const buffer = bScript.decompile(Buffer.from(outputScript, 'hex')) as Buffer[];
        if (buffer.length !== 20) {
            throw new Error('Invalid swap output script');
        }
        const secretHash = buffer[5].reverse().toString('hex');
        const recipientPublicKey = buffer[9].reverse().toString('hex');
        const expiration = parseInt(buffer[11].reverse().toString('hex'), 16);
        const refundPublicKey = buffer[16].reverse().toString('hex');
        return { recipientPublicKey, refundPublicKey, secretHash, expiration };
    }

    /**
     * Only to be used for situations where transaction is trusted. e.g to bump fee
     * DO NOT USE THIS TO VERIFY THE REDEEM
     */
    private async UNSAFE_isSwapRedeemTransaction(transaction: Transaction<DogecoinTransaction>) {
        // eslint-disable-line
        if (transaction._raw.vin.length === 1 && transaction._raw.vout.length === 1) {
            const swapInput = transaction._raw.vin[0];
            const inputScript = this.getInputScript(swapInput);
            const initiationTransaction: Transaction<DogecoinTransaction> = await this.walletProvider
                .getChainProvider()
                .getTransactionByHash(transaction._raw.vin[0].txid);
            const scriptType = initiationTransaction._raw.vout[transaction._raw.vin[0].vout].scriptPubKey.type;
            if (['scripthash', 'witness_v0_scripthash'].includes(scriptType) && [4, 5].includes(inputScript.length)) return true;
        }
        return false;
    }

    public canUpdateFee(): boolean {
        return true;
    }

    public async updateTransactionFee(tx: Transaction<DogecoinTransaction> | string, newFeePerByte: number) {
        const txHash = typeof tx === 'string' ? tx : tx.hash;
        const transaction: Transaction<DogecoinTransaction> = await this.walletProvider.getChainProvider().getTransactionByHash(txHash);
        if (await this.UNSAFE_isSwapRedeemTransaction(transaction)) {
            const swapInput = transaction._raw.vin[0];
            const inputScript = this.getInputScript(swapInput);
            const initiationTxHash = swapInput.txid;
            const initiationTx: Transaction<DogecoinTransaction> = await this.walletProvider
                .getChainProvider()
                .getTransactionByHash(initiationTxHash);
            const swapOutput = initiationTx._raw.vout[swapInput.vout];
            const value = new BigNumber(swapOutput.value).times(1e8);
            const address = transaction._raw.vout[0].scriptPubKey.addresses[0];
            const isClaim = inputScript.length === 5;
            const secret = isClaim ? inputScript[2] : undefined;
            const outputScript = isClaim ? inputScript[4] : inputScript[3];
            const { expiration } = this.extractSwapParams(outputScript);
            return this._redeemSwapOutput(
                initiationTxHash,
                value,
                address,
                Buffer.from(outputScript, 'hex'),
                expiration,
                isClaim,
                secret,
                newFeePerByte
            );
        }
        return this.walletProvider.updateTransactionFee(tx, newFeePerByte);
    }

    protected getInputScript(vin: Input) {
        const inputScript = bScript
        .decompile(Buffer.from(vin.scriptSig.hex, 'hex'))
        .map((b) => (Buffer.isBuffer(b) ? b.toString('hex') : b))
        return inputScript as string[]
    }

    protected doesTransactionMatchRedeem(initiationTxHash: string, tx: Transaction<DogecoinTransaction>, isRefund: boolean) {
        const swapInput = tx._raw.vin.find((vin) => vin.txid === initiationTxHash);
        if (!swapInput) return false;
        const inputScript = this.getInputScript(swapInput);
        if (!inputScript) return false;
        if (isRefund) {
            if (inputScript.length !== 4) return false; // 4 because there are 4 parameters: signature, pubkey, false, original redeemscript
        } else {
            if (inputScript.length !== 5) return false; // 5 because there are 5 parameters: signature, pubkey, secretHash, true, original redeemscript
        }
        return true;
    }

    protected doesTransactionMatchInitiation(swapParams: SwapParams, transaction: Transaction<DogecoinTransaction>) {
        const swapOutput = this.getSwapOutput(swapParams);
        const swapPaymentVariants = this.getSwapPaymentVariants(swapOutput);
        const vout = transaction._raw.vout.find((vout) =>
            Object.values(swapPaymentVariants).find(
                (payment) =>
                    payment.output.toString('hex') === vout.scriptPubKey.hex &&
                    new BigNumber(vout.value).times(1e8).eq(new BigNumber(swapParams.value))
            )
        );
        return Boolean(vout);
    }

    protected abstract findSwapTransaction(
        swapParams: SwapParams,
        blockNumber: number,
        predicate: TransactionMatchesFunction
    ): Promise<Transaction<DogecoinTransaction>>;
}
