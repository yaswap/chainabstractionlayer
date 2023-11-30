import { HttpClient } from '@yaswap/client';
import { AddressType } from '@yaswap/types';
import { TxNotFoundError } from '@yaswap/errors';
import { flatten } from 'lodash';
import { UTXO } from '../../types';
import { decodeRawTransaction, normalizeTransactionObject } from '../../utils';
import { DogecoinBaseChainProvider } from '../DogecoinBaseChainProvider';
import * as EsploraTypes from './types';
import { ElectrumWS } from '@yaswap/ws-electrumx-client';

export class DogecoinEsploraBaseProvider extends DogecoinBaseChainProvider {
    public blockChairClient: HttpClient;
    public blockCypherClient: HttpClient;
    public dogeChainClient: HttpClient;
    public electrumEndpoint: string;
    public electrumClient: ElectrumWS;

    protected _options: EsploraTypes.EsploraApiProviderOptions;

    constructor(options: EsploraTypes.EsploraApiProviderOptions) {
        super();
        this.blockChairClient = new HttpClient({ baseURL: "https://api.blockchair.com/dogecoin" });
        this.blockCypherClient = new HttpClient({ baseURL: "https://api.blockcypher.com/v1/doge/main" });
        this.dogeChainClient = new HttpClient({ baseURL: "https://dogechain.info/api/v1" });
        this.electrumEndpoint = 'wss://electrum1.cipig.net:30060'

        this._options = {
            numberOfBlockConfirmation: 1,
            // Refer https://github.com/dogecoin/dogecoin/blob/master/doc/fee-recommendation.md
            // min relay tx fee = 0.001 DOGE/kB = 100000/kB = 100/byte
            // recommended fee = 0.01 DOGE/kB = 1000000/kB = 1000/byte
            defaultFeePerByte: 2000, 
            ...options,
        };
    }

    public async checkAndReconnectElectrumClient() {
        if (!this.electrumClient || !this.electrumClient.isConnected()) {
            console.warn('checkAndReconnectElectrumClient, Reconnecting electrum X')
            this.electrumClient = new ElectrumWS(this.electrumEndpoint, {reconnect: false, verbose: false});
            console.log('TACA ==> checkAndReconnectElectrumClient, this.electrumClient = ', this.electrumClient)
            const result = await this.electrumClient.request(
                'server.version',
                //@ts-ignore
                ["electrum-client-js",["1.2","2.0"]],
            );
            console.log('TACA ==> checkAndReconnectElectrumClient, result = ', result)
        }
    }

    public async formatTransaction(tx: EsploraTypes.Transaction, currentHeight: number) {
        const hex = await this.getTransactionHex(tx.txid);
        if (tx.status.confirmed) {
            tx.status.block_height = currentHeight - tx.confirmations + 1;
        }
        const decodedTx = decodeRawTransaction(hex as string, this._options.network);
        decodedTx.confirmations = tx.confirmations;
        return normalizeTransactionObject(decodedTx, tx.fee, { hash: tx.status.block_hash, number: tx.status.block_height });
    }

    public async getRawTransactionByHash(transactionHash: string) {
        return this.getTransactionHex(transactionHash);
    }

    public async getTransactionHex(transactionHash: string): Promise<string> {
        // Refer https://api.blockchair.com/dogecoin/raw/transaction/104f2494728489914132f9fb70b87c74cafa56fe5b646be18716932d21ca93e0
        try {
            const data = await this.blockChairClient.nodeGet(`/raw/transaction/${transactionHash}`)
            console.log('TACA ===> DogecoinEsploraBaseProvider.ts, getTransactionHex, data = ', data)
            if (!data.data) {
                throw new TxNotFoundError(`Transaction not found: ${transactionHash}`);
            }
            return data['data'][transactionHash]['raw_transaction']
        } catch (e) {
            console.warn("DogecoinEsploraBaseProvider.ts, getTransactionHex, error = ", e)
            throw new TxNotFoundError(`Transaction not found: ${transactionHash}`);
        }
    }

    public async getFeePerByte(numberOfBlocks = this._options.numberOfBlockConfirmation) {
        try {
            // Refer https://electrumx-spesmilo.readthedocs.io/en/latest/protocol-methods.html#blockchain.estimatefee
            await this.checkAndReconnectElectrumClient()
            const feeEstimates = await this.electrumClient.request(
                'blockchain.estimatefee',
                numberOfBlocks,
            );
            console.log('TACA ===> getFeePerByte, feeEstimates = ', feeEstimates)
            if (feeEstimates === -1) {
                return this._options.defaultFeePerByte;
            }
            const rate = Math.round(feeEstimates as number * 1e8 / 1000)
            console.log('TACA ===> getFeePerByte, rate = ', rate)
            return rate;
        } catch (e) {
            console.log('TACA ===> getFeePerByte, error = ', e)
            return this._options.defaultFeePerByte;
        }
    }

