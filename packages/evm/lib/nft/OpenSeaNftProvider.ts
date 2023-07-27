import { HttpClient } from '@yaswap/client';
import { NFTAsset } from '@yaswap/types';
import { BaseProvider } from '@ethersproject/providers';
import { NftProviderConfig, NftTypes } from '../types';
import { EvmBaseWalletProvider } from '../wallet/EvmBaseWalletProvider';
import { EvmNftProvider } from './EvmNftProvider';

export class OpenSeaNftProvider extends EvmNftProvider {
    private readonly _httpClient: HttpClient;

    constructor(walletProvider: EvmBaseWalletProvider<BaseProvider>, config: NftProviderConfig) {
        super(walletProvider);
        this._httpClient = new HttpClient({
            baseURL: config.url,
            responseType: 'text',
            transformResponse: undefined,
            ...(config.apiKey && {
                headers: {
                    'X-Api-Key': config.apiKey,
                },
            }),
        });
    }

    async fetch(): Promise<NFTAsset[]> {
        const userAddress = await this.walletProvider.getAddress();
        const nfts = await this._httpClient.nodeGet(`assets?owner=${userAddress}`);

        return nfts.assets.reduce((result, nft) => {
            if (nft.asset_contract && nft.asset_contract.address != '0x5734c666a977a44e51de24118f5272263a6bf9b0' && nft.asset_contract.name != '$ETH NFT EVENT') {
                const { schema_name, address } = nft.asset_contract;

                if (schema_name in NftTypes && address) {
                    this.cache[address] = {
                        contract: this.schemas[schema_name].attach(address),
                        schema: schema_name as NftTypes,
                    };

                    const {
                        image_preview_url,
                        image_thumbnail_url,
                        image_original_url,
                        asset_contract,
                        collection,
                        token_id,
                        id,
                        external_link,
                        description,
                    } = nft;

                    const { image_url, name, symbol } = asset_contract;

                    result.push({
                        asset_contract: {
                            address,
                            external_link,
                            image_url,
                            name,
                            symbol,
                        },
                        collection: {
                            name: collection.name,
                        },
                        description,
                        external_link,
                        id,
                        image_original_url,
                        image_preview_url,
                        image_thumbnail_url,
                        name,
                        token_id,
                    });
                }
            }

            return result;
        }, []);
    }
}
