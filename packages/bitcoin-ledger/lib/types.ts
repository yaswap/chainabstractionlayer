import { BitcoinTypes } from '@yac-swap/bitcoin';
import { CreateOptions } from '@yac-swap/hw-ledger';

export interface BitcoinLedgerProviderOptions extends CreateOptions {
    baseDerivationPath: string;
    basePublicKey?: string;
    baseChainCode?: string;
    addressType: BitcoinTypes.AddressType;
    network: BitcoinTypes.BitcoinNetwork;
}
