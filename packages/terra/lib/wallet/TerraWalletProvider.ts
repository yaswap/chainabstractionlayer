import { Wallet } from '@yaswap/client';
import { UnimplementedMethodError } from '@yaswap/errors';
import { Address, Asset, AssetTypes, BigNumber, FeeType, Transaction, TransactionRequest, CreateTokenTransaction } from '@yaswap/types';
import { retry } from '@yaswap/utils';
import {
    Coin,
    Coins,
    CreateTxOptions,
    Fee,
    isTxError,
    LCDClient,
    MnemonicKey,
    Msg,
    MsgExecuteContract,
    MsgSend,
    Tx,
    Wallet as TerraWallet,
} from '@terra-money/terra.js';
import { TerraChainProvider } from '..';
import { assetCodeToDenom, DEFAULT_GAS_ADJUSTMENT } from '../constants';
import { TerraNetwork, TerraTxInfo, TerraTxRequest, TerraWalletProviderOptions } from '../types';

export class TerraWalletProvider extends Wallet<LCDClient, MnemonicKey> {
    protected signer: MnemonicKey;

    private _derivationPath: string;
    private _mnemonic: string;
    private _addressCache: { [key: string]: Address };
    private _wallet: TerraWallet;
    private _gasAdjustment: number;

    constructor(walletOptions: TerraWalletProviderOptions, chainProvider?: TerraChainProvider) {
        const { mnemonic, derivationPath, gasAdjustment = DEFAULT_GAS_ADJUSTMENT } = walletOptions;
        super(chainProvider);
        this.signer = new MnemonicKey({ mnemonic });

        this._derivationPath = derivationPath;
        this._mnemonic = mnemonic;
        this._addressCache = {};
        this._wallet = this.chainProvider
            ? new TerraWallet(this.chainProvider.getProvider(), this.signer)
            : new TerraWallet(null, this.signer);
        this._gasAdjustment = gasAdjustment;
    }

    public async exportPrivateKey() {
        return this.signer.privateKey.toString('hex');
    }

    public async isWalletAvailable(): Promise<boolean> {
        const addresses = await this.getAddresses();
        return addresses.length > 0;
    }

    public async getAddress(): Promise<Address> {
        if (this._addressCache[this._mnemonic]) {
            return this._addressCache[this._mnemonic];
        }

        const wallet = new MnemonicKey({ mnemonic: this._mnemonic });

        const result = new Address({
            address: wallet.accAddress,
            derivationPath: this._derivationPath,
            publicKey: wallet.publicKey.pubkeyAddress(),
        });

        this._addressCache[this._mnemonic] = result;
        return result;
    }

    public async getAddresses(): Promise<Address[]> {
        const address = await this.getAddress();
        return [address];
    }

    public async getUsedAddresses(): Promise<Address[]> {
        return await this.getAddresses();
    }

    public async getUnusedAddress(): Promise<Address> {
        const addresses = await this.getAddresses();
        return addresses[0];
    }

    public async signMessage(message: string): Promise<string> {
        const signed = await this.signer.sign(Buffer.from(message));
        return signed.toString('hex');
    }

    public async getConnectedNetwork(): Promise<TerraNetwork> {
        return this.chainProvider.getNetwork() as TerraNetwork;
    }

    public async createToken(txRequest: CreateTokenTransaction): Promise<null> {
        return null
    }

    public async sendTransaction(txRequest: TerraTxRequest): Promise<Transaction<TerraTxInfo>> {
        // handle value transfers

        if (!txRequest.msgs) {
            txRequest.msgs = this.createSendMessage(txRequest);
        } else {
            // handle contract calls
        }

        const terraTx = await this.buildTransaction(txRequest);
        const signedTx = await this._wallet.createAndSignTx(terraTx);
        return await this.broadcastTx(signedTx);
    }

    public async sendSweepTransaction(address: string | Address, asset: Asset): Promise<Transaction<TerraTxInfo>> {
        const addresses = await this.getAddresses();
        const balance = await this.chainProvider.getBalance(addresses, [asset]);
        return await this.sendTransaction({ to: address, value: balance[0] });
    }

    public getSigner(): MnemonicKey {
        return this.signer;
    }

    // TODO: implement this
    public async sendBatchTransaction(_txRequests: TransactionRequest[]): Promise<Transaction<any>[]> {
        throw new Error('Method not implemented.');
    }

    public async updateTransactionFee(_tx: string | Transaction<any>, _newFee: FeeType): Promise<Transaction<any>> {
        throw new UnimplementedMethodError('Method not supported.');
    }

    public async getBalance(assets: Asset[]): Promise<BigNumber[]> {
        const addresses = await this.getAddresses();
        return this.chainProvider.getBalance(addresses, assets);
    }

    public canUpdateFee(): boolean {
        return false;
    }

    protected onChainProviderUpdate(chainProvider: TerraChainProvider): void {
        this._wallet = new TerraWallet(chainProvider.getProvider(), this.signer);
    }

    private createSendMessage(txRequest: TransactionRequest): Msg[] {
        const sender = this.signer.accAddress;
        const recipient = txRequest.to.toString();

        // handle UST & Luna
        if (txRequest.asset.type === AssetTypes.native) {
            return [
                new MsgSend(this.signer.accAddress, recipient, {
                    [assetCodeToDenom[txRequest.asset.code]]: txRequest.value.toNumber(),
                }),
            ];
        }
        // handle tokens
        else {
            return [
                new MsgExecuteContract(sender, txRequest.asset.contractAddress, {
                    transfer: {
                        recipient,
                        amount: txRequest.value.toString(),
                    },
                }),
            ];
        }
    }

    private async broadcastTx(tx: Tx): Promise<Transaction<TerraTxInfo>> {
        const provider: LCDClient = this.chainProvider.getProvider();
        const txResult = await provider.tx.broadcastSync(tx);

        // exponential backoff => total of 63,5 seconds
        const txReceipt = await retry<Transaction<TerraTxInfo>>(
            async () => this.chainProvider.getTransactionByHash(txResult.txhash),
            500,
            2,
            7
        );

        if (isTxError(txReceipt._raw)) {
            throw new Error(
                `Encountered an error while running the transaction: ${txReceipt._raw.code} ${txReceipt._raw.codespace} ${txReceipt._raw.raw_log}`
            );
        }

        return txReceipt;
    }

    private async buildTransaction(txRequest: TerraTxRequest): Promise<CreateTxOptions> {
        const feeDenom = assetCodeToDenom[txRequest.feeAsset.code];
        const terraTx: CreateTxOptions = {
            msgs: txRequest.msgs,
            memo: txRequest.memo || txRequest.data, // if memo is undefined, try with data
            feeDenoms: [feeDenom],
        };

        let estimatedGas = txRequest.gasLimit;
        if (!estimatedGas) {
            /* simulation: estimate gas */
            const simulatedTx = await retry<Tx>(async () => this._wallet.createTx(terraTx), 1000, 2, 2);
            estimatedGas = Math.ceil(simulatedTx.auth_info.fee.gas_limit * this._gasAdjustment);
        }

        if (txRequest.fee) {
            const feeAmount = new BigNumber(estimatedGas).times(Number(txRequest.fee)).integerValue(BigNumber.ROUND_CEIL).toString();
            const terraFee = new Fee(estimatedGas, new Coins([Coin.fromData({ amount: feeAmount, denom: feeDenom })]));
            return { ...terraTx, fee: terraFee };
        }

        return terraTx;
    }
}
