import { Swap } from '@chainify/client';
import { TxNotFoundError, TxFailedError, UnimplementedMethodError } from '@chainify/errors';
import { FeeType, SwapParams, Transaction, TxStatus } from '@chainify/types';
import { padHexStart } from '@chainify/utils';
import { ensure0x, remove0x, validateSecret, validateSecretAndHash } from '@chainify/utils';
import { Signer } from '@ethersproject/abstract-signer';
import { BaseProvider, Log } from '@ethersproject/providers';
import { LiqualityHTLC } from '../typechain';
import { ClaimEvent, RefundEvent } from '../typechain/LiqualityHTLC';
import { EthersTransactionResponse, EvmSwapOptions, ScraperTransaction } from '../types';
import { toEthersBigNumber, toEthereumTxRequest, hexToNumber } from '../utils';
import { EvmBaseWalletProvider } from '../wallet/EvmBaseWalletProvider';

export abstract class EvmBaseSwapProvider extends Swap<BaseProvider, Signer, EvmBaseWalletProvider<BaseProvider>> {
    protected walletProvider: EvmBaseWalletProvider<BaseProvider>;
    protected contract: LiqualityHTLC;
    protected swapOptions: EvmSwapOptions;

    constructor(swapOptions?: EvmSwapOptions, walletProvider?: EvmBaseWalletProvider<BaseProvider>) {
        super(walletProvider);

        // this.swapOptions = {
        //     ...swapOptions,
        //     contractAddress: swapOptions?.contractAddress || '0x133713376F69C1A67d7f3594583349DFB53d8166',
        //     numberOfBlocksPerRequest: swapOptions?.numberOfBlocksPerRequest || 2000,
        //     totalNumberOfBlocks: swapOptions?.totalNumberOfBlocks || 100_000,
        //     gasLimitMargin: swapOptions?.gasLimitMargin || 1000, // 10%
        // };

        // if (walletProvider) {
        //     this.contract = LiqualityHTLC__factory.connect(this.swapOptions.contractAddress, this.walletProvider.getSigner());
        // }
    }

    public createSwapScript(swapParams: SwapParams) {
        this.validateSwapParams(swapParams)

        const recipientAddress = remove0x(swapParams.recipientAddress.toString())
        const refundAddress = remove0x(swapParams.refundAddress.toString())

        const expirationHex = swapParams.expiration.toString(16)
        const expirationSize = 5
        const expirationEncoded = padHexStart(expirationHex, expirationSize) // Pad with 0. string length

        const bytecode = [
            // Constructor
            '60',
            'c9', // PUSH1 {contractSize}
            '80', // DUP1
            '60',
            '0b', // PUSH1 0b
            '60',
            '00', // PUSH1 00
            '39', // CODECOPY
            '60',
            '00', // PUSH1 00
            'f3', // RETURN

            // Contract
            '60',
            '20', // PUSH1 20

            // Get secret
            '80', // DUP1
            '60',
            '00', // PUSH1 00
            '80', // DUP1
            '37', // CALLDATACOPY

            // SHA256
            '60',
            '21', // PUSH1 21
            '81', // DUP2
            '60',
            '00', // PUSH1 00
            '80', // DUP1
            '60',
            '02', // PUSH1 02
            '61',
            'ffff', //PUSH ffff gas units for sha256 execution
            'f1', // CALL

            // Validate input size
            '36', // CALLDATASIZE
            '60',
            '20', // PUSH1 20 (32 bytes)
            '14', // EQ
            '16', // AND (input valid size AND sha256 success)

            // Validate with secretHash
            '7f',
            swapParams.secretHash, // PUSH32 {secretHashEncoded}
            '60',
            '21', // PUSH1 21
            '51', // MLOAD
            '14', // EQ
            '16', // AND (input valid size AND sha256 success) AND secret valid
            // Redeem if secret is valid
            '60',
            '50', // PUSH1 {redeemDestination}
            '57', // JUMPI

            // Validate input size
            '36', // CALLDATASIZE
            '15', // ISZERO (input empty)
            // Check time lock
            '64',
            expirationEncoded, // PUSH5 {expirationEncoded}
            '42', // TIMESTAMP
            '11', // GT
            '16', // AND (input size 0 AND time lock expired)
            // Refund if timelock passed
            '60',
            '8d', // PUSH1 {refundDestination}
            '57',

            'fe', // INVALID

            '5b', // JUMPDEST
            // emit Claim(bytes32 _secret)
            '7f',
            '8c1d64e3bd87387709175b9ef4e7a1d7a8364559fc0e2ad9d77953909a0d1eb3', // PUSH32 topic Keccak-256(Claim(bytes32))
            '60',
            '20', // PUSH1 20 (log length - 32)
            '60',
            '00', // PUSH1 00 (log offset - 0)
            'a1', // LOG 1
            '73',
            recipientAddress, // PUSH20 {recipientAddressEncoded}
            'ff', // SELF-DESTRUCT

            '5b', // JUMPDEST
            // emit Refund()
            '7f',
            '5d26862916391bf49478b2f5103b0720a842b45ef145a268f2cd1fb2aed55178', // PUSH32 topic Keccak-256(Refund())
            '60',
            '00', // PUSH1 00 (log length - 0)
            '80', // DUP 1 (log offset)
            'a1', // LOG 1
            '73',
            refundAddress, // PUSH20 {refundAddressEncoded}
            'ff' // SELF-DESTRUCT
        ]
            .join('')
            .toLowerCase()

        if (Buffer.byteLength(bytecode) !== 424) {
            throw new Error('Invalid swap script. Bytecode length incorrect.')
        }

        return bytecode
    }

