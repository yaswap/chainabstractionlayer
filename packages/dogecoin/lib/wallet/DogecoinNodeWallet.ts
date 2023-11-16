import { Chain, Wallet } from '@yaswap/client';
import { UnimplementedMethodError } from '@yaswap/errors';
import { Address, AddressType, Asset, BigNumber, FeeType, Network, Transaction, TransactionRequest, CreateTokenTransaction } from '@yaswap/types';
import { ECPair, Psbt, script, Transaction as DogecoinJsTransaction } from 'bitcoinjs-lib';
import { flatten, isString, uniq } from 'lodash';
import { DogecoinBaseChainProvider } from '../chain/DogecoinBaseChainProvider';
import { AddressGrouping, AddressInfo, ReceivedByAddress } from '../chain/jsonRpc/types';
import { DogecoinNetworks } from '../networks';
import {
    AddressType as DogecoinAddressType,
    DogecoinNetwork,
    DogecoinNodeWalletOptions,
    PsbtInputTarget,
    Transaction as DogecoinTransaction,
} from '../types';
import { decodeRawTransaction, normalizeTransactionObject } from '../utils';
import { IDogecoinWallet } from './IDogecoinWallet';

const BIP70_CHAIN_TO_NETWORK: { [index: string]: DogecoinNetwork } = {
    main: DogecoinNetworks.dogecoin,
    test: DogecoinNetworks.dogecoin_testnet,
    regtest: DogecoinNetworks.dogecoin_regtest,
};

export class DogecoinNodeWalletProvider extends Wallet<any, any> implements IDogecoinWallet<DogecoinBaseChainProvider> {
    private _addressType: DogecoinAddressType;
    private _network: DogecoinNetwork;
    private _addressInfoCache: { [key: string]: Address };

    constructor(options?: DogecoinNodeWalletOptions, chainProvider?: Chain<DogecoinBaseChainProvider>) {
        super(chainProvider);

        this._addressType = options?.addressType || DogecoinAddressType.BECH32;
        this._network = chainProvider ? (chainProvider.getNetwork() as DogecoinNetwork) : options?.network;
        this._addressInfoCache = {};
    }

    public async getUnusedAddress() {
        return this.getNewAddress(this._addressType);
    }

    public async getUsedAddresses() {
        const usedAddresses: AddressGrouping[] = await this.chainProvider.sendRpcRequest('listaddressgroupings', []);
        const emptyAddresses: ReceivedByAddress[] = await this.chainProvider.sendRpcRequest('listreceivedbyaddress', [0, true, false]);
        const addrs = uniq([...flatten(usedAddresses).map((addr) => addr[0]), ...emptyAddresses.map((a) => a.address)]);
        const addressObjects = await Promise.all(addrs.map((address) => this.getAddressInfo(address)));
        return addressObjects;
    }

    public async getAddresses() {
        return this.getUsedAddresses();
    }

    public async createToken(txRequest: CreateTokenTransaction): Promise<null> {
        return null
    }

    public async sendTransaction(txRequest: TransactionRequest) {
        return txRequest.fee
            ? this.withTxFee(async () => this._sendTransaction(txRequest), txRequest.fee as number)
            : this._sendTransaction(txRequest);
    }

    public async sendBatchTransaction(transactions: TransactionRequest[]) {
        const outputs: { [index: string]: number } = {};
        for (const tx of transactions) {
            outputs[tx.to.toString()] = new BigNumber(tx.value).dividedBy(1e8).toNumber();
        }
        const rawTxOutputs = await this.chainProvider.sendRpcRequest('createrawtransaction', [[], outputs]);
        const rawTxFunded = await this.chainProvider.sendRpcRequest('fundrawtransaction', [rawTxOutputs]);
        const rawTxSigned = await this.chainProvider.sendRpcRequest('signrawtransactionwithwallet', [rawTxFunded.hex]);

        const fee = new BigNumber(rawTxFunded.fee).times(1e8).toNumber();
        await this.chainProvider.sendRawTransaction(rawTxSigned.hex);
        return [normalizeTransactionObject(decodeRawTransaction(rawTxSigned.hex, this._network), fee)];
    }

    public async sendSweepTransaction(_address: AddressType, _asset: Asset, _fee?: FeeType): Promise<Transaction<any>> {
        throw new UnimplementedMethodError('Method not implemented.');
    }

    public async updateTransactionFee(tx: string | Transaction<any>, newFee: number): Promise<Transaction<any>> {
        const txHash = isString(tx) ? tx : tx.hash;
        return this.withTxFee(async () => {
            const result = await this.chainProvider.sendRpcRequest('bumpfee', [txHash]);
            const transaction = await this.chainProvider.sendRpcRequest('gettransaction', [result.txid, true]);
            const fee = new BigNumber(transaction.fee).abs().times(1e8).toNumber();
            return normalizeTransactionObject(decodeRawTransaction(transaction.hex, this._network), fee);
        }, newFee);
    }

    public async getConnectedNetwork(): Promise<Network> {
        const blockchainInfo = await this.chainProvider.sendRpcRequest('getblockchaininfo', []);
        const chain = blockchainInfo.chain;
        return BIP70_CHAIN_TO_NETWORK[chain];
    }

