import { InvalidAddressError } from '@yaswap/errors';
import { AddressType, BigNumber, Transaction, TxStatus } from '@yaswap/types';
import { HttpClient } from '@yaswap/client';
import * as yacoin from '@yaswap/yacoinjs-lib';
import * as classify from '@yaswap/yacoinjs-lib/src/classify';
import coinselect from '@yaswap/yacoinjs-coinselect';
import { accumulativeCoin } from '@yaswap/yacoinjs-coinselect/accumulative';
import { YacoinNetwork, Input, Output, Transaction as YacoinTransaction, UTXO } from './types';

const AddressTypes = ['legacy', 'p2sh-segwit', 'bech32'];
const getTokenMetadataErr = "Can't get token metadata from ipfs. Please try again later."
const GET_METADATA_TIMEOUT = 3000 // 3s

// JUST FOR TESTING
// const TIMELOCK_FEE_DURATION = 10; // 21000 blocks
// const TIMELOCK_FEE_AMOUNT = 10 * 1e6; // 2100 YAC

// PRODUCTION
const TIMELOCK_FEE_DURATION = 21000; // 21000 blocks
const TIMELOCK_FEE_AMOUNT = 2100 * 1e6; // 2100 YAC

interface TokenMetadata {
    name?: string;
    description?: string;
    imageURL?: string;
    documents?: string[];
}

const timelockFeeDuration = () => {
    return TIMELOCK_FEE_DURATION
}

const timelockFeeAmountInSatoshis = () => {
    return TIMELOCK_FEE_AMOUNT
}

const timelockFeeAmount = () => {
    return TIMELOCK_FEE_AMOUNT/1e6
}

function calculateFee(numInputs: number, numOutputs: number, feePerByte: number) {
//   {
//     "txid" : "bc744444f5410e5b03639a0a92d37737b4fa2d6d6f1e97c5a6ed0390e2acfbcf",
//     "version" : 2, // 4 bytes
//     "time" : 1653219764, // 8 bytes
//     "locktime" : 0, // 4 bytes
//     "vin" : [ // 1 byte indicates the upcoming number of inputs
//         {
//             "txid" : "bc2295b664e6cfe57cb0c228a7ec31ff243e177fc28b4f127b32f435ae1a13a7", // 32 bytes
//             "vout" : 0, // 4 bytes
//             "scriptSig" : { // total 240 bytes
//                 "asm" : "3045022100879e9310e63842164f585937a94bc4f4209056fec50f3b8e7c353d58bc6335c9022008c520fe57a6e6e7181f428b61c56fb439980db4e9ba745d799a3505297e86a001 021b0fb94962e76fca82bac5c2737bd805e8c8b4830d5f2209b1637a2758f0cad4 9619bad9da984eda018c722024073263167c366112e3bdd32349d08f1fd84d0c 1 6382012088a820d0602bf11c7f3c9d6ea5c4395e497d31b791ec817e9e9c9a9f6523b3a51ccc258876a9147dce63154e07772ff7a6b71c78c434f939c8a7c1670460ec8862b17576a9141a2e6ad533096f6f5bc4e420be190f7e9942d4306888ac",
//                 "hex" : "483045022100879e9310e63842164f585937a94bc4f4209056fec50f3b8e7c353d58bc6335c9022008c520fe57a6e6e7181f428b61c56fb439980db4e9ba745d799a3505297e86a00121021b0fb94962e76fca82bac5c2737bd805e8c8b4830d5f2209b1637a2758f0cad4209619bad9da984eda018c722024073263167c366112e3bdd32349d08f1fd84d0c514c616382012088a820d0602bf11c7f3c9d6ea5c4395e497d31b791ec817e9e9c9a9f6523b3a51ccc258876a9147dce63154e07772ff7a6b71c78c434f939c8a7c1670460ec8862b17576a9141a2e6ad533096f6f5bc4e420be190f7e9942d4306888ac"
//             },
//             "sequence" : 0 // 4 bytes
//         }
//     ],
//     "vout" : [ // 1 byte indicates the upcoming number of outputs
//         {
//             "value" : 1.9978880000000001, // 8 bytes
//             "n" : 0,
//             "scriptPubKey" : { // total 25 bytes (24 bytes data + 1 byte size)
//                 "asm" : "OP_DUP OP_HASH160 7dce63154e07772ff7a6b71c78c434f939c8a7c1 OP_EQUALVERIFY OP_CHECKSIG",
//                 "hex" : "76a9147dce63154e07772ff7a6b71c78c434f939c8a7c188ac",
//                 "reqSigs" : 1,
//                 "type" : "pubkeyhash",
//                 "addresses" : [
//                     "YBVeXN4vzg9HC4QywKZHkmC147LtuCFV2A"
//                 ]
//             }
//         }
//     ],
//     "size" : 333
// }
// 18 bytes are version + time + locktime + 2 byte indicates the upcoming number of inputs, output
    return (numInputs * 280 + numOutputs * 33 + 18) * feePerByte
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
    tokenName?: string;
    token_value?: number;
    script?: Buffer;
    id?: string;
};

type CoinSelectResponse = {
    inputs: UTXO[];
    outputs: CoinSelectTarget[];
    change: CoinSelectTarget;
    fee: number;
};

type CoinSelectFunction = (utxos: UTXO[], tokenUtxos: UTXO[], targets: CoinSelectTarget[], feePerByte: number) => CoinSelectResponse;

