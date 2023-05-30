import { Swap } from '@chainify/client';
import { TxNotFoundError, TxFailedError, PendingTxError, UnimplementedMethodError, InvalidDestinationAddressError } from '@chainify/errors';
import { AssetTypes, FeeType, SwapParams, Transaction, TxStatus, BigNumber } from '@chainify/types';
import { padHexStart } from '@chainify/utils';
import { ensure0x, remove0x, validateSecret, validateSecretAndHash } from '@chainify/utils';
import { Signer } from '@ethersproject/abstract-signer';
import { BaseProvider, Log } from '@ethersproject/providers';
import { LiqualityHTLC } from '../typechain';
import { ClaimEvent, RefundEvent } from '../typechain/LiqualityHTLC';
import { EthersTransactionResponse, EvmSwapOptions, ScraperTransaction } from '../types';
import { toEthersBigNumber, toEthereumTxRequest, hexToNumber } from '../utils';
import { EvmBaseWalletProvider } from '../wallet/EvmBaseWalletProvider';

// FOR ERC20 claim events
const SOL_CLAIM_FUNCTION = '0xbd66528a' // claim(bytes32)
const SOL_REFUND_FUNCTION = '0x590e1ae3' // refund()

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

    public createERC20SwapScript(swapParams: SwapParams) {
        this.validateSwapParams(swapParams)
    
        const recipientAddress = remove0x(swapParams.recipientAddress.toString())
        const refundAddress = remove0x(swapParams.refundAddress.toString())
        const expirationEncoded = padHexStart(swapParams.expiration.toString(16), 32)
        const tokenAddress = remove0x(swapParams.asset.contractAddress)
    
        const bytecode = [
          '6080604052600080546001600160a01b031990811673',
          recipientAddress,
          '1790915560018054821673',
          refundAddress,
          '17905560028054821673',
          tokenAddress,
          '1790819055600380549092166001600160a01b03919091161790557f',
          swapParams.secretHash,
          '6004553480156100b157600080fd5b50610555806100c16000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c8063590e1ae31461003b578063bd66528a14610045575b600080fd5b610043610062565b005b6100436004803603602081101561005b57600080fd5b5035610235565b6004361461006f57600080fd5b7f',
          expirationEncoded,
          '421161009b57600080fd5b600354604080516370a0823160e01b815230600482015290516000926001600160a01b0316916370a08231916024808301926020929190829003018186803b1580156100e657600080fd5b505afa1580156100fa573d6000803e3d6000fd5b505050506040513d602081101561011057600080fd5b505190508061011e57600080fd5b600154600354604080516370a0823160e01b815230600482015290516101fe9363a9059cbb60e01b936001600160a01b03918216939116916370a0823191602480820192602092909190829003018186803b15801561017c57600080fd5b505afa158015610190573d6000803e3d6000fd5b505050506040513d60208110156101a657600080fd5b5051604080516001600160a01b0390931660248401526044808401929092528051808403909201825260649092019091526020810180516001600160e01b03166001600160e01b03199093169290921790915261040d565b6040517f5d26862916391bf49478b2f5103b0720a842b45ef145a268f2cd1fb2aed5517890600090a16001546001600160a01b0316ff5b6024361461024257600080fd5b600454600282604051602001808281526020019150506040516020818303038152906040526040518082805190602001908083835b602083106102965780518252601f199092019160209182019101610277565b51815160209384036101000a60001901801990921691161790526040519190930194509192505080830381855afa1580156102d5573d6000803e3d6000fd5b5050506040513d60208110156102ea57600080fd5b5051146102f657600080fd5b600354604080516370a0823160e01b815230600482015290516000926001600160a01b0316916370a08231916024808301926020929190829003018186803b15801561034157600080fd5b505afa158015610355573d6000803e3d6000fd5b505050506040513d602081101561036b57600080fd5b505190508061037957600080fd5b600054604080516001600160a01b039092166024830152604480830184905281518084039091018152606490920190526020810180516001600160e01b031663a9059cbb60e01b1790526103cc9061040d565b6040805183815290517f8c1d64e3bd87387709175b9ef4e7a1d7a8364559fc0e2ad9d77953909a0d1eb39181900360200190a16000546001600160a01b0316ff5b600061041882610446565b8051909150156104425780806020019051602081101561043757600080fd5b505161044257600080fd5b5050565b600254604051825160609260009283926001600160a01b0390921691869190819060208401908083835b6020831061048f5780518252601f199092019160209182019101610470565b6001836020036101000a0380198251168184511680821785525050505050509050019150506000604051808303816000865af19150503d80600081146104f1576040519150601f19603f3d011682016040523d82523d6000602084013e6104f6565b606091505b5091509150811561050a57915061051a9050565b8051156100365780518082602001fd5b91905056fea2646970667358221220439a725cbd518d89b852af5b7e1c335cc4ba64e029f96f6c702b2e60fb985ba564736f6c63430007060033'
        ]
          .join('')
          .toLowerCase()
    
        if (Buffer.byteLength(bytecode) !== 3116) {
          throw new Error('Invalid swap script. Bytecode length incorrect.')
        }
    
        return bytecode
    }

    public createNativeSwapScript(swapParams: SwapParams) {
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
        console.log('TACA ===> [chainify] EvmBaseSwapProvider.ts, initiateSwap, swapParams = ', swapParams)
        this.validateSwapParams(swapParams);
        // ORIGINAL
        // const parsedSwapParams = parseSwapParams(swapParams);
        // const value = swapParams.asset.type === AssetTypes.native ? parsedSwapParams.amount : 0;
        // const tx = await this.contract.populateTransaction.initiate(parsedSwapParams, { value });
        // const estimatedGasLimit = await this.contract.estimateGas.initiate(parsedSwapParams, { value });
        // return await this.walletProvider.sendTransaction(
        //     toEthereumTxRequest({ ...tx, gasLimit: calculateGasMargin(estimatedGasLimit) }, fee)
        // );

        let bytecode: string;
        if (swapParams.asset.type === AssetTypes.erc20) {
            bytecode = this.createERC20SwapScript(swapParams)
        } else {
            bytecode = this.createNativeSwapScript(swapParams)
        }

        // return this.walletProvider.sendTransaction({
        //     to: address,
        //     value: swapParams.value,
        //     fee: feePerByte,
        // });

        return await this.walletProvider.sendTransaction(
            toEthereumTxRequest({ to: null, value: toEthersBigNumber(0), data: bytecode }, fee)
        );
    }

    public async fundSwap(swapParams: SwapParams, initiationTxHash: string, gasPrice?: FeeType) {
        this.validateSwapParams(swapParams)
    
        const initiationTransaction = await this.walletProvider.getChainProvider().getTransactionByHash(initiationTxHash);
        if (!initiationTransaction) throw new TxNotFoundError(`Transaction not found: ${initiationTxHash}`)
    
        if (initiationTransaction.status === TxStatus.Pending) {
            throw new PendingTxError(`Transaction receipt is not available: ${initiationTxHash}`)
        }
    
        const initiationSuccessful = initiationTransaction.contractAddress && initiationTransaction.status === TxStatus.Success
        if (!initiationSuccessful) {
          throw new TxFailedError(
            `ERC20 swap initiation transaction failed: ${initiationTxHash}`
          )
        }
    
        const transactionMatchesSwapParams = this.doesTransactionMatchInitiation(swapParams, initiationTransaction)
    
        if (!transactionMatchesSwapParams) {
          throw new InvalidDestinationAddressError(
            `Contract creation does not match initiation parameters: ${initiationTxHash}`
          )
        }
    
        // We need to check ERC20 token balance of atomic swap contract address
        const contractHasZeroBalance = await this.doesBalanceMatchValue(
            initiationTransaction.contractAddress, // This is atomic swap contract address
            swapParams.asset,
            new BigNumber(0) // 0 because we haven't funded this atomic swap contract address
        )
        if (!contractHasZeroBalance) {
          throw new InvalidDestinationAddressError(`Contract is not empty: ${initiationTransaction.contractAddress}`)
        }

        return await this.walletProvider.sendTransaction({
            to: initiationTransaction.contractAddress,
            value: new BigNumber(swapParams.value),
            fee: gasPrice,
            asset: swapParams.asset
        })
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

        switch (transaction.status) {
            case TxStatus.Success:
                break
            case TxStatus.Pending:
                throw new PendingTxError(`Transaction receipt is not available: ${initTxHash}`)
            default:
                throw new TxFailedError(`Transaction failed: ${initTxHash}`);
        }
        // TODO
        // await this.getMethod('assertContractExists')(initiationTransactionReceipt.contractAddress)

        let secret0x: string;
        // HANDLE ERC20 token
        if (swapParams.asset.type === AssetTypes.erc20) {
            secret0x = SOL_CLAIM_FUNCTION + secret;
        } else {
            secret0x = ensure0x(secret);
        }

        console.log('TACA ===> [chainify] EvmBaseSwapProvider.ts, claimSwap, secret0x = ', secret0x)

        return await this.walletProvider.sendTransaction(
            toEthereumTxRequest({ to: transaction.contractAddress, value: toEthersBigNumber(0), data: secret0x }, fee)
        );
    }

    public async refundSwap(swapParams: SwapParams, initTxHash: string, fee: FeeType): Promise<Transaction<EthersTransactionResponse>> {
        const transaction = await this.walletProvider.getChainProvider().getTransactionByHash(initTxHash);

        await this.verifyInitiateSwapTransaction(swapParams, transaction);

        switch (transaction.status) {
            case TxStatus.Success:
                break
            case TxStatus.Pending:
                throw new PendingTxError(`Transaction receipt is not available: ${initTxHash}`)
            default:
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
        // HANDLE ERC20 token
        return await this.walletProvider.sendTransaction(
            toEthereumTxRequest({
                to: transaction.contractAddress,
                value: toEthersBigNumber(0),
                data: swapParams.asset.type === AssetTypes.erc20 ? SOL_REFUND_FUNCTION : ''
            }, fee)
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

    protected doesERC20TransactionMatchInitiation(swapParams: SwapParams, transaction: Transaction<any>) {
        console.log("TACA ===> EvmBaseSwapProvider.ts, doesERC20TransactionMatchInitiation, swapParams = ", swapParams)
        const data = this.createERC20SwapScript(swapParams)
        const inputData = transaction._raw.input || transaction._raw.data
        console.log("TACA ===> EvmBaseSwapProvider.ts, doesERC20TransactionMatchInitiation, transaction = ", transaction)
        console.log("TACA ===> EvmBaseSwapProvider.ts, doesERC20TransactionMatchInitiation, data = ", data)
        return transaction._raw.to === null && inputData === ensure0x(data)
    }

    protected doesTransactionMatchInitiation(swapParams: SwapParams, transaction: Transaction<any>) {
        // Handle ERC20 token
        if (swapParams.asset.type === AssetTypes.erc20) {
            return this.doesERC20TransactionMatchInitiation(swapParams, transaction)
        } else {
            console.log("TACA ===> EvmBaseSwapProvider.ts, doesTransactionMatchInitiation, swapParams = ", swapParams)
            console.log("TACA ===> EvmBaseSwapProvider.ts, doesTransactionMatchInitiation, transaction = ", transaction)
            const data = this.createNativeSwapScript(swapParams)

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

    abstract findFundSwapTransaction(swapParams: SwapParams, initiationTxHash: string, blockNumber?: number): Promise<Transaction | null>;

    abstract findRefundSwapTransaction(swapParams: SwapParams, initTxHash: string, blockNumber?: number): Promise<Transaction<RefundEvent>>;

    abstract findClaimSwapTransaction(swapParams: SwapParams, initTxHash: string, _blockNumber?: number): Promise<Transaction<ClaimEvent>>;
}
