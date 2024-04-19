# @yaswap/logger

## 2.8.0

### Minor Changes

-   Add new return info to chain.getTokenBalance and nft.fetch

## 2.7.7

### Patch Changes

-   Remove debug log

## 2.7.6

### Patch Changes

-   Fetch multiple YA-NFT info at one time

## 2.7.5

### Patch Changes

-   Throw fee in InsufficientBalanceError for Yacoin

## 2.7.4

### Patch Changes

-   Correct formular to calculate yacoin transaction bytes

## 2.7.3

### Patch Changes

-   Change ipfs endpoint and timeout for getting token metadata

## 2.7.2

### Patch Changes

-   Init YacoinSingleWallet

## 2.7.1

### Patch Changes

-   Use bitcoinselect

## 2.7.0

### Minor Changes

-   Finalize single wallet version

## 2.6.6

### Patch Changes

-   Remove debug log

## 2.6.5

### Patch Changes

-   Use electrumClient to get transaction hex

## 2.6.4

### Patch Changes

-   Fix issue relating to integrate electrumClient

## 2.6.3

### Patch Changes

-   Replace blockCypher with electrumClient

## 2.6.2

### Patch Changes

-   Improve error handling

## 2.6.1

### Patch Changes

-   Fix issue which failed to get block info

## 2.6.0

### Minor Changes

-   Support dogecoin chain

## 2.5.3

### Patch Changes

-   Support documents field in token metadata

## 2.5.2

### Patch Changes

-   Add missing logic to find claim and refund transaction for EVM chain

## 2.5.1

### Patch Changes

-   Fix issue which fails to initiate swap transaction for YAC

## 2.5.0

### Minor Changes

-   Support litecoin chain

## 2.4.0

### Minor Changes

-   Add API to getBaseURL

## 2.3.3

### Patch Changes

-   Change timelock values to production

## 2.3.2

### Patch Changes

-   Fix token issues

## 2.3.1

### Patch Changes

-   Change timelock fee duration and amount

## 2.3.0

### Minor Changes

-   Support create YA-Token/YA-NFT

## 2.2.0

### Minor Changes

-   Integrate YA-token/YA-NFT

## 2.1.0

### Minor Changes

-   Support batch request for Yacoin

## 2.2.0

### Minor Changes

-   abdc69ead: Updated version

## 2.1.0

### Minor Changes

-   910879393: Set Fixed version of packages for ledger

## 2.0.0

### Major Changes

-   dbd8981ee: Updated version of ledger related packages

## 1.2.33

### Patch Changes

-   02c26c603: Fix nft image parsing

## 1.2.32

### Patch Changes

-   51db61f10: Minor bump on EVM

## 1.2.31

### Patch Changes

-   7996bf256: Near fee in number format.

## 1.2.30

### Patch Changes

-   01efb2cf4: Add setter and getter for provider in OptimismChainProvider.

## 1.2.29

### Patch Changes

-   c52ea66e4: add ethers as dependency

## 1.2.28

### Patch Changes

-   49b7538c5: remove optimism exports as they are using different ehters version

## 1.2.27

### Patch Changes

-   b332b8c61: patch @eth-optimism/sdk dependencies

## 1.2.26

### Patch Changes

-   57ccdb47a: export asL2Provider for optimism

## 1.2.25

### Patch Changes

-   44d79eb55: use asset.type instead of asset.isNative

## 1.2.24

### Patch Changes

-   74ba33141: Remove async from setters and getters in Chains class.

## 1.2.23

### Patch Changes

-   21cf21727: - fix github actions

## 1.2.22

### Patch Changes

-   23c964d0b: fee estimation for NFTs

## 1.2.21

### Patch Changes

-   2a17648d2: - fix script

## 1.2.20

### Patch Changes

-   4ba964b5b: - add npm auth token inside .yarnrc.yml

## 1.2.19

### Patch Changes

-   7e81ee996: - add npm auth token inside .yarnrc.yml

## 1.2.18

### Patch Changes

-   651760802: - fix github actions

## 1.2.17

### Patch Changes

-   3adef6d91: - fix github actions

## 1.2.16

### Patch Changes

-   83ea62866: - github actions

