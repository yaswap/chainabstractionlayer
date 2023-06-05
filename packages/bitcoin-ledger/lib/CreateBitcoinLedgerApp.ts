import { CreateLedgerApp } from '@yac-swap/hw-ledger';
import { Network } from '@yac-swap/types';
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
