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
        console.log('TACA ===> YacoinNftProvider, data = ', data)

        const nftAssets: NFTAsset[] = [];
        for (const tokenInfo of data) {
            if (tokenInfo.token_info) {
                const { token_type, amount, units, reissuable, block_hash, ipfs_hash } = tokenInfo.token_info;

                console.log('TACA ===> YacoinNftProvider, tokenInfo.token_info = ', tokenInfo.token_info)
                // Sanity check NFT
                if (token_type !== 'Unique-token' || amount !== 1 || units !== 0 || reissuable !== false) {
                    console.warn(`Invalid nft ${tokenInfo.token_name}`);
                    console.log('TACA ===> YacoinNftProvider, token_type = ', token_type, ', amount = ', amount, ', units = ', units, ', reissuable = ', reissuable)
                } else {
                    // Parse NFT name
                    const fullNFTName = tokenInfo.token_name
                    const nftCollectionName = fullNFTName.split('#')[0];
                    const nftName = fullNFTName.split('#')[1];

                    // Get NFT metdata
                    const nftMetadata = await getTokenMetadata(ipfs_hash)
                    nftAssets.push({
                        token_id: tokenInfo.token_name,
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
                    });
                }
            }
        }

        return nftAssets;
    }

    async transfer(contract: AddressType, receiver: AddressType): Promise<Transaction<any>> {
        return await this.walletProvider.sendTransaction({
            to: receiver,
            value: new BigNumber(1), // transfer 1 nft
            asset: {
                contractAddress: contract.toString(),
                chain: ChainId.Solana,
                decimals: 0,
                code: '',
                name: '',
                type: AssetTypes.nft,
            },
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
