import { PI, TWO_PI } from '../constants';

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

/** Shifts an angle by full turns so it is numerically close to a reference angle. */
export function shiftAngleNear(angleRadians: number, referenceRadians: number): number {
	let shifted = angleRadians;
	while (shifted - referenceRadians > PI) {
		shifted -= TWO_PI;
	}
	while (referenceRadians - shifted > PI) {
		shifted += TWO_PI;
	}
	return shifted;
}

/** Tests whether an angle belongs to a continuous interval, in radians. */
export function isAngleInsideContinuousInterval(angleRadians: number, minRadians: number, maxRadians: number): boolean {
	const centerRadians = (minRadians + maxRadians) / 2;
	const shifted = shiftAngleNear(angleRadians, centerRadians);
	return shifted >= minRadians && shifted <= maxRadians;
}