function selectCoins(utxos: UTXO[], tokenUtxos: UTXO[], targets: CoinSelectTarget[], feePerByte: number, fixedInputs: UTXO[] = []) {
    let selectUtxos = utxos;

    // Default coinselect won't accumulate some inputs
    // TODO: does coinselect need to be modified to ABSOLUTELY not skip an input?
    const coinselectStrat: CoinSelectFunction = fixedInputs.length ? accumulativeCoin : coinselect;
    if (fixedInputs.length) {
        selectUtxos = [
            // Order fixed inputs to the start of the list so they are used
            ...fixedInputs,
            ...utxos.filter((utxo) => !fixedInputs.find((input) => input.vout === utxo.vout && input.txid === utxo.txid)),
        ];
    }

    const { inputs, outputs, fee } = coinselectStrat(selectUtxos, tokenUtxos, targets, Math.ceil(feePerByte));

    let coinChange;
    let tokenChange;
    if (inputs && outputs) {
        coinChange = outputs.find((output) => output.id === 'coin_change');
        tokenChange = outputs.find((output) => output.id === 'token_change');
    }

    return { inputs, outputs, fee, coinChange, tokenChange };
}

const OUTPUT_TYPES_MAP = {
    [classify.types.P2WPKH]: 'witness_v0_keyhash',
    [classify.types.P2WSH]: 'witness_v0_scripthash',
};

function decodeRawTransaction(hex: string, network: YacoinNetwork): YacoinTransaction {
    const bjsTx = yacoin.Transaction.fromHex(hex);

    const vin = bjsTx.ins.map((input) => {
        return <Input>{
            txid: Buffer.from(input.hash).reverse().toString('hex'),
            vout: input.index,
            scriptSig: {
                asm: yacoin.script.toASM(input.script),
                hex: input.script.toString('hex'),
            },
            sequence: input.sequence,
        };
    });

    const vout = bjsTx.outs.map((output, n) => {
        const type = classify.output(output.script);

        const vout: Output = {
            value: output.value / 1e6,
            n,
            scriptPubKey: {
                asm: yacoin.script.toASM(output.script),
                hex: output.script.toString('hex'),
                reqSigs: 1, // TODO: not sure how to derive this
                type: OUTPUT_TYPES_MAP[type] || type,
                addresses: [],
            },
        };

        try {
            const address = yacoin.address.fromOutputScript(output.script, network);
            vout.scriptPubKey.addresses.push(address);
        } catch (e) {
            /** If output script is not parasable, we just skip it */
        }

        return vout;
    });

    return {
        txid: bjsTx.getHash().reverse().toString('hex'),
        hash: bjsTx.getHash().reverse().toString('hex'),
        version: bjsTx.version,
        time: bjsTx.time,
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
    tx: YacoinTransaction,
    fee: number,
    block?: { number: number; hash: string }
): Transaction<YacoinTransaction> {
    const value = tx.vout.reduce((p, n) => p.plus(new BigNumber(n.value).times(1e6)), new BigNumber(0));
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

function getPubKeyHash(address: string, network: YacoinNetwork) {
    const outputScript = yacoin.address.toOutputScript(address, network);
    const type = classify.output(outputScript);
    if (type !== classify.types.P2PKH) {
        throw new Error(`Yacoin swap doesn't support the address ${address} type of ${type}. Not possible to derive public key hash.`);
    }

    const base58 = yacoin.address.fromBase58Check(address)
    return base58.hash
}

function validateAddress(_address: AddressType, network: YacoinNetwork) {
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

function convertToURL(ipfsHash: string, ipfsGateway: string) {
    let url = ''
    const isIPFSprefix = ipfsHash.startsWith("ipfs://")
    if (ipfsHash.includes("://") && !isIPFSprefix) {
        // Normal URL
        url = ipfsHash
    } else {
        // Treat it as IPFS Hash
        url = isIPFSprefix ? ipfsHash.replace('ipfs://', ipfsGateway): `${ipfsGateway}${ipfsHash}`
    }
    return url
}

async function getTokenMetadata(ipfsHash: string) {
    if (!ipfsHash) {
        return {};
    }

    const ipfsGateways = [
        `http://73.43.63.213:3000/ipfs/`,
        `https://cloudflare-ipfs.com/ipfs/`
    ]

    let metadata: TokenMetadata = {}
    let headers = null
    for (const ipfsGateway of ipfsGateways) {
        const ipfsHashUrl = `${ipfsGateway}${ipfsHash}`
        try {
            headers = await HttpClient.head(ipfsHashUrl, {}, {timeout: GET_METADATA_TIMEOUT})
            if (headers['content-type'] === 'application/json') {
                const { name, description, image, documents } = await HttpClient.get(ipfsHashUrl)
                const convertedDocuments = (documents as string[])?.map((document) => {
                    return convertToURL(document, ipfsGateway);
                })
                metadata = {
                    name,
                    description,
                    imageURL: convertToURL(image, ipfsGateway),
                    documents: convertedDocuments
                }
            } else if (headers['content-type']?.startsWith('image')) {
                metadata.imageURL = ipfsHashUrl
            }
            break
        } catch (e) {
            console.warn(`Can't get token metadata from ipfs ${ipfsHashUrl} from gateway ${ipfsGateway}`)
            metadata.description = getTokenMetadataErr
        }
    }

    return metadata
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
    getTokenMetadata,
    getTokenMetadataErr,
    timelockFeeDuration,
    timelockFeeAmountInSatoshis,
    timelockFeeAmount
};
