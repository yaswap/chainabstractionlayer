import { HttpClient } from '@yaswap/client';
import { AddressType, BigNumber } from '@yaswap/types';
import { flatten, uniq } from 'lodash';
import { UTXO } from '../../types';
import { YacoinEsploraBaseProvider } from './YacoinEsploraBaseProvider';
import * as EsploraTypes from './types';

export class YacoinEsploraBatchBaseProvider extends YacoinEsploraBaseProvider {
    private _batchHttpClient: HttpClient;

    constructor(options: EsploraTypes.EsploraBatchApiProviderOptions) {
        super(options);
        this._batchHttpClient = new HttpClient({ baseURL: options.batchUrl });
    }

    async getUnspentTransactions(_addresses: AddressType[]): Promise<UTXO[]> {
        const addresses = _addresses.map((a) => a.toString());
        const data: EsploraTypes.BatchUTXOs = await this._batchHttpClient.nodePost('/addresses/utxo', {
            addresses: uniq(addresses),
        });

        const utxos = data.map(({ address, utxo }) => {
            return utxo.map((obj) => ({
                ...obj,
                address,
                satoshis: obj.value,
                amount: new BigNumber(obj.value).dividedBy(1e6).toNumber(),
                blockHeight: obj.status.block_height,
            }));
        });

        return flatten(utxos);
    }

    async getTokenUnspentTransactions(_addresses: AddressType[], tokenName: string): Promise<UTXO[]> {
        const addresses = _addresses.map((a) => a.toString());
        const data: EsploraTypes.BatchTokenUTXOInfo = await this.getAllTokenUnspentTransactions(addresses)

        const utxos = data.filter(({ token_name }) => {
            if (token_name === tokenName) {
                return true;
            }
            return false;
        })
        .map(({ token_utxos }) => {
            return token_utxos.map(({ address, utxo }) => {
                return utxo.map((obj) => ({
                    ...obj,
                    address,
                    satoshis: obj.value,
                    amount: new BigNumber(obj.value).dividedBy(1e6).toNumber(),
                    blockHeight: obj.status.block_height,
                }));
            });
        });

        return flatten(flatten(utxos));
    }

    async getAllTokenUnspentTransactions(_addresses: AddressType[]): Promise<EsploraTypes.BatchTokenUTXOInfo> {
        const addresses = _addresses.map((a) => a.toString());
        const data: EsploraTypes.BatchTokenUTXOInfo = await this._batchHttpClient.nodePost('/addresses/token_utxo', {
            addresses: uniq(addresses),
        });
        console.log('TACA ===> [CAL] getAllTokenUnspentTransactions, data = ', data)
        return data
    }

    async getAddressTransactionCounts(_addresses: AddressType[]) {
        const addresses = _addresses.map((a) => a.toString());
        const data: EsploraTypes.Address[] = await this._batchHttpClient.nodePost('/addresses', {
            addresses: uniq(addresses),
        });

        return data.reduce((acc: { [index: string]: number }, obj) => {
            acc[obj.address] = obj.tx_count;
            return acc;
        }, {});
    }
}
