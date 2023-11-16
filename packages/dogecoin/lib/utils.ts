import { InvalidAddressError } from '@yaswap/errors';
import { AddressType, BigNumber, Transaction, TxStatus } from '@yaswap/types';
import * as dogecoin from 'bitcoinjs-lib';
import * as classify from 'bitcoinjs-lib/src/classify';
import coinselect from 'coinselect';
import coinselectAccumulative from 'coinselect/accumulative';
import { DogecoinNetwork, Input, Output, Transaction as DogecoinTransaction, UTXO } from './types';

const AddressTypes = ['legacy', 'p2sh-segwit', 'bech32'];

function calculateFee(numInputs: number, numOutputs: number, feePerByte: number) {
    return (numInputs * 148 + numOutputs * 34 + 10) * feePerByte;
}

/**
 * Get compressed pubKey from pubKey.
 * @param pubKey - 65 byte string with prefix, x, y.
 * @returns the compressed pubKey of uncompressed pubKey.
 */
function compressPubKey(pubKey: string) {
    const x = pubKey.substring(2, 66);
    const y = pubKey.substring(66, 130);
    const even = parseInt(y.substring(62, 64), 16) % 2 === 0;
    const prefix = even ? '02' : '03';

    return prefix + x;
}

type CoinSelectTarget = {
    value: number;
    script?: Buffer;
    id?: string;
};

type CoinSelectResponse = {
    inputs: UTXO[];
    outputs: CoinSelectTarget[];
    change: CoinSelectTarget;
    fee: number;
};

type CoinSelectFunction = (utxos: UTXO[], targets: CoinSelectTarget[], feePerByte: number) => CoinSelectResponse;

function selectCoins(utxos: UTXO[], targets: CoinSelectTarget[], feePerByte: number, fixedInputs: UTXO[] = []) {
    let selectUtxos = utxos;

    // Default coinselect won't accumulate some inputs
    // TODO: does coinselect need to be modified to ABSOLUTELY not skip an input?
    const coinselectStrat: CoinSelectFunction = fixedInputs.length ? coinselectAccumulative : coinselect;
    if (fixedInputs.length) {
        selectUtxos = [
            // Order fixed inputs to the start of the list so they are used
            ...fixedInputs,
            ...utxos.filter((utxo) => !fixedInputs.find((input) => input.vout === utxo.vout && input.txid === utxo.txid)),
        ];
    }

    const { inputs, outputs, fee } = coinselectStrat(selectUtxos, targets, Math.ceil(feePerByte));

    let change;
    if (inputs && outputs) {
        change = outputs.find((output) => output.id !== 'main');
    }

    return { inputs, outputs, fee, change };
}

const OUTPUT_TYPES_MAP = {
    [classify.types.P2WPKH]: 'witness_v0_keyhash',
    [classify.types.P2WSH]: 'witness_v0_scripthash',
};

function decodeRawTransaction(hex: string, network: DogecoinNetwork): DogecoinTransaction {
    const bjsTx = dogecoin.Transaction.fromHex(hex);

    const vin = bjsTx.ins.map((input) => {
        return <Input>{
            txid: Buffer.from(input.hash).reverse().toString('hex'),
            vout: input.index,
            scriptSig: {
                asm: dogecoin.script.toASM(input.script),
                hex: input.script.toString('hex'),
            },
            sequence: input.sequence,
        };
    });

    const vout = bjsTx.outs.map((output, n) => {
        const type = classify.output(output.script);

        const vout: Output = {
            value: output.value / 1e8,
            n,
            scriptPubKey: {
                asm: dogecoin.script.toASM(output.script),
                hex: output.script.toString('hex'),
                reqSigs: 1, // TODO: not sure how to derive this
                type: OUTPUT_TYPES_MAP[type] || type,
                addresses: [],
            },
        };

        try {
            const address = dogecoin.address.fromOutputScript(output.script, network);
            vout.scriptPubKey.addresses.push(address);
        } catch (e) {
            /** If output script is not parasable, we just skip it */
        }

        return vout;
    });

    return {
        txid: bjsTx.getHash(false).reverse().toString('hex'),
        hash: bjsTx.getHash(true).reverse().toString('hex'),
        version: bjsTx.version,
        locktime: bjsTx.locktime,
        size: bjsTx.byteLength(),
        vsize: bjsTx.virtualSize(),
        weight: bjsTx.weight(),
        vin,
        vout,
        hex,
    };
}

function normalizeTransactionObject(
    tx: DogecoinTransaction,
    fee: number,
    block?: { number: number; hash: string }
): Transaction<DogecoinTransaction> {
    const value = tx.vout.reduce((p, n) => p.plus(new BigNumber(n.value).times(1e8)), new BigNumber(0));
    const result = {
        hash: tx.txid,
        value: value.toNumber(),
        _raw: tx,
        confirmations: 0,
        status: tx.confirmations > 0 ? TxStatus.Success : TxStatus.Pending,
    };

    if (fee) {
        const feePrice = Math.round(fee / tx.vsize);
        Object.assign(result, {
            fee,
            feePrice,
        });
    }

    if (block) {
        Object.assign(result, {
            blockHash: block.hash,
            blockNumber: block.number,
            confirmations: tx.confirmations,
        });
    }

    return result;
}

function getPubKeyHash(address: string, network: DogecoinNetwork) {
    const outputScript = dogecoin.address.toOutputScript(address, network);
    const type = classify.output(outputScript);
    if (type !== classify.types.P2PKH) {
        throw new Error(`Dogecoin swap doesn't support the address ${address} type of ${type}. Not possible to derive public key hash.`);
    }

    const base58 = dogecoin.address.fromBase58Check(address)
    return base58.hash
}

function validateAddress(_address: AddressType, network: DogecoinNetwork) {
    const address = _address.toString();

    if (typeof address !== 'string') {
        throw new InvalidAddressError(`Invalid address: ${address}`);
    }

    let pubKeyHash;
    try {
        pubKeyHash = getPubKeyHash(address, network);
    } catch (e) {
        throw new InvalidAddressError(`Invalid Address. Failed to parse: ${address}`);
    }

    if (!pubKeyHash) {
        throw new InvalidAddressError(`Invalid Address: ${address}`);
    }
}

export {
    calculateFee,
    compressPubKey,
    CoinSelectTarget,
    selectCoins,
    decodeRawTransaction,
    normalizeTransactionObject,
    AddressTypes,
    getPubKeyHash,
    validateAddress,
};
