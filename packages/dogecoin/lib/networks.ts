import { networks } from 'bitcoinjs-lib';
import { DogecoinNetwork } from './types';

const dogecoin: DogecoinNetwork = {
    name: 'dogecoin',
    ...networks.dogecoin,
    coinType: '0',
    isTestnet: false,
};

const dogecoin_testnet: DogecoinNetwork = {
    name: 'dogecoin_testnet',
    ...networks.testnet,
    coinType: '1',
    isTestnet: true,
};

const dogecoin_regtest: DogecoinNetwork = {
    name: 'dogecoin_regtest',
    ...networks.regtest,
    coinType: '1',
    isTestnet: true,
};

const DogecoinNetworks = {
    dogecoin,
    dogecoin_testnet,
    dogecoin_regtest,
};

export { DogecoinNetworks };
