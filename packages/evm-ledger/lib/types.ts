import { CreateOptions } from '@yaswap/hw-ledger';
import { Address } from '@yaswap/types';
import HwAppEthereum from '@ledgerhq/hw-app-eth';

export type GetAppType = () => Promise<HwAppEthereum>;

export interface EvmLedgerCreateOptions extends CreateOptions {
    derivationPath?: string;
    addressCache?: Address;
}

export interface LedgerAddressType {
    publicKey: string;
    address: string;
    chainCode?: string;
}
