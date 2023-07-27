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
        return this._getTokenUnspentTransactions(_addresses, tokenName, '/addresses/token_utxo')
    }

    async getNFTUnspentTransactions(_addresses: AddressType[], tokenName: string): Promise<UTXO[]> {
        return this._getTokenUnspentTransactions(_addresses, tokenName, '/addresses/nft')
    }

    protected async _getTokenUnspentTransactions(_addresses: AddressType[], tokenName: string, url: string): Promise<UTXO[]> {
        const addresses = _addresses.map((a) => a.toString());
        const data: EsploraTypes.BatchTokenUTXOInfo = await this._getAllTokenUnspentTransactions(addresses, url)

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
        return this._getAllTokenUnspentTransactions(_addresses, '/addresses/token_utxo')
    }

    async getAllNFTUnspentTransactions(_addresses: AddressType[]): Promise<EsploraTypes.BatchTokenUTXOInfo> {
        return this._getAllTokenUnspentTransactions(_addresses, '/addresses/nft')
    }

    protected async _getAllTokenUnspentTransactions(_addresses: AddressType[], url: string): Promise<EsploraTypes.BatchTokenUTXOInfo> {
        const addresses = _addresses.map((a) => a.toString());
        const data: EsploraTypes.BatchTokenUTXOInfo = await this._batchHttpClient.nodePost(url, {
            addresses: uniq(addresses),
        });
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
