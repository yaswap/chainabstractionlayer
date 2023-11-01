import { networks } from 'bitcoinjs-lib';
import { LitecoinNetwork } from './types';

const litecoin: LitecoinNetwork = {
    name: 'litecoin',
    ...networks.litecoin,
    coinType: '0',
    isTestnet: false,
};

const litecoin_testnet: LitecoinNetwork = {
    name: 'litecoin_testnet',
    ...networks.testnet,
    coinType: '1',
    isTestnet: true,
};

const litecoin_regtest: LitecoinNetwork = {
    name: 'litecoin_regtest',
    ...networks.regtest,
    coinType: '1',
    isTestnet: true,
};

const LitecoinNetworks = {
    litecoin,
    litecoin_testnet,
    litecoin_regtest,
};

export { LitecoinNetworks };
