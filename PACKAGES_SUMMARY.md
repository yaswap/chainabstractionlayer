# Bitcoin, Litecoin, Dogecoin, and Yacoin Packages Summary

## Overview

These packages (`@yaswap/bitcoin`, `@yaswap/litecoin`, `@yaswap/dogecoin`, `@yaswap/yacoin`) are part of the YaSwap Chain Abstraction Layer. They provide unified interfaces for interacting with Bitcoin-like cryptocurrencies, implementing wallet management, blockchain queries, and atomic swap functionality. Yacoin additionally supports native token creation and NFT functionality.

## Architecture

Each package follows a modular architecture with three main components:

1. **Chain Providers** - Interface with blockchain nodes/APIs
2. **Wallet Providers** - Manage keys, addresses, and transaction signing
3. **Swap Providers** - Handle atomic swap transactions

**Yacoin** additionally includes:
4. **NFT Provider** - Native NFT creation, transfer, and management

---

## Package Structure

### Common Components

All three packages share similar structures:

```
lib/
├── chain/          # Blockchain interaction providers
│   ├── esplora/    # Esplora API providers (block explorer API)
│   └── jsonRpc/    # JSON-RPC providers (direct node connection)
├── wallet/         # Wallet implementations
│   ├── *HDWallet.ts        # HD wallet from mnemonic
│   ├── *SingleWallet.ts    # Single key wallet
│   └── *NodeWallet.ts      # Node-based wallet
├── swap/           # Atomic swap providers
├── fee/            # Fee estimation (Bitcoin/Litecoin/Yacoin)
├── nft/            # NFT provider (Yacoin only)
├── networks.ts     # Network configurations
├── types.ts        # TypeScript type definitions
└── utils.ts        # Utility functions
```

---

## Bitcoin Package (`@yaswap/bitcoin`)

### Features

- **Most complete implementation** with full feature set
- Supports multiple address types: Legacy, P2SH-SegWit, Bech32 (native SegWit)
- Multiple chain providers: Esplora API and JSON-RPC
- Fee estimation provider
- Atomic swap support with multiple modes (P2WSH, P2SH-SegWit, P2SH)

### Key Components

#### Chain Providers
- `BitcoinEsploraApiProvider` - Uses Esplora block explorer API
- `BitcoinJsonRpcProvider` - Direct connection to Bitcoin node via JSON-RPC
- `BitcoinBaseChainProvider` - Abstract base class

#### Wallet Providers
- `BitcoinHDWalletProvider` - HD wallet from BIP39 mnemonic (BIP32/BIP44)
- `BitcoinSingleWallet` - Single private key wallet
- `BitcoinNodeWallet` - Wallet using external node's keys

#### Swap Providers
- `BitcoinSwapEsploraProvider` - Atomic swaps using Esplora
- `BitcoinSwapRpcProvider` - Atomic swaps using JSON-RPC

### Networks
- `bitcoin` - Mainnet
- `bitcoin_testnet` - Testnet
- `bitcoin_regtest` - Regtest (local testing)

---

## Litecoin Package (`@yaswap/litecoin`)

### Features

- **Similar to Bitcoin** but optimized for Litecoin
- Supports Legacy, P2SH-SegWit, and Bech32 address types
- Uses Litecoin-specific coin selection (`@yaswap/litecoinselect`)
- Esplora and JSON-RPC chain providers
- Fee estimation provider

### Key Differences from Bitcoin

