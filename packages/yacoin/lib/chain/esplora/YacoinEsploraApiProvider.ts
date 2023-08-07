import { Chain, Fee, HttpClient } from '@yaswap/client';
import { BlockNotFoundError } from '@yaswap/errors';
import { AddressType, BigNumber, Block, FeeDetail, FeeDetails, Transaction, TokenBalance } from '@yaswap/types';
import { flatten } from 'lodash';
import { YacoinEsploraBaseProvider } from './YacoinEsploraBaseProvider';
import { YacoinEsploraBatchBaseProvider } from './YacoinEsploraBatchBaseProvider';
import * as EsploraTypes from './types';

export class YacoinEsploraApiProvider extends Chain<YacoinEsploraBaseProvider> {
    private _httpClient: HttpClient;
    private _feeOptions: EsploraTypes.FeeOptions;

    constructor(
        options: EsploraTypes.EsploraBatchApiProviderOptions,
        provider?: YacoinEsploraBaseProvider,
        feeProvider?: Fee,
        feeOptions?: EsploraTypes.FeeOptions
    ) {
        const _provider = provider || new YacoinEsploraBatchBaseProvider(options);
        super(options.network, _provider, feeProvider);
        this._httpClient = this.provider.httpClient;
        // WARNING: ATTENTION THIS FEE
        this._feeOptions = { slowTargetBlocks: 6, averageTargetBlocks: 3, fastTargetBlocks: 1, ...feeOptions };
    }

    public async getBlockByHash(blockHash: string): Promise<Block<any, any>> {
        let data;

        try {
            data = await this._httpClient.nodeGet(`/getblock?hash=${blockHash}`);
        } catch (e) {
            if (e.name === 'NodeError' && e.message.includes('Block not found')) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { name, message, ...attrs } = e;
                throw new BlockNotFoundError(`Block not found: ${blockHash}`, attrs);
            }

            throw e;
        }

        const { hash, height: number, time, size, previousblockhash: parentHash, difficulty, nonce } = data;

        return {
            hash,
            number,
            timestamp: time,
            size,
            parentHash,
            difficulty: Number.parseFloat(difficulty),
            nonce,
            _raw: data,
        };
    }

    public async getBlockByNumber(blockNumber?: number): Promise<Block<any, any>> {
        if (!blockNumber) {
            blockNumber = await this.getBlockHeight();
        }
        return this.getBlockByHash(await this._getBlockHash(blockNumber));
    }

    public async getBlockHeight(): Promise<number> {
        const data = await this._httpClient.nodeGet('/getblockcount');
        return parseInt(data);
    }

    public async getTransactionByHash(txHash: string): Promise<Transaction<any>> {
        return this.provider.getTransaction(txHash);
    }

    public async getBalance(_addresses: AddressType[]): Promise<BigNumber[]> {
        const addresses = _addresses.map((a) => a.toString());
        const _utxos = await this.provider.getUnspentTransactions(addresses);
        const utxos = flatten(_utxos);
        return [utxos.reduce((acc, utxo) => acc.plus(utxo.value), new BigNumber(0))];
    }

    public async getTokenBalance(_addresses: AddressType[]): Promise<TokenBalance[]> {
        const addresses = _addresses.map((a) => a.toString());
        const batchTokenUTXOInfo = await this.provider.getAllTokenUnspentTransactions(addresses);
        return batchTokenUTXOInfo.map(({ token_name, balance, token_info }) => ({
            "name": token_name.split('/').join('|'), // Workaround for displaying sub YA-token
            "balance": new BigNumber(balance).dividedBy(1e6/Math.pow(10, token_info.units)).toNumber(),
            "totalSupply": token_info.amount,
            "units": token_info.units,
            "reissuable": token_info.reissuable,
            "blockHash": token_info.block_hash,
            "ipfsHash": token_info.ipfs_hash,
        }))
    }

    async getFees(): Promise<FeeDetails> {
        if (this.feeProvider) {
            return this.feeProvider.getFees();
        } else {
            const [slow, average, fast] = await Promise.all([
                this._getFee(this._feeOptions.slowTargetBlocks),
                this._getFee(this._feeOptions.averageTargetBlocks),
                this._getFee(this._feeOptions.fastTargetBlocks),
            ]);

            return {
                slow,
                average,
                fast,
            };
        }
    }

    public async sendRawTransaction(rawTransaction: string): Promise<string> {
        return this._httpClient.nodePost('/tx', rawTransaction);
    }

    public async sendRpcRequest(_method: string, _params: any[]): Promise<any> {
        throw new Error('Method not implemented.');
    }

    private async _getBlockHash(blockNumber: number): Promise<string> {
        return this._httpClient.nodeGet(`/getblockhash?index=${blockNumber}`);
    }

    private async _getFee(targetBlocks: number): Promise<FeeDetail> {
        const value = await this.provider.getFeePerByte(targetBlocks);
        const wait = targetBlocks * 10 * 60; // 10 minute blocks in seconds
        return { fee: value, wait };
    }
}
