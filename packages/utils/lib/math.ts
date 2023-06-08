import { BigNumber, BigNumberish } from '@yaswap/types';

export function add(a: BigNumberish, b: BigNumberish) {
    return new BigNumber(a.toString()).plus(b.toString());
}

export function sub(a: BigNumberish, b: BigNumberish) {
    return new BigNumber(a.toString()).minus(b.toString());
}

export function mul(a: BigNumberish, b: BigNumberish) {
    return new BigNumber(a.toString()).multipliedBy(b.toString());
}

export function div(a: BigNumberish, b: BigNumberish) {
    return new BigNumber(a.toString()).dividedBy(b.toString());
}

export function eq(a: BigNumberish, b: BigNumberish) {
    return new BigNumber(a.toString()).eq(b.toString());
}

export function lte(a: BigNumberish, b: BigNumberish) {
    return new BigNumber(a.toString()).lte(b.toString());
}

export function lt(a: BigNumberish, b: BigNumberish) {
    return new BigNumber(a.toString()).lt(b.toString());
}

export function gte(a: BigNumberish, b: BigNumberish) {
    return new BigNumber(a.toString()).gte(b.toString());
}