    public async initiateSwap(swapParams: SwapParams, fee: FeeType): Promise<Transaction<EthersTransactionResponse>> {
        this.validateSwapParams(swapParams);
        // ORIGINAL
        // const parsedSwapParams = parseSwapParams(swapParams);
        // const value = swapParams.asset.type === AssetTypes.native ? parsedSwapParams.amount : 0;
        // const tx = await this.contract.populateTransaction.initiate(parsedSwapParams, { value });
        // const estimatedGasLimit = await this.contract.estimateGas.initiate(parsedSwapParams, { value });
        // return await this.walletProvider.sendTransaction(
        //     toEthereumTxRequest({ ...tx, gasLimit: calculateGasMargin(estimatedGasLimit) }, fee)
        // );

        const bytecode = this.createSwapScript(swapParams)

        // return this.walletProvider.sendTransaction({
        //     to: address,
        //     value: swapParams.value,
        //     fee: feePerByte,
        // });

        return await this.walletProvider.sendTransaction(
            toEthereumTxRequest({ to: null, value: toEthersBigNumber(swapParams.value), data: bytecode }, fee)
        );
    }

    public async claimSwap(
        swapParams: SwapParams,
        initTxHash: string,
        secret: string,
        fee: FeeType
    ): Promise<Transaction<EthersTransactionResponse>> {
        validateSecret(secret);
        validateSecretAndHash(secret, swapParams.secretHash);

        const transaction = await this.walletProvider.getChainProvider().getTransactionByHash(initTxHash);
        await this.verifyInitiateSwapTransaction(swapParams, transaction);

        if (transaction.status !== TxStatus.Success) {
            throw new TxFailedError(`Transaction failed: ${initTxHash}`);
        }
        // TODO
        // await this.getMethod('assertContractExists')(initiationTransactionReceipt.contractAddress)

        // if (transaction?.logs) {
        //     for (const log of transaction.logs as Log[]) {
        //         const initiate = this.tryParseLog(log);

        //         if (initiate?.args?.id) {
        //             const secret0x = ensure0x(secret);
        //             const tx = await this.contract.populateTransaction.claim(initiate.args.id, secret0x);
        //             const estimatedGasLimit = await this.contract.estimateGas.claim(initiate.args.id, secret0x);
        //             const txResponse = await this.walletProvider.sendTransaction(
        //                 toEthereumTxRequest(
        //                     { ...tx, gasLimit: calculateGasMargin(estimatedGasLimit) },
        //                     fee
        //                 )
        //             );
        //             return txResponse;
        //         }
        //     }
        // }
        const secret0x = ensure0x(secret);
        return await this.walletProvider.sendTransaction(
            toEthereumTxRequest({ to: transaction.contractAddress, value: toEthersBigNumber(0), data: secret0x }, fee)
        );
    }

    public async refundSwap(swapParams: SwapParams, initTxHash: string, fee: FeeType): Promise<Transaction<EthersTransactionResponse>> {
        const transaction = await this.walletProvider.getChainProvider().getTransactionByHash(initTxHash);

        await this.verifyInitiateSwapTransaction(swapParams, transaction);

        if (transaction.status !== TxStatus.Success) {
            throw new TxFailedError(`Transaction failed: ${initTxHash}`);
        }

        // if (transaction?.logs) {
        //     for (const log of transaction.logs as Log[]) {
        //         const initiate = this.tryParseLog(log);

        //         if (initiate?.args?.id) {
        //             const tx = await this.contract.populateTransaction.refund(initiate.args.id);
        //             const estimatedGasLimit = await this.contract.estimateGas.refund(initiate.args.id);
        //             const txResponse = await this.walletProvider.sendTransaction(
        //                 toEthereumTxRequest(
        //                     { ...tx, gasLimit: calculateGasMargin(estimatedGasLimit) },
        //                     fee
        //                 )
        //             );
        //             return txResponse;
        //         }
        //     }
        // }
        return await this.walletProvider.sendTransaction(
            toEthereumTxRequest({ to: transaction.contractAddress, value: toEthersBigNumber(0), data: '' }, fee)
        );
    }

