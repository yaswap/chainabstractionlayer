import { CreateLedgerApp } from '@yac-swap/hw-ledger';
import { Network } from '@yac-swap/types';
import HwAppEthereum from '@ledgerhq/hw-app-eth';
import Transport from '@ledgerhq/hw-transport';

export const CreateEvmLedgerApp: CreateLedgerApp = (transport: Transport, scrambleKey: string, _network: Network) => {
    {
        return new HwAppEthereum(transport, scrambleKey);
    }
};
