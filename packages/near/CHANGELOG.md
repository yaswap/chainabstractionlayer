# @chainify/near

## 1.0.8

### Patch Changes

-   -   target is now es6
-   Updated dependencies
    -   @chainify/client@1.0.8
    -   @chainify/errors@1.0.8
    -   @chainify/types@1.0.8
    -   @chainify/utils@1.0.8

## 1.0.7

### Patch Changes

-   -   ignore case when comparing addresses
    -   scrambleKey is now optional
-   Updated dependencies
    -   @chainify/client@1.0.7
    -   @chainify/errors@1.0.7
    -   @chainify/types@1.0.7
    -   @chainify/utils@1.0.7

## 1.0.6

### Patch Changes

-   -   solana balances fetching
    -   ledger fixes and improvements
-   Updated dependencies
    -   @chainify/client@1.0.6
    -   @chainify/errors@1.0.6
    -   @chainify/types@1.0.6
    -   @chainify/utils@1.0.6

## 1.0.5

### Patch Changes

-   390c4f829: - nft logic is now part of client
    -   getWalletPublicKey is public (BitcoinLedgerProvider)
-   Updated dependencies [390c4f829]
    -   @chainify/client@1.0.5
    -   @chainify/errors@1.0.5
    -   @chainify/types@1.0.5
    -   @chainify/utils@1.0.5

## 1.0.4

### Patch Changes

-   4a324c902: - add cryptoassets as dependency
    -   add sign typed data interface
    -   add optimism chain provider
-   Updated dependencies [4a324c902]
    -   @chainify/client@1.0.4
    -   @chainify/errors@1.0.4
    -   @chainify/types@1.0.4
    -   @chainify/utils@1.0.4

## 1.0.3

### Patch Changes

-   719c01706: - Ensure that all hashes and addresses have 0x as prefix for the EVM packages
    -   Order of checks insideverifyInitiateSwapTransaction
    -   Fix for `withCachedUtxos`
    -   Proper creation of BitcoinEsploraApiProvider
-   Updated dependencies [719c01706]
    -   @chainify/client@1.0.3
    -   @chainify/errors@1.0.3
    -   @chainify/types@1.0.3
    -   @chainify/utils@1.0.3

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
-   Updated dependencies [8383db002]
    -   @chainify/client@1.0.2
    -   @chainify/errors@1.0.2
    -   @chainify/types@1.0.2
    -   @chainify/utils@1.0.2

## 1.0.1

### Patch Changes

-   change namespace from @liquality to @chainify
-   Updated dependencies
    -   @chainify/client@1.0.1
    -   @chainify/errors@1.0.1
    -   @chainify/types@1.0.1
    -   @chainify/utils@1.0.1