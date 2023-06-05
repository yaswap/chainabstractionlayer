// import { Fee, HttpClient } from '@yac-swap/client';
import { Fee } from '@yac-swap/client';
import { FeeDetails, FeeProvider } from '@yac-swap/types';

export class YacoinFeeApiProvider extends Fee implements FeeProvider {
    // private _httpClient: HttpClient;

    constructor(endpoint = 'https://mempool.space/api/v1/fees/recommended') {
        super();
        // this._httpClient = new HttpClient({ baseURL: endpoint });
    }

    async getFees(): Promise<FeeDetails> {
        // const data = await this._httpClient.nodeGet('/');
        return {
            slow: {
                // fee: data.hourFee,
                fee: 11,
                wait: 60 * 60,
            },
            average: {
                // fee: data.halfHourFee,
                fee: 11,
                wait: 30 * 60,
            },
            fast: {
                // fee: data.fastestFee,
                fee: 11,
                wait: 10 * 60,
            },
        };
    }
}
