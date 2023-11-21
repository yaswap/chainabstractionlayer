import { HttpClient } from '@yaswap/client';
import { AddressType } from '@yaswap/types';
import { flatten } from 'lodash';
import { UTXO } from '../../types';
import { decodeRawTransaction, normalizeTransactionObject } from '../../utils';
import { DogecoinBaseChainProvider } from '../DogecoinBaseChainProvider';
import * as EsploraTypes from './types';

export class DogecoinEsploraBaseProvider extends DogecoinBaseChainProvider {
    public blockChairClient: HttpClient;
    public blockCypherClient: HttpClient;
    public dogeChainClient: HttpClient;

    protected _options: EsploraTypes.EsploraApiProviderOptions;

    constructor(options: EsploraTypes.EsploraApiProviderOptions) {
        super();
        this.blockChairClient = new HttpClient({ baseURL: "https://api.blockchair.com/dogecoin" });
        this.blockCypherClient = new HttpClient({ baseURL: "https://api.blockcypher.com/v1/doge/main" });
        this.dogeChainClient = new HttpClient({ baseURL: "https://dogechain.info/api/v1" });

        this._options = {
            numberOfBlockConfirmation: 1,
            // Refer https://github.com/dogecoin/dogecoin/blob/master/doc/fee-recommendation.md
            // min relay tx fee = 0.001 DOGE/kB = 100000/kB = 100/byte
            // recommended fee = 0.01 DOGE/kB = 1000000/kB = 1000/byte
            defaultFeePerByte: 2000, 
            ...options,
        };
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
        const data = await this.blockChairClient.nodeGet(`/raw/transaction/${transactionHash}`)
        return data[transactionHash]['raw_transaction']
    }

    public async getFeePerByte(numberOfBlocks = this._options.numberOfBlockConfirmation) {
        try {
            // Refer https://api.blockcypher.com/v1/doge/main
            const data = await this.blockCypherClient.nodeGet(`/v1/doge/main`)
            let rate;
            if (numberOfBlocks < 15) {
                rate = Math.round(data.high_fee_per_kb / 1000);
            } else if (numberOfBlocks >= 15 && numberOfBlocks < 30) {
                rate = Math.round(data.medium_fee_per_kb / 1000);
            } else {
                rate = Math.round(data.low_fee_per_kb / 1000);
            }
            return rate;
        } catch (e) {
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
        // Refer https://api.blockcypher.com/v1/doge/main/addrs/DEn59H5NhNErVmANLW3jQiaiBEc1VqANam?unspentOnly=true
        const response = await this.blockCypherClient.nodeGet(`/addrs/${address}?unspentOnly=true`);
        /*
        "txrefs": [
            {
                "tx_hash": "da9952795bff05ff743eb26f72a3b63bdd57b5db44f6c9b68d9dac830dc83b5a",
                "block_height": 4906925,
                "tx_input_n": -1,
                "tx_output_n": 0,
                "value": 100000000,
                "ref_balance": 1259019264101964,
                "spent": false,
                "confirmations": 56502,
                "confirmed": "2023-10-02T04:44:59Z",
                "double_spend": false
            },
        */
        // @ts-ignore
        const data: EsploraTypes.UTXO[] = response.txrefs.map(tx => {
            return {
                txid: tx.tx_hash,
                vout: tx.tx_output_n,
                status: { confirmed: tx.confirmations >= 0 ? true : false },
                value: tx.value,
            }
        })
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
