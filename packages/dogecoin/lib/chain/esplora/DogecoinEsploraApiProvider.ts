import { Chain, Fee, HttpClient } from '@yaswap/client';
// import { ElectrumClient } from "@samouraiwallet/electrum-client";
import { BlockNotFoundError, TxNotFoundError } from '@yaswap/errors';
import { AddressType, BigNumber, Block, FeeDetail, FeeDetails, Transaction } from '@yaswap/types';
import { flatten } from 'lodash';
import { DogecoinEsploraBaseProvider } from './DogecoinEsploraBaseProvider';
import * as EsploraTypes from './types';

export class DogecoinEsploraApiProvider extends Chain<DogecoinEsploraBaseProvider> {
    private _blockChairClient: HttpClient;
    private _blockCypherClient: HttpClient;
    private _dogeChainClient: HttpClient;
    // private _electrumClient: ElectrumClient;
    private _feeOptions: EsploraTypes.FeeOptions;

    constructor(
        options: EsploraTypes.EsploraBatchApiProviderOptions,
        provider?: DogecoinEsploraBaseProvider,
        feeProvider?: Fee,
        feeOptions?: EsploraTypes.FeeOptions
    ) {
        const _provider = provider || new DogecoinEsploraBaseProvider(options);
        super(options.network, _provider, feeProvider);
        this._blockChairClient = this.provider.blockChairClient;
        this._blockCypherClient = this.provider.blockCypherClient;
        this._dogeChainClient = this.provider.dogeChainClient;
        // this._electrumClient = this.provider.electrumClient;
        // Options
        // fast: 1 block = 1 min
        // average: 15 blocks = 15 mins
        // slow: 30 blocks = 30 mins
        this._feeOptions = { slowTargetBlocks: 30, averageTargetBlocks: 15, fastTargetBlocks: 1, ...feeOptions };
    }

    public async getBlockByHash(blockHash: string | number): Promise<Block<any, any>> {
        let data;

        try {
            // Refer https://api.blockchair.com/dogecoin/dashboards/block/6aba29318bf02d64c38129e30096163cd4d624778896841fe3c88c51b88a2c93 (WARNING: Because need median time)
            data = await this._blockChairClient.nodeGet(`/dashboards/block/${blockHash}`);
        } catch (e) {
            if (e.name === 'NodeError' && e.message.includes('Block not found')) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { name, message, ...attrs } = e;
                throw new BlockNotFoundError(`Block not found: ${blockHash}`, attrs);
            }

            throw e;
        }

        /*
        "block": {
            "id": 4958212,
            "hash": "6aba29318bf02d64c38129e30096163cd4d624778896841fe3c88c51b88a2c93",
            "date": "2023-11-09",
            "time": "2023-11-09 04:40:41",
            "median_time": "2023-11-09 04:38:14",
            "size": 61583,
            "version": 6422788,
            "version_hex": "620104",
            "version_bits": "000000011000100000000100000100",
            "merkle_root": "ee9585999217c4228c1537d3060bae2f0a8e5907fc68722d5072cd1a80396ec3",
            "nonce": 0,
            "bits": 436296481,
            "difficulty": 12372642.216396,
            "chainwork": "000000000000000000000000000000000000000000000d8fb6c99ec593b8ab18",
            "coinbase_data_hex": "0304a84b0fe4b883e5bda9e7a59ee4bb99e9b1bc205b323032332d31312d30395430343a34303a34312e3735333431343832325a5d",
            "transaction_count": 154,
            "input_count": 285,
            "output_count": 335,
            "input_total": 1222589579976503,
            "input_total_usd": 920585,
            "output_total": 1223589579976503,
            "output_total_usd": 921338,
            "fee_total": 2592824146,
            "fee_total_usd": 1.95234,
            "fee_per_kb": 42729500,
            "fee_per_kb_usd": 0.0321744,
            "cdd_total": 2772010.9505197,
            "generation": 1000000000000,
            "generation_usd": 752.98,
            "reward": 1002592824146,
            "reward_usd": 754.932,
            "guessed_miner": "Unknown",
            "is_aux": true
        },
        */
        const blockData = data["data"][blockHash]["block"]
        const { hash, id: number, time, median_time, size, difficulty, nonce } = blockData;

