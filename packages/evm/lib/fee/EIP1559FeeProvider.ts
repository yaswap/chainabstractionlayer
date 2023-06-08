import { Fee } from '@yaswap/client';
import { BigNumber, FeeDetails } from '@yaswap/types';
import { Network, StaticJsonRpcProvider } from '@ethersproject/providers';
import { suggestFees } from '@liquality/fee-suggestions';
import { toGwei } from '../utils';

export class EIP1559FeeProvider extends Fee {
    provider: StaticJsonRpcProvider;

    constructor(provider: StaticJsonRpcProvider | string, network?: Network) {
        super();

        if (typeof provider === 'string') {
            this.provider = new StaticJsonRpcProvider(provider, network?.chainId);
        } else {
            this.provider = provider;
        }
    }

    getBaseFeeMultiplier(baseFeeTrend: number) {
        switch (baseFeeTrend) {
            case 2:
                return 1.6;
            case 1:
                return 1.4;
            case 0:
                return 1.2;
            default:
                return 1.1;
        }
    }

    calculateMaxFeePerGas(maxPriorityFeePerGas: BigNumber, potentialMaxFee: BigNumber) {
        return maxPriorityFeePerGas.gt(potentialMaxFee) ? potentialMaxFee.plus(maxPriorityFeePerGas) : potentialMaxFee;
    }

    async getFees(): Promise<FeeDetails> {
        const { maxPriorityFeeSuggestions, baseFeeSuggestion, currentBaseFee, baseFeeTrend, confirmationTimeByPriorityFee } =
            await suggestFees(this.provider);

        const bigCurrentBaseFee = toGwei(currentBaseFee);
        const bigBaseFeeSuggestion = toGwei(baseFeeSuggestion);
        const slowMaxPriorityFeePerGas = toGwei(confirmationTimeByPriorityFee[45]);
        const averageMaxPriorityFeePerGas = toGwei(confirmationTimeByPriorityFee[30]);
        const fastMaxPriorityFeePerGas = toGwei(baseFeeTrend === 2 ? maxPriorityFeeSuggestions.urgent : confirmationTimeByPriorityFee[15]);

        const multiplier = this.getBaseFeeMultiplier(baseFeeTrend);
        const potentialMaxFee = bigBaseFeeSuggestion.times(multiplier);

        const extra = {
            currentBaseFeePerGas: bigCurrentBaseFee.toNumber(),
            suggestedBaseFeePerGas: bigBaseFeeSuggestion.toNumber(),
            baseFeeTrend,
        };

        const fees = {
            slow: {
                fee: {
                    ...extra,
                    maxFeePerGas: this.calculateMaxFeePerGas(slowMaxPriorityFeePerGas, potentialMaxFee).toNumber(),
                    maxPriorityFeePerGas: slowMaxPriorityFeePerGas.toNumber(),
                },
            },
            average: {
                fee: {
                    ...extra,
                    maxFeePerGas: this.calculateMaxFeePerGas(averageMaxPriorityFeePerGas, potentialMaxFee).toNumber(),
                    maxPriorityFeePerGas: averageMaxPriorityFeePerGas.toNumber(),
                },
            },
            fast: {
                fee: {
                    ...extra,
                    maxFeePerGas: this.calculateMaxFeePerGas(fastMaxPriorityFeePerGas, potentialMaxFee).toNumber(),
                    maxPriorityFeePerGas: fastMaxPriorityFeePerGas.toNumber(),
                },
            },
        };

        return fees;
    }
}
