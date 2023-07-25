export interface NFTAsset {
    token_id?: string;
    asset_contract?: {
        address?: string;
        name?: string;
        symbol?: string;
        image_url?: string;
        external_link?: string;
        ipfs_hash?: string;
    };
    collection?: {
        name: string;
    };
    id?: number;
    description?: string;
    external_link?: string;
    image_original_url?: string;
    image_preview_url?: string;
    image_thumbnail_url?: string;
    name?: string;
    metadataName?: string;
    amount?: string;
    standard?: string;
}