## 1.2.15

### Patch Changes

-   -   use `@solana/spl-token-registry`

## 1.2.14

### Patch Changes

-   -   solana nfts

## 1.2.13

### Patch Changes

-   -   fix fetching token details for Terra
    -   implement fetching token details for Solana

## 1.2.12

### Patch Changes

-   fix: nfts-on-arbitrum

## 1.2.11

### Patch Changes

-   fix: moralis nfts return amount and type

## 1.2.10

### Patch Changes

-   -   multicall improvements
        -   export multicall data type
        -   export method to build multicall data for fetching balances

## 1.2.9

### Patch Changes

-   -   extend Network type with `helperUrl`

## 1.2.8

### Patch Changes

-   -   fix for all evm chains when sending amounts >=1000

## 1.2.7

### Patch Changes

-   -   specify `from` property to EVM transactions when missing

## 1.2.6

### Patch Changes

-   -   use forked version of @rainbow-me/fee-suggestions
    -   support naming service for EVM chains
    -   ENS Provider

## 1.2.5

### Patch Changes

-   -   new eip1559 provider

## 1.2.4

### Patch Changes

-   -   do not add gas margin for sending native assets

## 1.2.3

### Patch Changes

-   -   fix exponent error for EVM swaps
    -   proper error handling when fetching balances
    -   add 50% gas limit margin for all EVM transactions
    -   new EIP1559 Fee API provider

## 1.2.2

### Patch Changes

-   Publish again - types not correctly published

## 1.2.1

### Patch Changes

-   rebuild

## 1.2.0

### Minor Changes

-   nft transfer takes decimal string for token id

## 1.1.2

### Patch Changes

-   -   Chain providers now have a new interface - `getTokenDetails`
    -   Network object can now be passed during EVM Fee providers creation
    -   NFTAsset type moved to global level

## 1.1.1

### Patch Changes

-   export base nft provider

## 1.1.0

### Minor Changes

-   Add moralis nft provider
    Standardise nft fetch response

## 1.0.12

### Patch Changes

-   -   terra fix for memo
    -   bump cryptoassets version
    -   bump terra-money.js version

## 1.0.11

### Patch Changes

-   -   add block hash to tx response for Near

## 1.0.10

### Patch Changes

-   -   fetch btc fees correctly

## 1.0.9

### Patch Changes

-   -   add flexible swap options for EVM chains
        -   numberOfBlocksPerRequest - the amount of blocks to search for events in a single call (default = 2000)
        -   totalNumberOfBlocks - the total number of blocks to search for events (default = 100_000)
        -   gasLimitMargin - percentage gas margin for chains that does not estimate gas correctly (e.g. RSK) (default=10%)
    -   add address cache for EVM ledger
    -   use toLowerCase in EVM ledger to support RSK checksum

## 1.0.8

### Patch Changes

-   -   target is now es6

## 1.0.7

### Patch Changes

-   -   ignore case when comparing addresses
    -   scrambleKey is now optional

## 1.0.6

### Patch Changes

-   -   solana balances fetching
    -   ledger fixes and improvements

## 1.0.5

### Patch Changes

-   390c4f829: - nft logic is now part of client
    -   getWalletPublicKey is public (BitcoinLedgerProvider)

## 1.0.4

### Patch Changes

-   4a324c902: - add cryptoassets as dependency
    -   add sign typed data interface
    -   add optimism chain provider

## 1.0.3

### Patch Changes

-   719c01706: - Ensure that all hashes and addresses have 0x as prefix for the EVM packages
    -   Order of checks insideverifyInitiateSwapTransaction
    -   Fix for `withCachedUtxos`
    -   Proper creation of BitcoinEsploraApiProvider

## 1.0.2

### Patch Changes

-   8383db002: - fee provider can be null
    -   export typechain from the evm package
    -   remove approval step from initiate swap for evm chains
    -   add gasLimit as optional parameter in the TransactionRequest type
    -   fee provider is now optional for BitcoinEsploraProvider
    -   new evm chain support - Optimism
    -   add wallet and chain update hooks
    -   fix evm fees handlin

## 1.0.1

### Patch Changes

-   change namespace from @liquality to @yaswap
