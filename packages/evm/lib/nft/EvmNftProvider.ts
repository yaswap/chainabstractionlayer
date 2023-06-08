import { Nft } from '@yaswap/client';
import { UnsupportedMethodError } from '@yaswap/errors';
import { AddressType, BigNumber, FeeType, NFTAsset, Transaction } from '@yaswap/types';
import { Signer } from '@ethersproject/abstract-signer';
import { AddressZero } from '@ethersproject/constants';
import { BaseProvider } from '@ethersproject/providers';
import { ERC1155, ERC1155__factory, ERC721, ERC721__factory } from '../typechain';
import { EthersPopulatedTransaction, EthersTransactionResponse, NftTypes } from '../types';
import { toEthereumTxRequest } from '../utils';
import { EvmBaseWalletProvider } from '../wallet/EvmBaseWalletProvider';

type NftContract = ERC721 | ERC1155;
type NftInfo = { contract: NftContract; schema: NftTypes };

export abstract class EvmNftProvider extends Nft<BaseProvider, Signer> {
    private _erc721: ERC721;
    private _erc1155: ERC1155;

    protected schemas: Record<string, NftContract>;
    protected cache: Record<string, NftInfo>;
    protected walletProvider: EvmBaseWalletProvider<BaseProvider>;

    constructor(walletProvider: EvmBaseWalletProvider<BaseProvider>) {
        super(walletProvider);

        this._erc721 = ERC721__factory.connect(AddressZero, this.walletProvider.getSigner());
        this._erc1155 = ERC1155__factory.connect(AddressZero, this.walletProvider.getSigner());
        this.cache = {};
        this.schemas = { ERC721: this._erc721, ERC1155: this._erc1155 };
    }

    public async transfer(
        contractAddress: AddressType,
        receiver: AddressType,
        tokenIDs: string[],
        amounts?: number[],
        data = '0x',
        fee?: FeeType
    ): Promise<Transaction<EthersTransactionResponse>> {
        const tx = await this.populateTrasnfer(contractAddress, receiver, tokenIDs, amounts, data);
        return await this.walletProvider.sendTransaction(toEthereumTxRequest(tx, fee));
    }

    public async balanceOf(contractAddress: AddressType, owners: AddressType[], tokenIDs: number[]): Promise<BigNumber | BigNumber[]> {
        const { schema, contract } = await this._cacheGet(contractAddress);
        const _owners = owners.map((owner) => owner.toString());

        switch (schema) {
            case NftTypes.ERC721: {
                const _contract: ERC721 = contract as ERC721;
                const balance = await _contract.balanceOf(_owners[0]);
                return new BigNumber(balance.toString());
            }

            case NftTypes.ERC1155: {
                const _contract: ERC1155 = contract as ERC1155;
                if (tokenIDs.length > 1) {
                    const balances = await _contract.balanceOfBatch(_owners, tokenIDs);
                    return balances.map((b) => new BigNumber(b.toString()));
                } else {
                    return new BigNumber((await _contract.balanceOf(_owners[0], tokenIDs[0])).toString());
                }
            }

            default: {
                throw new UnsupportedMethodError(`Unsupported NFT type: ${schema}`);
            }
        }
    }

    public async approve(
        contractAddress: AddressType,
        operator: AddressType,
        tokenID: number,
        fee?: FeeType
    ): Promise<Transaction<EthersTransactionResponse>> {
        const tx = await this.populateApprove(contractAddress, operator, tokenID);
        return this.walletProvider.sendTransaction(toEthereumTxRequest(tx, fee));
    }

    public async approveAll(
        contractAddress: AddressType,
        operator: AddressType,
        state: boolean,
        fee?: FeeType
    ): Promise<Transaction<EthersTransactionResponse>> {
        const tx = await this.populateApproveAll(contractAddress, operator, state);
        return this.walletProvider.sendTransaction(toEthereumTxRequest(tx, fee));
    }

    async isApprovedForAll(contractAddress: AddressType, operator: AddressType): Promise<boolean> {
        const { contract } = await this._cacheGet(contractAddress);
        const owner = await this.walletProvider.getAddress();
        return await contract.isApprovedForAll(owner.toString(), operator.toString());
    }

    public async estimateTransfer(
        contractAddress: AddressType,
        receiver: AddressType,
        tokenIDs: string[],
        amounts?: number[],
        data = '0x'
    ): Promise<BigNumber> {
        const tx = await this.populateTrasnfer(contractAddress, receiver, tokenIDs, amounts, data);
        const estimation = await this.walletProvider.estimateGas(tx);
        return new BigNumber(estimation.toString());
    }

