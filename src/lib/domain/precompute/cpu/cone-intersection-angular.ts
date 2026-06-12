import { PI, TWO_PI } from '../../../shared';

/** Returns a positive modulo even when `value` is negative. */
export function positiveModulo(value: number, modulus: number): number {
	const remainder = value % modulus;
	return remainder < 0 ? remainder + modulus : remainder;
}

/** Normalizes one angle into `[0, 2 PI)`. */
export function positiveAngle(angleRadians: number): number {
	return positiveModulo(angleRadians, TWO_PI);
}

/** Returns one signed wrapped angular delta in `[-PI, PI[`. */
export function signedAngleDelta(angleRadians: number): number {
	return positiveModulo(angleRadians + PI, TWO_PI) - PI;
}
