import { EARTH_RADIUS_METERS, PI, TWO_PI } from './constants';
import { add3, clamp, cross3, dot3, norm3, normalize3, scale3 } from './vector3';
import type { Vec3 } from './vector3';

/**
 * Internal longitude/latitude pair expressed in radians.
 *
 * Contract:
 * - order is always `[longitude, latitude]`;
 * - both values are already normalized to radians;
 * - no caller may swap the components to match a rendering convention.
 */
export type LonLatRadians = readonly [longitude: number, latitude: number];

/** Converts `[longitude, latitude]` radians to a unit n-vector in ECEF orientation. */
export function lonLatToNVector([longitude, latitude]: LonLatRadians): Vec3 {
	const cosLatitude = Math.cos(latitude);
	return [cosLatitude * Math.cos(longitude), cosLatitude * Math.sin(longitude), Math.sin(latitude)];
}

/** Converts a unit n-vector to `[longitude, latitude]` radians. */
export function nVectorToLonLat(vector: Vec3): LonLatRadians {
	const normalized = normalize3(vector);
	const latitude = Math.atan2(normalized[2], Math.sqrt(normalized[0] * normalized[0] + normalized[1] * normalized[1]));
	let longitude = Math.atan2(normalized[1], normalized[0]);
	longitude = ((((longitude - PI) % TWO_PI) + TWO_PI) % TWO_PI) - PI;
	return [longitude, latitude];
}

/** Computes the angular distance between two n-vectors, in radians. */
export function angularDistanceRadians(a: Vec3, b: Vec3): number {
	return Math.acos(clamp(dot3(normalize3(a), normalize3(b)), -1, 1));
}

/**
 * Interpolates two n-vectors then projects the result onto the unit sphere.
 *
 * This normalized linear interpolation is used for midpoint and quarter-point
 * construction. Antipodal interpolation at the exact midpoint is undefined
 * and rejected explicitly.
 */
export function intermediateNVector(a: Vec3, b: Vec3, fraction: number): Vec3 {
	if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
		throw new RangeError('fraction must be finite and belong to [0, 1]');
	}
	const interpolated = add3(scale3(a, 1 - fraction), scale3(b, fraction));
	if (norm3(interpolated) <= 1e-7) {
		throw new RangeError('cannot interpolate antipodal n-vectors at this fraction');
	}
	return normalize3(interpolated);
}

/**
 * Builds a corrected NED-to-ECEF matrix in column-major order.
 *
 * Input contract:
 * - longitude then latitude;
 * - both angles in radians;
 * - radius in meters.
 */
export function buildNed2EcefMatrix(
	[longitude, latitude]: LonLatRadians,
	earthRadiusMeters = EARTH_RADIUS_METERS
): Float32Array {
	const cosLongitude = Math.cos(longitude);
	const sinLongitude = Math.sin(longitude);
	const cosLatitude = Math.cos(latitude);
	const sinLatitude = Math.sin(latitude);
	const matrix = new Float32Array(16);

	matrix.set([-cosLongitude * sinLatitude, -sinLongitude * sinLatitude, cosLatitude, 0], 0);
	matrix.set([-sinLongitude, cosLongitude, 0, 0], 4);
	matrix.set([-cosLatitude * cosLongitude, -cosLatitude * sinLongitude, -sinLatitude, 0], 8);
	matrix.set(
		[earthRadiusMeters * cosLatitude * cosLongitude, earthRadiusMeters * cosLatitude * sinLongitude, earthRadiusMeters * sinLatitude, 1],
		12
	);

	return matrix;
}

/** Extracts one column vector from a column-major matrix buffer. */
export function readMatrixColumn3(matrices: Float32Array, matrixIndex: number, columnIndex: number): Vec3 {
	const offset = matrixIndex * 16 + columnIndex * 4;
	return [matrices[offset], matrices[offset + 1], matrices[offset + 2]];
}

/** Returns the local n-vector from a NED-to-ECEF matrix translation column. */
export function readNVectorFromNed2Ecef(matrices: Float32Array, matrixIndex: number): Vec3 {
	return normalize3(readMatrixColumn3(matrices, matrixIndex, 3));
}

/** Builds the great-circle plane normal for a local bearing. */
export function greatCircleFromBearing(townNVector: Vec3, north: Vec3, east: Vec3, azimuthRadians: number): Vec3 {
	const direction = add3(scale3(north, Math.cos(azimuthRadians)), scale3(east, Math.sin(azimuthRadians)));
	return normalize3(cross3(townNVector, direction));
}

/** Computes the initial bearing of a target n-vector in a provided local referential. */
export function initialBearingRadians(north: Vec3, east: Vec3, targetNVector: Vec3): number {
	const sine = dot3(targetNVector, east);
	const cosine = dot3(targetNVector, north);
	return (Math.atan2(sine, cosine) + TWO_PI) % TWO_PI;
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