    public async estimateApprove(contractAddress: AddressType, operator: AddressType, tokenID: number): Promise<BigNumber> {
        const tx = await this.populateApprove(contractAddress, operator, tokenID);
        const estimation = await this.walletProvider.estimateGas(tx);
        return new BigNumber(estimation.toString());
    }

    public async estimateApproveAll(contractAddress: AddressType, operator: AddressType, state: boolean): Promise<BigNumber> {
        const tx = await this.populateApproveAll(contractAddress, operator, state);
        const estimation = await this.walletProvider.estimateGas(tx);
        return new BigNumber(estimation.toString());
    }

    async fetch(): Promise<NFTAsset[]> {
        throw new Error('Method not implemented');
    }

    private async _cacheGet(contractAddress: AddressType): Promise<NftInfo> {
        const _contractAddress = contractAddress.toString();

        if (this.cache[_contractAddress]) {
            return this.cache[_contractAddress];
        }
        const ERC721_INTERFACE = {
            id: '0x80ac58cd',
            type: NftTypes.ERC721,
        };
        const ERC1155_INTERFACE = {
            id: '0xd9b67a26',
            type: NftTypes.ERC1155,
        };

        for (const _interface of [ERC721_INTERFACE, ERC1155_INTERFACE]) {
            // we can use erc721 because both erc721 and erc1155 support that interface
            const isSupported = await this._erc721.attach(_contractAddress).supportsInterface(_interface.id);

            if (isSupported) {
                this.cache[_contractAddress] = {
                    contract: this.schemas[_interface.type].attach(_contractAddress),
                    schema: _interface.type,
                };

                return this.cache[_contractAddress];
            }
        }

        throw new UnsupportedMethodError(`Cannot find the data for ${_contractAddress}`);
    }

    private async populateApprove(
        contractAddress: AddressType,
        operator: AddressType,
        tokenID: number
    ): Promise<EthersPopulatedTransaction> {
        const { schema, contract } = await this._cacheGet(contractAddress);
        const _operator = operator.toString();

        let tx: EthersPopulatedTransaction;

        switch (schema) {
            case NftTypes.ERC721: {
                const _contract: ERC721 = contract as ERC721;
                tx = await _contract.populateTransaction.approve(_operator, tokenID);
                break;
            }

            case NftTypes.ERC1155: {
                const _contract: ERC1155 = contract as ERC1155;
                tx = await _contract.populateTransaction.setApprovalForAll(_operator, true);
                break;
            }

            default: {
                throw new UnsupportedMethodError(`Unsupported NFT type: ${schema}`);
            }
        }

        return tx;
    }

    private async populateTrasnfer(
        contractAddress: AddressType,
        receiver: AddressType,
        tokenIDs: string[],
        amounts?: number[],
        data = '0x'
    ): Promise<EthersPopulatedTransaction> {
        const { schema, contract } = await this._cacheGet(contractAddress);
        const owner = (await this.walletProvider.getAddress()).toString();
        const to = receiver.toString();

        let tx: EthersPopulatedTransaction;

        switch (schema) {
            case NftTypes.ERC721: {
                if (tokenIDs.length !== 1) {
                    throw new Error(`nft.transfer supports exactly 1 tokenID transfer for ERC721. received ${tokenIDs.join(', ')}`);
                }
                const _contract: ERC721 = contract as ERC721;
                tx = await _contract.populateTransaction['safeTransferFrom(address,address,uint256,bytes)'](owner, to, tokenIDs[0], data);
                break;
            }

            case NftTypes.ERC1155: {
                const _contract: ERC1155 = contract as ERC1155;
                if (tokenIDs.length > 1) {
                    tx = await _contract.populateTransaction.safeBatchTransferFrom(owner, to, tokenIDs, amounts, data);
                } else {
                    tx = await _contract.populateTransaction.safeTransferFrom(owner, to, tokenIDs[0], amounts[0], data);
                }
                break;
            }

            default: {
                throw new UnsupportedMethodError(`Unsupported NFT type: ${schema}`);
            }
        }

        return tx;
    }

    private async populateApproveAll(
        contractAddress: AddressType,
        operator: AddressType,
        state: boolean
    ): Promise<EthersPopulatedTransaction> {
        const { contract } = await this._cacheGet(contractAddress);
        const tx = await contract.populateTransaction.setApprovalForAll(operator.toString(), state);

        return tx;
    }
}
