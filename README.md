# Chainify <img align="right" src="https://raw.githubusercontent.com/yaswap/chainabstractionlayer/master/yaswap-logo.png" height="80px" />

<pre>
   ________          _       _ ____     
  / ____/ /_  ____ _(_)___  (_) __/_  __
 / /   / __ \/ __ `/ / __ \/ / /_/ / / /
/ /___/ / / / /_/ / / / / / / __/ /_/ / 
\____/_/ /_/\__,_/_/_/ /_/_/_/  \__, /  
                               /____/   
</pre>
                               
Chainify is a flexible, modular library for developing disintermediated solutions across different blockchains.

The repository uses [yarn workspaces](https://yarnpkg.com/features/workspaces) for fast, reliable, and secure dependency management.

The build system is using [Turborepo](https://turborepo.org/)

### Packages
| Package                                               |                                                                    Version                                                                   |
| :---------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------: |
| [@yaswap/bitcoin](./packages/bitcoin)               |        [![Chainify](https://img.shields.io/npm/v/@yaswap/bitcoin?style=for-the-badge)](https://npmjs.com/package/@yaswap/bitcoin)        |
| [@yaswap/bitcoin-ledger](./packages/bitcoin-ledger) | [![Chainify](https://img.shields.io/npm/v/@yaswap/bitcoin-ledger?style=for-the-badge)](https://npmjs.com/package/@yaswap/bitcoin-ledger) |
| [@yaswap/client](./packages/client)                 |         [![Chainify](https://img.shields.io/npm/v/@yaswap/client?style=for-the-badge)](https://npmjs.com/package/@yaswap/client)         |
| [@yaswap/errors](./packages/errors)                 |         [![Chainify](https://img.shields.io/npm/v/@yaswap/errors?style=for-the-badge)](https://npmjs.com/package/@yaswap/errors)         |
| [@yaswap/evm](./packages/evm)                       |            [![Chainify](https://img.shields.io/npm/v/@yaswap/evm?style=for-the-badge)](https://npmjs.com/package/@yaswap/evm)            |
| [@yaswap/evm-contracts](./packages/evm-contracts)   |  [![Chainify](https://img.shields.io/npm/v/@yaswap/evm-contracts?style=for-the-badge)](https://npmjs.com/package/@yaswap/evm-contracts)  |
| [@yaswap/evm-ledger](./packages/evm-ledger)         |     [![Chainify](https://img.shields.io/npm/v/@yaswap/evm-ledger?style=for-the-badge)](https://npmjs.com/package/@yaswap/evm-ledger)     |
| [@yaswap/hw-ledger](./packages/hw-ledger)           |      [![Chainify](https://img.shields.io/npm/v/@yaswap/hw-ledger?style=for-the-badge)](https://npmjs.com/package/@yaswap/hw-ledger)      |
| [@yaswap/logger](./packages/logger)                 |         [![Chainify](https://img.shields.io/npm/v/@yaswap/logger?style=for-the-badge)](https://npmjs.com/package/@yaswap/logger)         |
| [@yaswap/near](./packages/near)                     |           [![Chainify](https://img.shields.io/npm/v/@yaswap/near?style=for-the-badge)](https://npmjs.com/package/@yaswap/near)           |
| [@yaswap/solana](./packages/solana)                 |         [![Chainify](https://img.shields.io/npm/v/@yaswap/solana?style=for-the-badge)](https://npmjs.com/package/@yaswap/solana)         |
| [@yaswap/terra](./packages/terra)                   |          [![Chainify](https://img.shields.io/npm/v/@yaswap/terra?style=for-the-badge)](https://npmjs.com/package/@yaswap/terra)          |
| [@yaswap/types](./packages/types)                   |          [![Chainify](https://img.shields.io/npm/v/@yaswap/types?style=for-the-badge)](https://npmjs.com/package/@yaswap/types)          |
| [@yaswap/utils](./packages/utils)                   |          [![Chainify](https://img.shields.io/npm/v/@yaswap/utils?style=for-the-badge)](https://npmjs.com/package/@yaswap/utils)          |

### Install dependencies
```bash
yarn install
```

### Build all packages
```bash
yarn build
```

### Run all tests
```bash 
yarn test
```

### Release a new version
```bash
yarn changeset
   # choose the version bump - major, minor or patch
   # add change summary

yarn version
   # review changes
   # yarn build —force

yarn release
yarn tag
```

### License
[MIT](./LICENSE.md)
