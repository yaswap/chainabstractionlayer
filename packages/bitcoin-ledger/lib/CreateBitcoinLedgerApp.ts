import { CreateLedgerApp } from '@yaswap/hw-ledger';
import { Network } from '@yaswap/types';
import HwAppBitcoin from '@ledgerhq/hw-app-btc';
import Transport from '@ledgerhq/hw-transport';

export const CreateBitcoinLedgerApp: CreateLedgerApp = (transport: Transport, scrambleKey: string, network: Network) => {
    {
        const currency = network.isTestnet ? 'bitcoin_testnet' : 'bitcoin';
        return new HwAppBitcoin({
            transport,
            scrambleKey,
            currency,
        });
    }
};