    public async getSwapSecret(claimTx: string): Promise<string> {
        const transaction: Transaction<ClaimEvent> = await this.walletProvider.getChainProvider().getTransactionByHash(claimTx);

        if (!transaction) {
            throw new TxNotFoundError(`Transaction not found: ${claimTx}`);
        }

        if (transaction?.logs) {
            for (const log of transaction.logs as Log[]) {
                const claim = this.tryParseLog(log);
                if (claim?.args?.id && claim.args.secret) {
                    return remove0x(claim.args.secret);
                }
            }
        }
    }

    public canUpdateFee(): boolean {
        return false;
    }

    public updateTransactionFee(_tx: string | Transaction<any>, _newFee: FeeType): Promise<Transaction> {
        throw new UnimplementedMethodError('Method not supported.');
    }

    protected onWalletProviderUpdate(wallet: EvmBaseWalletProvider<BaseProvider, Signer>): void {
        // this.contract = LiqualityHTLC__factory.connect(this.swapOptions.contractAddress, wallet.getSigner());
        // do nothing
    }

    // protected doesTransactionMatchInitiation(swapParams: SwapParams, transaction: Transaction<InitiateEvent>): boolean {
    //     let htlcArgs = transaction?._raw?.args;

    //     if (!htlcArgs) {
    //         if (transaction?.logs) {
    //             for (const log of transaction.logs as Log[]) {
    //                 const initiate = this.tryParseLog(log);
    //                 if (initiate) {
    //                     htlcArgs = initiate.args as any;
    //                 }
    //             }
    //         }
    //     }

    //     if (htlcArgs) {
    //         return (
    //             Math.eq(htlcArgs.htlc.amount, swapParams.value) &&
    //             Math.eq(htlcArgs.htlc.expiration, swapParams.expiration) &&
    //             compare(htlcArgs.htlc.recipientAddress, ensure0x(swapParams.recipientAddress.toString())) &&
    //             compare(htlcArgs.htlc.refundAddress, ensure0x(swapParams.refundAddress.toString())) &&
    //             compare(
    //                 htlcArgs.htlc.tokenAddress,
    //                 swapParams.asset.type === AssetTypes.native ? AddressZero : swapParams.asset.contractAddress
    //             ) &&
    //             compare(ensure0x(htlcArgs.htlc.secretHash), ensure0x(swapParams.secretHash))
    //         );
    //     }
    // }

    protected doesTransactionMatchInitiation(swapParams: SwapParams, transaction: Transaction<any>) {
        console.log("TACA ===> EvmBaseSwapProvider.ts, doesTransactionMatchInitiation, swapParams = ", swapParams)
        console.log("TACA ===> EvmBaseSwapProvider.ts, doesTransactionMatchInitiation, transaction = ", transaction)
        const data = this.createSwapScript(swapParams)

        let input = transaction._raw.input
        let value = hexToNumber(transaction._raw.value)
        // Convert from EthersTransactionResponse to ScraperTransaction
        if (!transaction._raw.input && transaction._raw.data) {
            console.log("TACA ===> EvmBaseSwapProvider.ts, doesTransactionMatchInitiation, typeof transaction._raw.data = ", typeof transaction._raw.data)
            input = transaction.data
            value = transaction.value
            console.log("TACA ===> EvmBaseSwapProvider.ts, doesTransactionMatchInitiation, typeof input = ", typeof input)
            console.log("TACA ===> EvmBaseSwapProvider.ts, doesTransactionMatchInitiation, input = ", input)
        }

        return (
          transaction._raw.to === null &&
          remove0x(input) === data &&
          swapParams.value.eq(value)
        )
    }

    protected tryParseLog(log: Log) {
        try {
            return this.contract.interface.parseLog(log);
        } catch (err) {
            if (err.code === 'INVALID_ARGUMENT' && err.argument === 'topichash') {
                return null;
            } else {
                throw err;
            }
        }
    }

    abstract findInitiateSwapTransaction(swapParams: SwapParams, _blockNumber?: number): Promise<Transaction<ScraperTransaction>>;

    abstract findRefundSwapTransaction(swapParams: SwapParams, initTxHash: string, blockNumber?: number): Promise<Transaction<RefundEvent>>;

    abstract findClaimSwapTransaction(swapParams: SwapParams, initTxHash: string, _blockNumber?: number): Promise<Transaction<ClaimEvent>>;
}
