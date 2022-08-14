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
|[@yac-swap/bitcoin-js-wallet-provider](./packages/bitcoin-js-wallet-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yac-swap/bitcoin-js-wallet-provider.svg)](https://npmjs.com/package/@yac-swap/bitcoin-js-wallet-provider)|
|[@yac-swap/bitcoin-ledger-provider](./packages/bitcoin-ledger-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yac-swap/bitcoin-ledger-provider.svg)](https://npmjs.com/package/@yac-swap/bitcoin-ledger-provider)|
|[@yac-swap/bitcoin-networks](./packages/bitcoin-networks)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yac-swap/bitcoin-networks.svg)](https://npmjs.com/package/@yac-swap/bitcoin-networks)|
|[@yac-swap/bitcoin-rpc-provider](./packages/bitcoin-rpc-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yac-swap/bitcoin-rpc-provider.svg)](https://npmjs.com/package/@yac-swap/bitcoin-rpc-provider)|
|[@yac-swap/bitcoin-wallet-node-provider](./packages/bitcoin-node-wallet-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yac-swap/bitcoin-node-wallet-provider.svg)](https://npmjs.com/package/@yac-swap/bitcoin-node-wallet-provider)|
|[@yac-swap/bitcoin-swap-provider](./packages/bitcoin-swap-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yac-swap/bitcoin-swap-provider.svg)](https://npmjs.com/package/@yac-swap/bitcoin-swap-provider)|
|[@yac-swap/bitcoin-esplora-api-provider](./packages/bitcoin-esplora-api-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yac-swap/bitcoin-esplora-api-provider.svg)](https://npmjs.com/package/@yac-swap/bitcoin-esplora-api-provider)|
|[@yac-swap/bitcoin-esplora-swap-find-provider](./packages/bitcoin-esplora-swap-find-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yac-swap/bitcoin-esplora-swap-find-provider.svg)](https://npmjs.com/package/@yac-swap/bitcoin-esplora-swap-find-provider)|
|[@yac-swap/bitcoin-utils](./packages/bitcoin-utils)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yac-swap/bitcoin-utils.svg)](https://npmjs.com/package/@yac-swap/bitcoin-utils)|
|[@liquality/client](./packages/client)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@liquality/client.svg)](https://npmjs.com/package/@liquality/client)|
|[@liquality/crypto](./packages/crypto)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@liquality/crypto.svg)](https://npmjs.com/package/@liquality/crypto)|
|[@liquality/debug](./packages/debug)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@liquality/debug.svg)](https://npmjs.com/package/@liquality/debug)|
|[@liquality/errors](./packages/errors)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@liquality/errors.svg)](https://npmjs.com/package/@liquality/errors)|
|[@yac-swap/ethereum-erc20-provider](./packages/ethereum-erc20-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yac-swap/ethereum-erc20-provider.svg)](https://npmjs.com/package/@yac-swap/ethereum-erc20-provider)|
|[@yac-swap/ethereum-erc20-swap-provider](./packages/ethereum-erc20-swap-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yac-swap/ethereum-erc20-swap-provider.svg)](https://npmjs.com/package/@yac-swap/ethereum-erc20-swap-provider)|
|[@yac-swap/ethereum-ledger-provider](./packages/ethereum-ledger-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yac-swap/ethereum-ledger-provider.svg)](https://npmjs.com/package/@yac-swap/ethereum-ledger-provider)|
|[@yac-swap/ethereum-wallet-api-provider](./packages/ethereum-wallet-api-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yac-swap/ethereum-wallet-api-provider.svg)](https://npmjs.com/package/@yac-swap/ethereum-wallet-api-provider)|
|[@yac-swap/ethereum-networks](./packages/ethereum-networks)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yac-swap/ethereum-networks.svg)](https://npmjs.com/package/@yac-swap/ethereum-networks)|
|[@yac-swap/ethereum-rpc-provider](./packages/ethereum-rpc-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yac-swap/ethereum-rpc-provider.svg)](https://npmjs.com/package/@yac-swap/ethereum-rpc-provider)|
|[@yac-swap/ethereum-js-wallet-provider](./packages/ethereum-js-wallet-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yac-swap/ethereum-js-wallet-provider.svg)](https://npmjs.com/package/@yac-swap/ethereum-js-wallet-provider)|
|[@yac-swap/ethereum-swap-provider](./packages/ethereum-swap-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yac-swap/ethereum-swap-provider.svg)](https://npmjs.com/package/@yac-swap/ethereum-swap-provider)|
|[@yac-swap/ethereum-scraper-swap-find-provider](./packages/ethereum-scraper-swap-find-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yac-swap/ethereum-scraper-swap-find-provider.svg)](https://npmjs.com/package/@yac-swap/ethereum-scraper-swap-find-provider)|
|[@yac-swap/ethereum-utils](./packages/ethereum-utils)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@yac-swap/ethereum-utils.svg)](https://npmjs.com/package/@yac-swap/ethereum-utils)|
|[@liquality/jsonrpc-provider](./packages/jsonrpc-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@liquality/jsonrpc-provider.svg)](https://npmjs.com/package/@liquality/jsonrpc-provider)|
|[@liquality/ledger-provider](./packages/ledger-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@liquality/ledger-provider.svg)](https://npmjs.com/package/@liquality/ledger-provider)|
|[@liquality/provider](./packages/provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@liquality/provider.svg)](https://npmjs.com/package/@liquality/provider)|
|[@liquality/schema](./packages/schema)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@liquality/schema.svg)](https://npmjs.com/package/@liquality/schema)|
|[@liquality/utils](./packages/utils)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@liquality/utils.svg)](https://npmjs.com/package/@liquality/utils)|
|[@liquality/wallet-provider](./packages/wallet-provider)|[![ChainAbstractionLayer](https://img.shields.io/npm/v/@liquality/wallet-provider.svg)](https://npmjs.com/package/@liquality/wallet-provider)|


## Usage

```javascript
import { Client } from '@liquality/client'
import { BitcoinRpcProvider } from '@yac-swap/bitcoin-rpc-provider'
import { EthereumRpcProvider } from '@yac-swap/ethereum-rpc-provider'

import { BitcoinLedgerProvider } from '@yac-swap/bitcoin-ledger-provider'
import { EthereumLedgerProvider } from '@yac-swap/ethereum-ledger-provider'

import { BitcoinNetworks } from '@yac-swap/bitcoin-networks'
import { EthereumNetworks } from '@yac-swap/ethereum-networks'

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
