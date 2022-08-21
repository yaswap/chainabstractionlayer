# Chain Abstraction Layer <img align="right" src="https://raw.githubusercontent.com/liquality/chainabstractionlayer/master/liquality-logo.png" height="80px" />


![Test Status](https://github.com/liquality/chainabstractionlayer/workflows/test/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/liquality/chainabstractionlayer/badge.svg?branch=master)](https://coveralls.io/github/liquality/chainabstractionlayer?branch=master)
[![Standard Code Style](https://img.shields.io/badge/codestyle-standard-brightgreen.svg)](https://github.com/standard/standard)
[![MIT License](https://img.shields.io/badge/license-MIT-brightgreen.svg)](./LICENSE.md)
[![Gitter](https://img.shields.io/gitter/room/liquality/Lobby.svg)](https://gitter.im/liquality/Lobby?source=orgpage)
[![Telegram](https://img.shields.io/badge/chat-on%20telegram-blue.svg)](https://t.me/Liquality) [![Greenkeeper badge](https://badges.greenkeeper.io/liquality/chainabstractionlayer.svg)](https://greenkeeper.io/)

> :warning: This project is under heavy development. Expect bugs & breaking changes.

### :pencil: [Introductory Blog Post: The Missing Tool to Cross-Chain Development](https://medium.com/liquality/the-missing-tool-to-cross-chain-development-2ebfe898efa1)

Query different blockchains with account management using a single and simple interface.

## Packages

|Package|Version|
|---|---|
|[@yaswap/bitcoin-js-wallet-provider](./packages/bitcoin-js-wallet-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/bitcoin-js-wallet-provider.svg)](https://npmjs.com/package/@yaswap/bitcoin-js-wallet-provider)|
|[@yaswap/bitcoin-ledger-provider](./packages/bitcoin-ledger-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/bitcoin-ledger-provider.svg)](https://npmjs.com/package/@yaswap/bitcoin-ledger-provider)|
|[@yaswap/bitcoin-networks](./packages/bitcoin-networks)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/bitcoin-networks.svg)](https://npmjs.com/package/@yaswap/bitcoin-networks)|
|[@yaswap/bitcoin-rpc-provider](./packages/bitcoin-rpc-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/bitcoin-rpc-provider.svg)](https://npmjs.com/package/@yaswap/bitcoin-rpc-provider)|
|[@yaswap/bitcoin-wallet-node-provider](./packages/bitcoin-node-wallet-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/bitcoin-node-wallet-provider.svg)](https://npmjs.com/package/@yaswap/bitcoin-node-wallet-provider)|
|[@yaswap/bitcoin-swap-provider](./packages/bitcoin-swap-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/bitcoin-swap-provider.svg)](https://npmjs.com/package/@yaswap/bitcoin-swap-provider)|
|[@yaswap/bitcoin-esplora-api-provider](./packages/bitcoin-esplora-api-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/bitcoin-esplora-api-provider.svg)](https://npmjs.com/package/@yaswap/bitcoin-esplora-api-provider)|
|[@yaswap/bitcoin-esplora-swap-find-provider](./packages/bitcoin-esplora-swap-find-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/bitcoin-esplora-swap-find-provider.svg)](https://npmjs.com/package/@yaswap/bitcoin-esplora-swap-find-provider)|
|[@yaswap/bitcoin-utils](./packages/bitcoin-utils)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/bitcoin-utils.svg)](https://npmjs.com/package/@yaswap/bitcoin-utils)|
|[@yaswap/client](./packages/client)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/client.svg)](https://npmjs.com/package/@yaswap/client)|
|[@yaswap/crypto](./packages/crypto)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/crypto.svg)](https://npmjs.com/package/@yaswap/crypto)|
|[@yaswap/debug](./packages/debug)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/debug.svg)](https://npmjs.com/package/@yaswap/debug)|
|[@yaswap/errors](./packages/errors)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/errors.svg)](https://npmjs.com/package/@yaswap/errors)|
|[@yaswap/ethereum-erc20-provider](./packages/ethereum-erc20-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/ethereum-erc20-provider.svg)](https://npmjs.com/package/@yaswap/ethereum-erc20-provider)|
|[@yaswap/ethereum-erc20-swap-provider](./packages/ethereum-erc20-swap-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/ethereum-erc20-swap-provider.svg)](https://npmjs.com/package/@yaswap/ethereum-erc20-swap-provider)|
|[@yaswap/ethereum-ledger-provider](./packages/ethereum-ledger-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/ethereum-ledger-provider.svg)](https://npmjs.com/package/@yaswap/ethereum-ledger-provider)|
|[@yaswap/ethereum-wallet-api-provider](./packages/ethereum-wallet-api-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/ethereum-wallet-api-provider.svg)](https://npmjs.com/package/@yaswap/ethereum-wallet-api-provider)|
|[@yaswap/ethereum-networks](./packages/ethereum-networks)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/ethereum-networks.svg)](https://npmjs.com/package/@yaswap/ethereum-networks)|
|[@yaswap/ethereum-rpc-provider](./packages/ethereum-rpc-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/ethereum-rpc-provider.svg)](https://npmjs.com/package/@yaswap/ethereum-rpc-provider)|
|[@yaswap/ethereum-js-wallet-provider](./packages/ethereum-js-wallet-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/ethereum-js-wallet-provider.svg)](https://npmjs.com/package/@yaswap/ethereum-js-wallet-provider)|
|[@yaswap/ethereum-swap-provider](./packages/ethereum-swap-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/ethereum-swap-provider.svg)](https://npmjs.com/package/@yaswap/ethereum-swap-provider)|
|[@yaswap/ethereum-scraper-swap-find-provider](./packages/ethereum-scraper-swap-find-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/ethereum-scraper-swap-find-provider.svg)](https://npmjs.com/package/@yaswap/ethereum-scraper-swap-find-provider)|
|[@yaswap/ethereum-utils](./packages/ethereum-utils)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/ethereum-utils.svg)](https://npmjs.com/package/@yaswap/ethereum-utils)|
|[@yaswap/jsonrpc-provider](./packages/jsonrpc-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/jsonrpc-provider.svg)](https://npmjs.com/package/@yaswap/jsonrpc-provider)|
|[@yaswap/ledger-provider](./packages/ledger-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/ledger-provider.svg)](https://npmjs.com/package/@yaswap/ledger-provider)|
|[@yaswap/provider](./packages/provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/provider.svg)](https://npmjs.com/package/@yaswap/provider)|
|[@yaswap/schema](./packages/schema)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/schema.svg)](https://npmjs.com/package/@yaswap/schema)|
|[@yaswap/utils](./packages/utils)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/utils.svg)](https://npmjs.com/package/@yaswap/utils)|
|[@yaswap/wallet-provider](./packages/wallet-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yaswap/wallet-provider.svg)](https://npmjs.com/package/@yaswap/wallet-provider)|


## Usage

```javascript
import { Client } from '@yaswap/client'
import { BitcoinRpcProvider } from '@yaswap/bitcoin-rpc-provider'
import { EthereumRpcProvider } from '@yaswap/ethereum-rpc-provider'

import { BitcoinLedgerProvider } from '@yaswap/bitcoin-ledger-provider'
import { EthereumLedgerProvider } from '@yaswap/ethereum-ledger-provider'

import { BitcoinNetworks } from '@yaswap/bitcoin-networks'
import { EthereumNetworks } from '@yaswap/ethereum-networks'

const bitcoin = new Client()
const ethereum = new Client()

bitcoin.addProvider(new BitcoinRpcProvider(
  'https://liquality.io/bitcointestnetrpc/', 'bitcoin', 'local321'
))
ethereum.addProvider(new EthereumRpcProvider(
  'https://rinkeby.infura.io/v3/xxx'
))

bitcoin.addProvider(new BitcoinLedgerProvider(
  { network: BitcoinNetworks.bitcoin_testnet }
))
ethereum.addProvider(new EthereumLedgerProvider(
  { network: EthereumNetworks.rinkeby }
))

// Fetch addresses from Ledger wallet using a single-unified API
const [ bitcoinAddress ] = await bitcoin.wallet.getAddresses(0, 1)
const [ ethereumAddress ] = await ethereum.wallet.getAddresses(0, 1)

// Sign a message
const signedMessageBitcoin = await bitcoin.wallet.signMessage(
  'The Times 3 January 2009 Chancellor on brink of second bailout for banks', bitcoinAddress
)
const signedMessageEthereum = await ethereum.wallet.signMessage(
  'The Times 3 January 2009 Chancellor on brink of second bailout for banks', ethereumAddress
)

// Send a transaction
await bitcoin.chain.sendTransaction(<to>, 1000)
await ethereum.chain.sendTransaction(<to>, 1000)
```


## Development

```bash
npm install
npm run bootstrap
npm run watch
```


## Production

```bash
npm run build
```


## Publish

```bash
npm run new:version # prepare
npm run publish:all # publish
```


## License

[MIT](./LICENSE.md)
