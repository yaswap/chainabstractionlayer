# Chainify <img align="right" src="https://raw.githubusercontent.com/liquality/chainabstractionlayer/master/liquality-logo.png" height="80px" />

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
| [@yac-swap/bitcoin](./packages/bitcoin)               |        [![Chainify](https://img.shields.io/npm/v/@yac-swap/bitcoin?style=for-the-badge)](https://npmjs.com/package/@yac-swap/bitcoin)        |
| [@yac-swap/bitcoin-ledger](./packages/bitcoin-ledger) | [![Chainify](https://img.shields.io/npm/v/@yac-swap/bitcoin-ledger?style=for-the-badge)](https://npmjs.com/package/@yac-swap/bitcoin-ledger) |
| [@yac-swap/client](./packages/client)                 |         [![Chainify](https://img.shields.io/npm/v/@yac-swap/client?style=for-the-badge)](https://npmjs.com/package/@yac-swap/client)         |
| [@yac-swap/errors](./packages/errors)                 |         [![Chainify](https://img.shields.io/npm/v/@yac-swap/errors?style=for-the-badge)](https://npmjs.com/package/@yac-swap/errors)         |
| [@yac-swap/evm](./packages/evm)                       |            [![Chainify](https://img.shields.io/npm/v/@yac-swap/evm?style=for-the-badge)](https://npmjs.com/package/@yac-swap/evm)            |
| [@yac-swap/evm-contracts](./packages/evm-contracts)   |  [![Chainify](https://img.shields.io/npm/v/@yac-swap/evm-contracts?style=for-the-badge)](https://npmjs.com/package/@yac-swap/evm-contracts)  |
| [@yac-swap/evm-ledger](./packages/evm-ledger)         |     [![Chainify](https://img.shields.io/npm/v/@yac-swap/evm-ledger?style=for-the-badge)](https://npmjs.com/package/@yac-swap/evm-ledger)     |
| [@yac-swap/hw-ledger](./packages/hw-ledger)           |      [![Chainify](https://img.shields.io/npm/v/@yac-swap/hw-ledger?style=for-the-badge)](https://npmjs.com/package/@yac-swap/hw-ledger)      |
| [@yac-swap/logger](./packages/logger)                 |         [![Chainify](https://img.shields.io/npm/v/@yac-swap/logger?style=for-the-badge)](https://npmjs.com/package/@yac-swap/logger)         |
| [@yac-swap/near](./packages/near)                     |           [![Chainify](https://img.shields.io/npm/v/@yac-swap/near?style=for-the-badge)](https://npmjs.com/package/@yac-swap/near)           |
| [@yac-swap/solana](./packages/solana)                 |         [![Chainify](https://img.shields.io/npm/v/@yac-swap/solana?style=for-the-badge)](https://npmjs.com/package/@yac-swap/solana)         |
| [@yac-swap/terra](./packages/terra)                   |          [![Chainify](https://img.shields.io/npm/v/@yac-swap/terra?style=for-the-badge)](https://npmjs.com/package/@yac-swap/terra)          |
| [@yac-swap/types](./packages/types)                   |          [![Chainify](https://img.shields.io/npm/v/@yac-swap/types?style=for-the-badge)](https://npmjs.com/package/@yac-swap/types)          |
| [@yac-swap/utils](./packages/utils)                   |          [![Chainify](https://img.shields.io/npm/v/@yac-swap/utils?style=for-the-badge)](https://npmjs.com/package/@yac-swap/utils)          |

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