        // Convert from date time string to epoch time
        const timestamp = new Date(`${time} UTC`).getTime() / 1000
        const mediantime = new Date(`${median_time} UTC`).getTime() / 1000

        return {
            hash,
            number,
            timestamp: mediantime || timestamp,
            size,
            difficulty,
            nonce,
            _raw: blockData,
        };
    }

    public async getBlockByNumber(blockNumber?: number): Promise<Block<any, any>> {
        if (!blockNumber) {
            blockNumber = await this.getBlockHeight();
        }
        return this.getBlockByHash(blockNumber);
    }

    public async getBlockHeight(): Promise<number> {
        const data = await this._blockChairClient.nodeGet('/stats');
        /* Refer https://api.blockchair.com/dogecoin/stats
        {
            "data": {
                "blocks": 4967956,
                "transactions": 175403187,
        */
        return data.data.blocks;
    }

    public async getTransactionByHash(txHash: string): Promise<Transaction<any>> {
        return this.getTransaction(txHash);
    }

    public async getBalance(_addresses: AddressType[]): Promise<BigNumber[]> {
        const addresses = _addresses.map((a) => a.toString());
        const _utxos = await this.provider.getUnspentTransactions(addresses);
        const utxos = flatten(_utxos);
        return [utxos.reduce((acc, utxo) => acc.plus(utxo.value), new BigNumber(0))];
    }

    public async getTokenBalance(_addresses: AddressType[]): Promise<null> {
        return null
    }

    async getFees(): Promise<FeeDetails> {
        // There is no fee provider for Dogecoin
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

    public async sendRawTransaction(rawTransaction: string): Promise<string> {
        /* Refer https://api.blockcypher.com/v1/doge/main/txs/push
            https://www.blockcypher.com/dev/bitcoin/#push-raw-transaction-endpoint
            Resource	Method	Request Object	Return Object
            /txs/push	POST	{"tx":$TXHEX}	TX
        */
        return this._blockCypherClient.nodePost('/txs/push', `tx=${rawTransaction}`);
    }

    public async sendRpcRequest(_method: string, _params: any[]): Promise<any> {
        throw new Error('Method not implemented.');
    }

    private async getTransaction(transactionHash: string) {
        let data: EsploraTypes.Transaction;

        try {
            // Refer https://dogechain.info/api/v1/transaction/104f2494728489914132f9fb70b87c74cafa56fe5b646be18716932d21ca93e0
            const txinfo = await this._dogeChainClient.nodeGet(`/transaction/${transactionHash}`);

            /*
            {
                "success": 1,
                "transaction": {
                    "hash": "104f2494728489914132f9fb70b87c74cafa56fe5b646be18716932d21ca93e0",
                    "confirmations": 3992,
                    "size": 668,
                    "vsize": 668,
                    "weight": null,
                    "version": 1,
                    "locktime": 0,
                    "block_hash": "6aba29318bf02d64c38129e30096163cd4d624778896841fe3c88c51b88a2c93",
                    "time": 1699504841,
                    "inputs_n": 4,
                    "inputs_value": "5950.60576904",
            ...
                    "fee": "0.84044423",
                    "price": "0.0768"
                }
            }
            */
            data = {
                txid: txinfo.transaction.hash,
                version: txinfo.transaction.version,
                locktime: txinfo.transaction.locktime,
                vin: txinfo.transaction.inputs,
                vout: txinfo.transaction.outputs,
                size: txinfo.transaction.size,
                weight: txinfo.transaction.weight,
                fee: txinfo.transaction.fee*1e8,
                status: { confirmed: txinfo.transaction.confirmations >= 1 ? true : false},
                confirmations: txinfo.transaction.confirmations
            }
        } catch (e) {
            if (e.name === 'NodeError' && e.message.includes('Transaction not found')) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { name, message, ...attrs } = e;
                throw new TxNotFoundError(`Transaction not found: ${transactionHash}`, attrs);
            }

            throw e;
        }

        const currentHeight = await this.getBlockHeight();
        return this.provider.formatTransaction(data, currentHeight);
    }

    private async _getFee(targetBlocks: number): Promise<FeeDetail> {
        const value = await this.provider.getFeePerByte(targetBlocks);
        const wait = targetBlocks * 1 * 60; // 1 minute blocks in seconds
        return { fee: value, wait };
    }
}
