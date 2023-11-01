import { LitecoinNetwork } from './types';

const litecoin: LitecoinNetwork = {
    name: 'litecoin',
    messagePrefix: '\x18Litecoin Signed Message:\n',
    // Refer https://github.com/litecoin-project/litecoin/blob/master/src/chainparams.cpp#L139
    bech32: 'ltc',
    // Refer https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
    // Use xprv/xpub same as Bitcoin
    bip32: {
      public: 0x0488b21e,
      private: 0x0488ade4,
    },
    // Refer https://github.com/ltcsuite/ltcd/blob/master/chaincfg/params.go#L388-L389
    // or https://github.com/litecoin-project/litecoin/blob/master/src/chainparams.cpp#L132-L134
    pubKeyHash: 0x30, // starts with L
    scriptHash: 0x32, // starts with M
    // Refer https://github.com/ltcsuite/ltcd/blob/master/chaincfg/params.go#L390
    // or https://github.com/litecoin-project/litecoin/blob/master/src/chainparams.cpp#L135
    wif: 0xb0,
    // Refer https://github.com/satoshilabs/slips/blob/master/slip-0044.md#registered-coin-types
    coinType: '2',
    isTestnet: false,
};

// const litecoin_testnet: LitecoinNetwork = {
//     name: 'litecoin_testnet',
//     messagePrefix: '\x18Litecoin Signed Message:\n',
//     bech32: 'tltc',
//     // Refer https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
//     // Use tprv/tpub same as Bitcoin
//     bip32: {
//       public: 0x043587cf,
//       private: 0x04358394,
//     },
//     // Refer https://github.com/litecoin-project/litecoin/blob/master/src/chainparams.cpp#L242-L249
//     pubKeyHash: 0x6f,
//     scriptHash: 0xc4,
//     wif: 0xef,
//     coinType: '1',
//     isTestnet: true,
// };

const litecoin_testnet: LitecoinNetwork = {
  name: 'litecoin_testnet',
  messagePrefix: '\x18Litecoin Signed Message:\n',
  // Refer https://github.com/litecoin-project/litecoin/blob/master/src/chainparams.cpp#L139
  bech32: 'ltc',
  // Refer https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
  // Use xprv/xpub same as Bitcoin
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4,
  },
  // Refer https://github.com/ltcsuite/ltcd/blob/master/chaincfg/params.go#L388-L389
  // or https://github.com/litecoin-project/litecoin/blob/master/src/chainparams.cpp#L132-L134
  pubKeyHash: 0x30, // starts with L
  scriptHash: 0x32, // starts with M
  // Refer https://github.com/ltcsuite/ltcd/blob/master/chaincfg/params.go#L390
  // or https://github.com/litecoin-project/litecoin/blob/master/src/chainparams.cpp#L135
  wif: 0xb0,
  // Refer https://github.com/satoshilabs/slips/blob/master/slip-0044.md#registered-coin-types
  coinType: '2',
  isTestnet: true,
};

const litecoin_regtest: LitecoinNetwork = {
    name: 'litecoin_regtest',
    messagePrefix: '\x18Litecoin Signed Message:\n',
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

const LitecoinNetworks = {
    litecoin,
    litecoin_testnet,
    litecoin_regtest,
};

export { LitecoinNetworks };