    public async getSigner(): Promise<null> {
        return null;
    }

    public async getAddress(): Promise<AddressType> {
        const addresses = await this.getAddresses();
        return addresses[0];
    }

    public async signMessage(message: string, from: string) {
        return this.chainProvider
            .sendRpcRequest('signmessage', [from.toString(), message])
            .then((result: string) => Buffer.from(result, 'base64').toString('hex'));
    }

    public async getBalance(assets: Asset[]): Promise<BigNumber[]> {
        const addresses = await this.getAddresses();
        return this.chainProvider.getBalance(addresses, assets);
    }

    public async exportPrivateKey(): Promise<string> {
        const address = await this.getAddress();
        return await this.dumpPrivKey(address.toString());
    }

    public async isWalletAvailable(): Promise<boolean> {
        try {
            await this.chainProvider.sendRpcRequest('getwalletinfo', []);
            return true;
        } catch (e) {
            return false;
        }
    }

    public canUpdateFee(): boolean {
        return true;
    }

    public async signPSBT(data: string, inputs: PsbtInputTarget[]): Promise<string> {
        const psbt = Psbt.fromBase64(data, { network: this._network });

        for (const input of inputs) {
            const usedAddresses = await this.getUsedAddresses();
            const address = usedAddresses.find((address) => address.derivationPath === input.derivationPath);
            const wif = await this.dumpPrivKey(address.address);
            const keyPair = ECPair.fromWIF(wif, this._network);
            psbt.signInput(input.index, keyPair);
        }

        return psbt.toBase64();
    }

    public async signBatchP2SHTransaction(
        inputs: [{ inputTxHex: string; index: number; vout: any; outputScript: Buffer }],
        addresses: string,
        tx: any,
        locktime: number,
        segwit = false
    ) {
        const wallets = [];
        for (const address of addresses) {
            const wif = await this.dumpPrivKey(address);
            const wallet = ECPair.fromWIF(wif, this._network);
            wallets.push(wallet);
        }

        const sigs = [];
        for (let i = 0; i < inputs.length; i++) {
            let sigHash;
            if (segwit) {
                sigHash = tx.hashForWitnessV0(
                    inputs[i].index,
                    inputs[i].outputScript,
                    inputs[i].vout.vSat,
                    DogecoinJsTransaction.SIGHASH_ALL
                ); // AMOUNT NEEDS TO BE PREVOUT AMOUNT
            } else {
                sigHash = tx.hashForSignature(inputs[i].index, inputs[i].outputScript, DogecoinJsTransaction.SIGHASH_ALL);
            }

            const sig = script.signature.encode(wallets[i].sign(sigHash), DogecoinJsTransaction.SIGHASH_ALL);
            sigs.push(sig);
        }

        return sigs;
    }

    public async getWalletAddress(address: string) {
        return this.getAddressInfo(address);
    }

    protected onChainProviderUpdate(chainProvider: Chain<DogecoinBaseChainProvider>): void {
        this._network = chainProvider.getNetwork() as DogecoinNetwork;
    }

    private async dumpPrivKey(address: string): Promise<string> {
        return this.chainProvider.sendRpcRequest('dumpprivkey', [address]);
    }

    private async getNewAddress(addressType: DogecoinAddressType, label = '') {
        const params = addressType ? [label, addressType] : [label];
        const newAddress = await this.chainProvider.sendRpcRequest('getnewaddress', params);

        if (!newAddress) {
            return null;
        }

        return this.getAddressInfo(newAddress);
    }

    private async getAddressInfo(address: string): Promise<Address> {
        if (address in this._addressInfoCache) {
            return this._addressInfoCache[address];
        }

        const addressInfo: AddressInfo = await this.chainProvider.sendRpcRequest('getaddressinfo', [address]);

        let publicKey, derivationPath;

        if (!addressInfo.iswatchonly) {
            publicKey = addressInfo.pubkey;
            derivationPath = addressInfo.hdkeypath;
        }
        const addressObject = new Address({ address, publicKey, derivationPath });
        this._addressInfoCache[address] = addressObject;
        return addressObject;
    }

    private async withTxFee(func: () => Promise<Transaction<DogecoinTransaction>>, feePerByte: number) {
        const feePerKB = new BigNumber(feePerByte).div(1e8).times(1000).toNumber();
        const originalTxFee: number = (await this.chainProvider.sendRpcRequest('getwalletinfo', [])).paytxfee;
        await this.chainProvider.sendRpcRequest('settxfee', [feePerKB]);

        const result = await func();

        await this.chainProvider.sendRpcRequest('settxfee', [originalTxFee]);
        return result;
    }

    private async _sendTransaction(txRequest: TransactionRequest) {
        const value = new BigNumber(txRequest.value.toString()).dividedBy(1e8).toNumber();
        const hash = await this.chainProvider.sendRpcRequest('sendtoaddress', [txRequest.to?.toString(), value, '', '', false, true]);
        const transaction = await this.chainProvider.sendRpcRequest('gettransaction', [hash, true]);
        const fee = new BigNumber(transaction.fee).abs().times(1e8).toNumber();
        return normalizeTransactionObject(decodeRawTransaction(transaction.hex, this._network), fee);
    }
}
