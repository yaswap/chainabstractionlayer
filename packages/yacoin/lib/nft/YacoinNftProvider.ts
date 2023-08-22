import { Nft, Wallet } from '@yaswap/client';
import { UnsupportedMethodError } from '@yaswap/errors';
import { Address, AddressType, AssetTypes, BigNumber, ChainId, NFTAsset, Transaction } from '@yaswap/types';
import { YacoinBaseChainProvider } from '../chain/YacoinBaseChainProvider';
import { YacoinBaseWalletProvider } from '../wallet/YacoinBaseWallet';
import { YacoinEsploraTypes } from '../types';
import { getTokenMetadata } from '../utils';

export class YacoinNftProvider extends Nft<YacoinBaseChainProvider, YacoinBaseWalletProvider> {
    constructor(walletProvider: Wallet<YacoinBaseChainProvider, YacoinBaseWalletProvider>) {
        super(walletProvider);
    }

    async fetch(): Promise<NFTAsset[]> {
        const _addresses: Address[] = await this.walletProvider.getUsedAddresses();
        const addresses = _addresses.map((a) => a.toString());
        const data: YacoinEsploraTypes.BatchTokenUTXOInfo = await this.walletProvider.getChainProvider().getProvider().getAllNFTUnspentTransactions(addresses)
        console.log('TACA ===> YacoinNftProvider.ts, addresses = ', addresses, ', data = ', data)
        const nftAssets: NFTAsset[] = [];
        for (const tokenInfo of data) {
            console.log('TACA ===> YacoinNftProvider.ts, tokenInfo = ', tokenInfo)
            if (tokenInfo.token_info) {
                const { token_type, amount, units, reissuable, block_hash, ipfs_hash } = tokenInfo.token_info;

                // Sanity check NFT
                if (token_type !== 'Unique-token' || amount !== 1 || units !== 0 || reissuable !== false) {
                    console.warn(`Invalid nft ${tokenInfo.token_name}`);
                } else {
                    // Parse NFT name
                    // Workaround for displaying YA-NFT created by sub YA-Token
                    const fullNFTName = tokenInfo.token_name.split('/').join('|')
                    const nftCollectionName = fullNFTName.split('#')[0];
                    const nftName = fullNFTName.split('#')[1];

                    // Get NFT metdata
                    const nftMetadata = await getTokenMetadata(ipfs_hash)
                    console.log('TACA ===> YacoinNftProvider.ts, nftMetadata = ', nftMetadata)
                    nftAssets.push({
                        token_id: fullNFTName,
                        asset_contract: {
                            address: block_hash,
                            image_url: nftMetadata.imageURL,
                            name: nftName,
                            symbol: nftName,
                            ipfs_hash,
                        },
                        collection: {
                            name: nftCollectionName,
                        },
                        description: nftMetadata.description,
                        image_original_url: nftMetadata.imageURL,
                        image_preview_url: nftMetadata.imageURL,
                        image_thumbnail_url: nftMetadata.imageURL,
                        name: nftName,
                        metadataName: nftMetadata.name,
                    });
                }
            }
        }

        console.log('TACA ===> YacoinNftProvider.ts, nftAssets = ', nftAssets)
        return nftAssets;
    }

    public async transfer(
        contract: AddressType,
        receiver: AddressType,
        tokenIDs: string[],
        values?: number[],
        data?: string,
        fee?: number
    ): Promise<Transaction<any>> {
        return await this.walletProvider.sendTransaction({
            to: receiver,
            value: new BigNumber(1e6), // transfer 1 nft
            asset: {
                contractAddress: contract.toString(),
                chain: ChainId.Yacoin,
                decimals: 0,
                code: tokenIDs[0],
                name: tokenIDs[0],
                type: AssetTypes.nft,
            },
            fee
        });
    }

    balanceOf(_contractAddress: AddressType, _owners: AddressType[], _tokenIDs: number[]): Promise<BigNumber | BigNumber[]> {
        throw new UnsupportedMethodError('Method not supported');
    }
    approve(_contract: AddressType, _operator: AddressType, _tokenID: number): Promise<Transaction<any>> {
        throw new UnsupportedMethodError('Method not supported');
    }
    approveAll(_contract: AddressType, _operator: AddressType, _state: boolean): Promise<Transaction<any>> {
        throw new UnsupportedMethodError('Method not supported');
    }
    isApprovedForAll(_contract: AddressType, _operator: AddressType): Promise<boolean> {
        throw new UnsupportedMethodError('Method not supported');
    }
}
