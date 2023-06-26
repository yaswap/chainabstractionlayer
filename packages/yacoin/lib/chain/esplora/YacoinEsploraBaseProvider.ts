import { HttpClient } from '@yaswap/client';
import { AddressType, BigNumber } from '@yaswap/types';
import { TxNotFoundError } from '@yaswap/errors';
import { flatten, uniq } from 'lodash';
import { UTXO } from '../../types';
import { decodeRawTransaction, normalizeTransactionObject } from '../../utils';
import { YacoinBaseChainProvider } from '../YacoinBaseChainProvider';
import * as EsploraTypes from './types';

export class YacoinEsploraBaseProvider extends YacoinBaseChainProvider {
    public httpClient: HttpClient;
    protected _options: EsploraTypes.EsploraApiProviderOptions;

    constructor(options: EsploraTypes.EsploraApiProviderOptions) {
        super();
        this.httpClient = new HttpClient({ baseURL: options.url });
        this._options = {
            numberOfBlockConfirmation: 1,
            defaultFeePerByte: 11,
            ...options,
        };
    }

    public async formatTransaction(tx: EsploraTypes.Transaction) {
        // const hex = await this.getTransactionHex(tx.txid);
        // const confirmations = tx.status.confirmed ? currentHeight - tx.status.block_height + 1 : 0;
        // const decodedTx = decodeRawTransaction(hex, this._options.network);
        // decodedTx.confirmations = confirmations;
        // return normalizeTransactionObject(decodedTx, tx.fee, { hash: tx.status.block_hash, number: tx.status.block_height });
        const decodedTx = decodeRawTransaction(tx.hex, this._options.network)
        decodedTx.confirmations = tx.confirmations
        return normalizeTransactionObject(decodedTx, tx.fee, { hash: tx.block_hash, number: tx.block_height })
    }

    public async getRawTransactionByHash(transactionHash: string) {
        return this.getTransactionHex(transactionHash);
    }

    public async getTransactionHex(transactionHash: string): Promise<string> {
        return this.httpClient.nodeGet(`/tx/${transactionHash}/hex`);
    }

    public async getTransaction(transactionHash: string) {
        let data: EsploraTypes.Transaction;

        try {
            data = await this.httpClient.nodeGet(`/tx/${transactionHash}`);
        } catch (e) {
            if (e.name === 'NodeError' && e.message.includes('Transaction not found')) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { name, message, ...attrs } = e;
                throw new TxNotFoundError(`Transaction not found: ${transactionHash}`, attrs);
            }

            throw e;
        }

        return this.formatTransaction(data);
    }

    public async getFeePerByte(numberOfBlocks = this._options.numberOfBlockConfirmation) {
        // try {
        //     const feeEstimates: EsploraTypes.FeeEstimates = await this.httpClient.nodeGet('/fee-estimates');
        //     const blockOptions = Object.keys(feeEstimates).map((block) => parseInt(block));
        //     const closestBlockOption = blockOptions.reduce((prev, curr) => {
        //         return Math.abs(prev - numberOfBlocks) < Math.abs(curr - numberOfBlocks) ? prev : curr;
        //     });
        //     const rate = Math.round(feeEstimates[closestBlockOption]);
        //     return rate;
        // } catch (e) {
        //     return this._options.defaultFeePerByte;
        // }
        return this._options.defaultFeePerByte;
    }

    public async getUnspentTransactions(_addresses: AddressType[]): Promise<UTXO[]> {
        const addresses = _addresses.map((a) => a.toString());
        // const utxoSets = await Promise.all(addresses.map((addr) => this._getUnspentTransactions(addr), this));
        // const utxos = flatten(utxoSets);
        // return utxos;

        // Remove duplicate addresses
        var uniqueAddresses: string[] = [];
        addresses.forEach(element => {
            if (!uniqueAddresses.includes(element)) {
              uniqueAddresses.push(element);
            }
        });
        const utxoSets = await Promise.all(uniqueAddresses.map((addr) => this._getUnspentTransactions(addr)))

        const utxos = flatten(utxoSets)
        return utxos
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
        const data: EsploraTypes.BatchTokenUTXOInfo = await this.httpClient.nodePost('/addresses/token_utxo', {
            addresses: uniq(addresses),
        });

        return data
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
        return 10 // min fee = 0.01 YAC/kb = 0.00001 YAC /byte = 10 satoshis / byte
    }

    private async _getUnspentTransactions(address: string): Promise<UTXO[]> {
        const data: EsploraTypes.UTXO[] = await this.httpClient.nodeGet(`/address/${address}/utxo`);
        return data.map((utxo) => ({
            ...utxo,
            address,
            value: utxo.value,
            blockHeight: utxo.status.block_height,
        }));
    }

    private async _getAddressTransactionCount(address: string) {
        const data: EsploraTypes.Address = await this.httpClient.nodeGet(`/address/${address}`);
        return data.tx_count
    }
}