- Different network parameters (address prefixes: L/M for mainnet)
- Coin type: 2 (vs Bitcoin's 0)
- Uses Litecoin-specific network configurations

### Networks
- `litecoin` - Mainnet
- `litecoin_testnet` - Testnet
- `litecoin_regtest` - Regtest

---

## Dogecoin Package (`@yaswap/dogecoin`)

### Features

- **Simpler implementation** compared to Bitcoin/Litecoin
- Primarily uses Esplora API (no JSON-RPC provider in base)
- Legacy address type by default (Dogecoin doesn't fully support SegWit)
- Uses WebSocket ElectrumX client (`@yaswap/ws-electrumx-client`)
- No separate fee provider

### Key Differences

- Simpler architecture (fewer provider options)
- Legacy addresses preferred (addresses start with D/A)
- Coin type: 3
- Different BIP32 version bytes

### Networks
- `dogecoin` - Mainnet
- `dogecoin_testnet` - Testnet
- `dogecoin_regtest` - Regtest

---

## Yacoin Package (`@yaswap/yacoin`)

### Features

- **Extended Bitcoin-like blockchain** with native token and NFT support
- Uses custom `@yaswap/yacoinjs-lib` library (forked from bitcoinjs-lib)
- **Native token creation** (YA-Token) with customizable properties
- **NFT support** (YA-NFT) with IPFS metadata
- Legacy address type only (P2PKH)
- Esplora API chain provider
- Fee estimation provider
- **Timelock functionality** for advanced transaction features
- Token balance queries and management

### Key Components

#### Chain Providers
- `YacoinEsploraApiProvider` - Uses custom Esplora block explorer API
- `YacoinBaseChainProvider` - Abstract base class with token/NFT methods

#### Wallet Providers
- `YacoinHDWalletProvider` - HD wallet from BIP39 mnemonic
- `YacoinSingleWallet` - Single private key wallet

#### Swap Providers
- `YacoinSwapEsploraProvider` - Atomic swaps using Esplora (P2SH mode only)

#### NFT Provider
- `YacoinNftProvider` - Native NFT creation, transfer, and metadata management

### Unique Features

#### Token Creation (YA-Token)
- Create custom tokens with configurable properties:
  - Token name and symbol
  - Total supply and decimals
  - Reissuable flag
  - IPFS hash for metadata
- Sub-token support (tokens within tokens)
- Token transfer functionality

#### NFT Creation (YA-NFT)
- Create unique non-fungible tokens
- Format: `CollectionName#TokenName`
- IPFS metadata support (images, descriptions, documents)
- Automatic metadata fetching from IPFS

#### Timelock Support
- CSV (CheckSequenceVerify) timelock scripts
- Time-locked transactions for advanced use cases
- Timelock fee mechanism (2100 YAC for 21000 blocks)

### Key Differences from Bitcoin

- Uses `@yaswap/yacoinjs-lib` instead of `bitcoinjs-lib`
- Uses `@yaswap/yacoinjs-coinselect` for coin selection
- Uses `TransactionBuilder` instead of PSBT (similar to Dogecoin)
- Only Legacy address type supported
- Extended UTXO model with token values
- Custom Esplora API endpoints
- Token-aware transaction building

### Networks
- `yacoin` - Mainnet
- `yacoin_testnet` - Testnet
- `yacoin_regtest` - Regtest

---

## Core Logic

### 1. HD Wallet Logic

All packages implement HD (Hierarchical Deterministic) wallets using:
- **BIP39**: Mnemonic phrase to seed conversion
- **BIP32**: Hierarchical key derivation
- **BIP44**: Standard derivation paths

**Derivation Path Format:**
```
m / purpose' / coin_type' / account' / change / address_index
```

Example for Bitcoin:
- Base path: `m/84'/0'/0'` (Bech32, account 0)
- External addresses: `m/84'/0'/0'/0/0`, `m/84'/0'/0'/0/1`, ...
- Change addresses: `m/84'/0'/0'/1/0`, `m/84'/0'/0'/1/1`, ...

### 2. Transaction Building

The wallet providers build transactions using:
- **PSBT (Partially Signed Bitcoin Transactions)** for modern address types (Bitcoin/Litecoin)
- **TransactionBuilder** for Legacy addresses (Dogecoin/Yacoin)
- **Coin selection algorithm** to select optimal UTXOs
- **Fee calculation** based on transaction size and fee rate
- **Change address generation** when needed
- **Token-aware coin selection** (Yacoin only) - handles both native currency and tokens

### 3. Address Types

- **Legacy (P2PKH)**: Oldest format, starts with 1 (Bitcoin) or L (Litecoin) or D (Dogecoin)
- **P2SH-SegWit**: SegWit wrapped in P2SH, starts with 3
- **Bech32 (Native SegWit)**: Modern format, starts with bc1 (Bitcoin) or ltc1 (Litecoin)

### 4. Atomic Swaps

The swap providers implement atomic swaps using hash time-locked contracts (HTLC):
- **Initiate**: Lock funds in a swap script
- **Claim**: Recipient claims with secret
- **Refund**: Sender can refund after expiration

### 5. Token and NFT Support (Yacoin Only)

Yacoin implements native token and NFT functionality:
- **YA-Token**: Custom tokens with configurable supply, decimals, and reissuability
- **YA-NFT**: Unique tokens with IPFS metadata
- **Token Scripts**: Custom Bitcoin script extensions for token operations
- **Token UTXOs**: Extended UTXO model supporting token values alongside native currency
- **Metadata Management**: IPFS-based metadata storage and retrieval

---

## Usage Examples

### Bitcoin - HD Wallet with Esplora

```typescript
import * as BTC from '@yaswap/bitcoin';
import { Client } from '@yaswap/client';
import { BigNumber } from '@yaswap/types';

// 1. Create chain provider (Esplora API)
const chainProvider = new BTC.BitcoinEsploraApiProvider({
  network: BTC.BitcoinNetworks.bitcoin_testnet,
  url: 'https://blockstream.info/testnet/api',
});

// 2. Create wallet provider
const walletProvider = new BTC.BitcoinHDWalletProvider({
  mnemonic: 'your twelve word mnemonic phrase here goes like this example',
  baseDerivationPath: "m/84'/1'/0'", // Testnet Bech32
  addressType: BTC.BitcoinTypes.AddressType.BECH32,
  network: BTC.BitcoinNetworks.bitcoin_testnet,
}, chainProvider);

// 3. Create swap provider
const swapProvider = new BTC.BitcoinSwapEsploraProvider({
  network: BTC.BitcoinNetworks.bitcoin_testnet,
  mode: BTC.BitcoinTypes.SwapMode.P2WSH,
}, walletProvider);

// 4. Create client
const client = new Client(chainProvider, walletProvider, swapProvider);

// Usage examples:

// Get address
const address = await walletProvider.getAddress();
console.log('Address:', address.toString());

// Get balance
const balance = await walletProvider.getBalance([]);
console.log('Balance:', balance[0].toString(), 'satoshis');

// Send transaction
const tx = await walletProvider.sendTransaction({
  to: 'tb1q...', // recipient address
  value: new BigNumber(100000), // 0.001 BTC in satoshis
  fee: 10, // satoshis per byte
});

console.log('Transaction hash:', tx.hash);

// Get transaction
const transaction = await chainProvider.getTransactionByHash(tx.hash);
console.log('Transaction:', transaction);
```

### Bitcoin - HD Wallet with JSON-RPC

```typescript
import * as BTC from '@yaswap/bitcoin';

// Create JSON-RPC chain provider
const chainProvider = new BTC.BitcoinJsonRpcProvider({
  network: BTC.BitcoinNetworks.bitcoin,
  url: 'http://localhost:8332',
  username: 'rpcuser',
  password: 'rpcpassword',
});

// Create wallet (same as above)
const walletProvider = new BTC.BitcoinHDWalletProvider({
  mnemonic: 'your mnemonic',
  baseDerivationPath: "m/84'/0'/0'",
  addressType: BTC.BitcoinTypes.AddressType.BECH32,
  network: BTC.BitcoinNetworks.bitcoin,
}, chainProvider);

// Create swap provider with RPC
const swapProvider = new BTC.BitcoinSwapRpcProvider({
  network: BTC.BitcoinNetworks.bitcoin,
}, walletProvider);
```

### Litecoin - Similar Usage

```typescript
import * as LTC from '@yaswap/litecoin';

const chainProvider = new LTC.LitecoinEsploraApiProvider({
  network: LTC.LitecoinNetworks.litecoin,
  url: 'https://litecoinspace.org/api',
});

const walletProvider = new LTC.LitecoinHDWalletProvider({
  mnemonic: 'your mnemonic',
  baseDerivationPath: "m/84'/2'/0'", // Litecoin coin type is 2
  addressType: LTC.LitecoinTypes.AddressType.BECH32,
  network: LTC.LitecoinNetworks.litecoin,
}, chainProvider);

const swapProvider = new LTC.LitecoinSwapEsploraProvider({
  network: LTC.LitecoinNetworks.litecoin,
}, walletProvider);
```

### Dogecoin - Usage

```typescript
import * as DOGE from '@yaswap/dogecoin';

const chainProvider = new DOGE.DogecoinEsploraApiProvider({
  network: DOGE.DogecoinNetworks.dogecoin,
  url: 'https://dogechain.info/api',
});

const walletProvider = new DOGE.DogecoinHDWalletProvider({
  mnemonic: 'your mnemonic',
  baseDerivationPath: "m/44'/3'/0'", // Dogecoin coin type is 3, Legacy format
  addressType: DOGE.DogecoinTypes.AddressType.LEGACY, // Dogecoin uses Legacy
  network: DOGE.DogecoinNetworks.dogecoin,
}, chainProvider);

const swapProvider = new DOGE.DogecoinSwapEsploraProvider({
  network: DOGE.DogecoinNetworks.dogecoin,
}, walletProvider);
```

### Yacoin - Usage with Token and NFT Support

```typescript
import * as YAC from '@yaswap/yacoin';
import { BigNumber } from '@yaswap/types';

const chainProvider = new YAC.YacoinEsploraApiProvider({
  network: YAC.YacoinNetworks.yacoin,
  url: 'https://yacoin-api.example.com/api',
});

const walletProvider = new YAC.YacoinHDWalletProvider({
  mnemonic: 'your mnemonic',
  baseDerivationPath: "m/44'/0'/0'", // Yacoin uses coin type 0, Legacy format
  addressType: YAC.YacoinTypes.AddressType.LEGACY,
  network: YAC.YacoinNetworks.yacoin,
}, chainProvider);

const swapProvider = new YAC.YacoinSwapEsploraProvider({
  network: YAC.YacoinNetworks.yacoin,
}, walletProvider);

// Create NFT provider
const nftProvider = new YAC.YacoinNftProvider(walletProvider);

// Get token balances
const tokenBalances = await chainProvider.getTokenBalance([address]);
console.log('Token balances:', tokenBalances);

// Create a token (YA-Token)
const createTokenTx = await walletProvider.createToken({
  to: await walletProvider.getAddress(),
  value: new BigNumber(2100 * 1e6), // Timelock fee: 2100 YAC
  tokenName: 'MyToken',
  tokenAmount: 1000000, // 1 million tokens
  decimals: 6,
  reissuable: true,
  ipfsHash: 'Qm...', // IPFS hash for metadata
  fee: 10,
});

// Create an NFT (YA-NFT)
const createNftTx = await walletProvider.createToken({
  to: await walletProvider.getAddress(),
  value: new BigNumber(2100 * 1e6), // Timelock fee
  tokenName: 'MyCollection#Token1', // Format: Collection#TokenName
  tokenAmount: 1, // NFTs always have amount 1
  decimals: 0, // NFTs have 0 decimals
  reissuable: false, // NFTs are not reissuable
  ipfsHash: 'Qm...', // IPFS hash for NFT metadata
  fee: 10,
});

// Fetch NFTs
const nfts = await nftProvider.fetch();
console.log('NFTs:', nfts);

// Transfer NFT
const transferNftTx = await nftProvider.transfer(
  contractAddress, // NFT contract address (block hash)
  recipientAddress,
  ['CollectionName#TokenName'], // Token IDs
  undefined,
  undefined,
  10 // Fee
);

// Send token transaction
const tokenTx = await walletProvider.sendTransaction({
  to: recipientAddress,
  value: new BigNumber(1000000), // Native YAC amount
  asset: {
    contractAddress: tokenBlockHash,
    chain: ChainId.Yacoin,
    decimals: 6,
    code: 'MyToken',
    name: 'MyToken',
    type: AssetTypes.token,
  },
  fee: 10,
});
```

### Atomic Swap Example

```typescript
import { BigNumber } from '@yaswap/types';

// Initiate a swap
const swapParams = {
  value: new BigNumber(1000000), // 0.01 BTC
  recipientAddress: 'tb1q...', // Recipient's address
  refundAddress: await walletProvider.getAddress(), // Your refund address
  secretHash: '0x...', // SHA256 hash of secret (32 bytes hex)
  expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
};

const initiationTx = await swapProvider.initiateSwap(swapParams, 10); // 10 sat/b fee
console.log('Swap initiated:', initiationTx.hash);

// Claim swap (recipient side)
const secret = 'your 32-byte secret';
const claimTx = await swapProvider.claimSwap(
  swapParams,
  initiationTx.hash,
  secret,
  10
);
console.log('Swap claimed:', claimTx.hash);

// Refund swap (if not claimed)
const refundTx = await swapProvider.refundSwap(
  swapParams,
  initiationTx.hash,
  10
);
console.log('Swap refunded:', refundTx.hash);
```

### Advanced Features

#### Get Multiple Addresses

```typescript
// Get 5 external addresses starting from index 0
const addresses = await walletProvider.getAddresses(0, 5, false);
addresses.forEach(addr => console.log(addr.toString()));

// Get change addresses
const changeAddresses = await walletProvider.getAddresses(0, 5, true);
```

#### Sign Message

```typescript
const message = 'Hello, Bitcoin!';
const address = await walletProvider.getAddress();
const signature = await walletProvider.signMessage(message, address.toString());
console.log('Signature:', signature);
```

#### Update Transaction Fee (RBF - Replace By Fee)

```typescript
const tx = await chainProvider.getTransactionByHash('txhash...');
const updatedTx = await walletProvider.updateTransactionFee(tx, 20); // New fee: 20 sat/b
console.log('Updated transaction:', updatedTx.hash);
```

#### Sweep Transaction (Send all funds)

```typescript
const sweepTx = await walletProvider.sendSweepTransaction(
  'tb1q...', // External address to send all funds to
  null, // Asset (null for native currency)
  10 // Fee per byte
);
```

#### Sign PSBT (Partially Signed Bitcoin Transaction)

```typescript
const psbtBase64 = 'cHNidP8BA...'; // Base64 encoded PSBT
const inputs = [
  {
    index: 0,
    derivationPath: "m/84'/0'/0'/0/0",
  },
];

const signedPSBT = await walletProvider.signPSBT(psbtBase64, inputs);
console.log('Signed PSBT:', signedPSBT);
```

#### Yacoin - Token and NFT Operations

```typescript
// Get all token balances
const addresses = await walletProvider.getAddresses();
const tokenBalances = await chainProvider.getTokenBalance(addresses);
tokenBalances.forEach(token => {
  console.log(`${token.name}: ${token.balance} (${token.units} decimals)`);
});

// Get NFT balances
const nfts = await nftProvider.fetch();
nfts.forEach(nft => {
  console.log(`NFT: ${nft.name} from ${nft.collection.name}`);
  console.log(`Image: ${nft.image_original_url}`);
  console.log(`Description: ${nft.description}`);
});

// Create token with metadata
const tokenMetadata = {
  name: 'My Custom Token',
  description: 'A token for my project',
  imageURL: 'https://example.com/token.png',
  documents: ['https://example.com/whitepaper.pdf'],
};
// Upload metadata to IPFS first, then use the hash
const ipfsHash = 'Qm...'; // IPFS hash after uploading metadata

const createTokenTx = await walletProvider.createToken({
  to: await walletProvider.getAddress(),
  value: new BigNumber(2100 * 1e6), // Required timelock fee
  tokenName: 'MyToken',
  tokenAmount: 1000000,
  decimals: 8,
  reissuable: true,
  ipfsHash: ipfsHash,
  fee: 10,
});
```

---

## Key Differences Summary

| Feature | Bitcoin | Litecoin | Dogecoin | Yacoin |
|---------|---------|----------|----------|--------|
| **Coin Type** | 0 | 2 | 3 | 0 |
| **Address Types** | Legacy, P2SH-SegWit, Bech32 | Legacy, P2SH-SegWit, Bech32 | Legacy (primary) | Legacy only |
| **Chain Providers** | Esplora, JSON-RPC | Esplora, JSON-RPC | Esplora | Esplora |
| **Fee Provider** | Yes | Yes | No | Yes |
| **Default Address** | Bech32 | Bech32 | Legacy | Legacy |
| **Swap Modes** | P2WSH, P2SH-SegWit, P2SH | P2WSH, P2SH-SegWit, P2SH | Limited | P2SH only |
| **Transaction Builder** | PSBT | PSBT | TransactionBuilder | TransactionBuilder |
| **Token Support** | No | No | No | Yes (YA-Token) |
| **NFT Support** | No | No | No | Yes (YA-NFT) |
| **Timelock** | No | No | No | Yes |
| **Library** | bitcoinjs-lib | bitcoinjs-lib | bitcoinjs-lib | @yaswap/yacoinjs-lib |

---

## Dependencies

### Common Dependencies (All Packages)
- `bip32`, `bip39` - HD wallet key derivation
- `bip174` - PSBT support (Bitcoin/Litecoin)
- `bitcoinjs-message` - Message signing
- `@yaswap/client`, `@yaswap/types`, `@yaswap/utils` - Shared YaSwap infrastructure

### Package-Specific Dependencies
- **Bitcoin/Litecoin**: `bitcoinjs-lib`, `coinselect` or `@yaswap/bitcoinselect`/`@yaswap/litecoinselect`
- **Dogecoin**: `bitcoinjs-lib`, `coinselect`, `@yaswap/ws-electrumx-client`
- **Yacoin**: `@yaswap/yacoinjs-lib`, `@yaswap/yacoinjs-coinselect` (custom implementations)

---

## Best Practices

1. **Network Selection**: Always use testnet for development/testing
2. **Mnemonic Security**: Never commit mnemonics to version control
3. **Fee Estimation**: Use the fee provider or check current network conditions
4. **Address Types**: Prefer Bech32 (native SegWit) for Bitcoin/Litecoin for lower fees
5. **Error Handling**: Wrap operations in try-catch blocks
6. **Transaction Confirmation**: Always wait for confirmations before considering transactions final

---

## Type Definitions

Key types exported from each package:

- `*Network` - Network configuration
- `AddressType` - Enum for address types (LEGACY, P2SH_SEGWIT, BECH32)
- `SwapMode` - Enum for swap modes
- `UTXO` - Unspent transaction output
- `Transaction` - Transaction object
- `BitcoinHDWalletProviderOptions` - Wallet initialization options

---

## Notes

- All packages follow the same architectural pattern for consistency
- Bitcoin package is the most feature-complete reference implementation
- Litecoin and Dogecoin packages adapt Bitcoin's logic for their respective networks
- Yacoin extends the Bitcoin model with native token and NFT capabilities
- The packages are designed to work together in a multi-chain wallet application
- Atomic swaps enable trustless cross-chain exchanges
- Yacoin's token system uses custom Bitcoin scripts and extended UTXO model
- Yacoin NFTs require IPFS for metadata storage (images, descriptions, documents)
- Yacoin token creation requires timelock fees (2100 YAC locked for 21000 blocks)