    public async getUnspentTransactions(_addresses: AddressType[]): Promise<UTXO[]> {
        const addresses = _addresses.map((a) => a.toString());
        const utxoSets = await Promise.all(addresses.map((addr) => this._getUnspentTransactions(addr), this));
        const utxos = flatten(utxoSets);
        return utxos;
    }

    public async getAddressTransactionCounts(_addresses: AddressType[]) {
        const addresses = _addresses.map((a) => a.toString());
        const transactionCountsArray = await Promise.all(
            addresses.map(async (addr) => {
                const txCount = await this._getAddressTransactionCount(addr);
                return { [addr]: txCount };
            })
        );
        const transactionCounts = Object.assign({}, ...transactionCountsArray);
        return transactionCounts;
    }

    public async getMinRelayFee() {
        // Refer https://github.com/dogecoin/dogecoin/blob/master/doc/fee-recommendation.md
        // min relay tx fee = 0.001 DOGE/kB = 100/byte
        // recommended fee = 0.01 DOGE/kB = 1000/byte
        return 1000;
    }

    private async _getUnspentTransactions(address: string): Promise<UTXO[]> {
        // Refer https://dogechain.info/api/v1/address/unspent/DEn59H5NhNErVmANLW3jQiaiBEc1VqANam/1 (10 UTXOs per page)
        let page = 1;
        let data: EsploraTypes.UTXO[] = []
        let response;

        while(1) {
            response = await this.dogeChainClient.nodeGet(`/address/unspent/${address}/${page}`)
            console.log(`TACA ===> DogecoinEsploraBaseProvider.ts, _getUnspentTransactions, page = ${page}, response = ${response}`)
            /*
            {
                "unspent_outputs": [
                    {
                        "tx_hash": "dd2f0e3ba12d078bae5da3a47a890f43ef233bc81e23fa453a0bb829b459484d",
                        "tx_output_n": 0,
                        "script": "76a91469b75b6d71f71b6d0880b2bbcd236f4fcc61fc8088ac",
                        "address": "DEn59H5NhNErVmANLW3jQiaiBEc1VqANam",
                        "value": 55401985277,
                        "confirmations": 9148,
                        "tx_hex": "010000000292af9f466b549ef2cca7e54cf16db84f81e6c1f492d7fce963dd6a7631106817020000006a473044022001be40295456136b3010678e23d1c717ae61643a5c20d3d6e08bb91bad86f435022052e1c8397a72093ea8e86c8455ac4c72daa270a90ab8d4f205596d902fa2b6dd01210245f22c90c559eec2d203e2302effd23b6bcb0ace4fd99570367dc8658b0134eaffffffff13d4dd060ca75903215cb7a5fb57ebd60ea9bd9e59765886e99fc96dca07f906000000006b483045022100891bae909841d431ec082a3469b9133bb4d0567a4898309876dde82bbf9c3e9202206594fcbca1d64bc93dddc9ddc798ac81d25f4e8eb03a22ce10b91ae963a6dc430121031d26f585f25d58d72e8d5e0c8cf6f22ccf91d69dec86c0f635684fb0325e7930ffffffff02fd3437e60c0000001976a91469b75b6d71f71b6d0880b2bbcd236f4fcc61fc8088ac05b44b640a0000001976a914ad83d8db65b95796685de5efa54988d9c91c61b388ac00000000"
                    }
                ],
                "success": 1
            }
            */
            if (response.unspent_outputs?.length > 0) {
                // @ts-ignore
                response.unspent_outputs.forEach(tx => {
                    data.push({
                        txid: tx.tx_hash,
                        vout: tx.tx_output_n,
                        status: { confirmed: tx.confirmations >= 0 ? true : false },
                        value: tx.value,
                    })
                })
            } else {
                break
            }
            page++
        }

        return data.map((utxo) => ({
            ...utxo,
            address,
        }));
    }

    private async _getAddressTransactionCount(address: string) {
        // Refer https://dogechain.info//api/v1/address/transaction_count/DEn59H5NhNErVmANLW3jQiaiBEc1VqANam
        const data: EsploraTypes.Address = await this.dogeChainClient.nodeGet(`/address/transaction_count/${address}`);
        /*
        {
            "transaction_count": {
                "sent": 54,
                "received": 447,
                "total": 448
            },
            "success": 1
        }
        */
        return data.transaction_count.total
    }
}
