import { BitcoinTypes } from '@yaswap/bitcoin';
import { CreateOptions } from '@yaswap/hw-ledger';

export interface BitcoinLedgerProviderOptions extends CreateOptions {
    baseDerivationPath: string;
    basePublicKey?: string;
    baseChainCode?: string;
    addressType: BitcoinTypes.AddressType;
    network: BitcoinTypes.BitcoinNetwork;
}
