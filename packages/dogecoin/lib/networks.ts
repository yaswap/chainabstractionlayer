import { networks } from 'bitcoinjs-lib';
import { DogecoinNetwork } from './types';

const dogecoin: DogecoinNetwork = {
    name: 'dogecoin',
    // Refer https://github.com/BlockIo/block_io-nodejs/blob/081caf2af1b6d318d490fc73feb66df90e7c7512/data/networks.js#L15-L38
    messagePrefix: '\x19Dogecoin Signed Message:\n',
    bech32: 'doge',
    // Refer https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
    // Refer https://github.com/dogecoin/dogecoin/issues/2344
    // Refer https://bitcoin.stackexchange.com/questions/28380/i-want-to-generate-a-bip32-version-number-for-namecoin-and-other-altcoins
    // Use dgpv/dgub
    bip32: {
      public: 0x02facafd,
      private: 0x02fac398,
    },
    // Refer https://github.com/dogecoin/dogecoin/blob/master/src/chainparams.cpp#L167
    pubKeyHash: 0x1e, // starts with D
    scriptHash: 0x16, // starts with A
    // Refer https://github.com/dogecoin/dogecoin/blob/master/src/chainparams.cpp#L169
    wif: 0x9e,
    // Refer https://github.com/satoshilabs/slips/blob/master/slip-0044.md#registered-coin-types
    coinType: '3',
    isTestnet: false,
};

// const dogecoin_testnet: DogecoinNetwork = {
//     name: 'dogecoin_testnet',
//     // Refer https://github.com/BlockIo/block_io-nodejs/blob/081caf2af1b6d318d490fc73feb66df90e7c7512/data/networks.js#L28
//     messagePrefix: '\x18Dogecoin Signed Message:\n',
//     bech32: 'tdge',
//     // Refer https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
//     // Use xprv/xpub same as Bitcoin
//     bip32: {
//       public: 0x0432a9a8,
//       private: 0x0432a243,
//     },
//     // Refer https://github.com/dogecoin/dogecoin/blob/master/src/chainparams.cpp#L325
//     pubKeyHash: 0x71,
//     scriptHash: 0xc4,
//     // Refer https://github.com/dogecoin/dogecoin/blob/master/src/chainparams.cpp#L327
//     wif: 0xf1,
//     // Refer https://github.com/satoshilabs/slips/blob/master/slip-0044.md#registered-coin-types
//     coinType: '1',
//     isTestnet: true,
// };

const dogecoin_testnet: DogecoinNetwork = {
    name: 'dogecoin_testnet',
    // Refer https://github.com/BlockIo/block_io-nodejs/blob/081caf2af1b6d318d490fc73feb66df90e7c7512/data/networks.js#L15-L38
    messagePrefix: '\x19Dogecoin Signed Message:\n',
    bech32: 'doge',
    // Refer https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
    // Refer https://github.com/dogecoin/dogecoin/issues/2344
    // Refer https://bitcoin.stackexchange.com/questions/28380/i-want-to-generate-a-bip32-version-number-for-namecoin-and-other-altcoins
    // Use dgpv/dgub
    bip32: {
      public: 0x02facafd,
      private: 0x02fac398,
    },
    // Refer https://github.com/dogecoin/dogecoin/blob/master/src/chainparams.cpp#L167
    pubKeyHash: 0x1e, // starts with D
    scriptHash: 0x16, // starts with A
    // Refer https://github.com/dogecoin/dogecoin/blob/master/src/chainparams.cpp#L169
    wif: 0x9e,
    // Refer https://github.com/satoshilabs/slips/blob/master/slip-0044.md#registered-coin-types
    coinType: '3',
    isTestnet: true,
};

const dogecoin_regtest: DogecoinNetwork = {
    name: 'dogecoin_regtest',
    messagePrefix: '\x18Dogecoin Signed Message:\n',
    bech32: 'bcrt',
    // Refer https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
    // Use tprv/tpub same as Bitcoin
    bip32: {
      public: 0x043587cf,
      private: 0x04358394,
    },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
    coinType: '1',
    isTestnet: true,
};

const DogecoinNetworks = {
    dogecoin,
    dogecoin_testnet,
    dogecoin_regtest,
};

export { DogecoinNetworks };
