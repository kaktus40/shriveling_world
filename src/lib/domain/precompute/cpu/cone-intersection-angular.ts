import { PI, TWO_PI } from '../../../shared';

/** Normalizes one angle into `[0, 2 PI)`. */
export function wrapPositive(angleRadians: number): number {
	const remainder = angleRadians % TWO_PI;
	return remainder < 0 ? remainder + TWO_PI : remainder;
}

/** Returns one signed wrapped angular delta in `[-PI, PI[`. */
export function wrapSigned(angleRadians: number): number {
	const positive = wrapPositive(angleRadians);
	return positive > PI ? positive - TWO_PI : positive;
}

/** Returns a positive modulo even when `value` is negative. */
export function positiveModulo(value: number, modulus: number): number {
	const remainder = value % modulus;
	return remainder < 0 ? remainder + modulus : remainder;
}
