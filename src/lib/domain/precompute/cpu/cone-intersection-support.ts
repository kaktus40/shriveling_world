import {
	CITY_NED2ECEF_MATRIX_STRIDE,
	CITY_PAIR_INVARIANT_STRIDE,
	UNUSED_INDEX,
	type ConeIntersectionStaticInput,
	type RawConePrecompute,
	type SymmetricConeIntersectionStaticInput,
} from '../types';
import { RAW_CONE_RIM_ECEF_STRIDE } from './raw-cone-cpu';
import {
	RAY_ORIGIN_EPSILON_METERS,
	RAY_TRIANGLE_DETERMINANT_EPSILON,
} from './cone-intersection-constants';

/** Three-dimensional vector accepted by the CPU intersection primitive. */
export type Vector3 = readonly [number, number, number];

/**
 * Returns the first double-sided Moller-Trumbore ray/triangle intersection.
 *
 * The ray direction must be normalized. The returned value is therefore a
 * distance in meters when vertices and origin are ECEF meters. Intersections
 * at or behind the origin and beyond `maximumDistanceMeters` are rejected.
 */
export function intersectRayTriangleDoubleSided(
	rayOrigin: Vector3,
	rayDirection: Vector3,
	vertex0: Vector3,
	vertex1: Vector3,
	vertex2: Vector3,
	maximumDistanceMeters = Infinity,
	minimumDistanceMeters = RAY_ORIGIN_EPSILON_METERS,
): number | undefined {
	if (
		!isFiniteVector(rayOrigin) ||
		!isFiniteVector(rayDirection) ||
		!isFiniteVector(vertex0) ||
		!isFiniteVector(vertex1) ||
		!isFiniteVector(vertex2)
	) {
		throw new RangeError('ray and triangle coordinates must be finite');
	}
	if (!Number.isFinite(maximumDistanceMeters) && maximumDistanceMeters !== Infinity) {
		throw new RangeError('maximumDistanceMeters must be finite or positive infinity');
	}
	if (maximumDistanceMeters <= 0) {
		throw new RangeError('maximumDistanceMeters must be strictly positive');
	}
	if (!Number.isFinite(minimumDistanceMeters) || minimumDistanceMeters <= 0) {
		throw new RangeError('minimumDistanceMeters must be finite and strictly positive');
	}

	const edge1X = vertex1[0] - vertex0[0];
	const edge1Y = vertex1[1] - vertex0[1];
	const edge1Z = vertex1[2] - vertex0[2];
	const edge2X = vertex2[0] - vertex0[0];
	const edge2Y = vertex2[1] - vertex0[1];
	const edge2Z = vertex2[2] - vertex0[2];
	const pX = rayDirection[1] * edge2Z - rayDirection[2] * edge2Y;
	const pY = rayDirection[2] * edge2X - rayDirection[0] * edge2Z;
	const pZ = rayDirection[0] * edge2Y - rayDirection[1] * edge2X;
	const determinant = edge1X * pX + edge1Y * pY + edge1Z * pZ;
	if (Math.abs(determinant) <= RAY_TRIANGLE_DETERMINANT_EPSILON) {
		return undefined;
	}

	const inverseDeterminant = 1 / determinant;
	const translatedX = rayOrigin[0] - vertex0[0];
	const translatedY = rayOrigin[1] - vertex0[1];
	const translatedZ = rayOrigin[2] - vertex0[2];
	const u = (translatedX * pX + translatedY * pY + translatedZ * pZ) * inverseDeterminant;
	if (u < 0 || u > 1) {
		return undefined;
	}

	const qX = translatedY * edge1Z - translatedZ * edge1Y;
	const qY = translatedZ * edge1X - translatedX * edge1Z;
	const qZ = translatedX * edge1Y - translatedY * edge1X;
	const v = (rayDirection[0] * qX + rayDirection[1] * qY + rayDirection[2] * qZ) * inverseDeterminant;
	if (v < 0 || u + v > 1) {
		return undefined;
	}

	const distanceMeters = (edge2X * qX + edge2Y * qY + edge2Z * qZ) * inverseDeterminant;
	return distanceMeters > minimumDistanceMeters && distanceMeters <= maximumDistanceMeters ? distanceMeters : undefined;
}

export function validateInputs(staticInput: ConeIntersectionStaticInput, rawCones: RawConePrecompute): void {
	if (!Number.isSafeInteger(rawCones.cityCount) || rawCones.cityCount < 0) {
		throw new RangeError('cityCount must be a non-negative safe integer');
	}
	if (staticInput.cityCount !== rawCones.cityCount) {
		throw new RangeError('static and raw-cone city counts must match');
	}
	if (!Number.isSafeInteger(rawCones.azimuthSampleCount) || rawCones.azimuthSampleCount < 3) {
		throw new RangeError('azimuthSampleCount must be a safe integer greater than or equal to 3');
	}
	if (staticInput.cityNed2EcefMatrices.length !== rawCones.cityCount * CITY_NED2ECEF_MATRIX_STRIDE) {
		throw new RangeError('cityNed2EcefMatrices length does not match cityCount');
	}
	if (!Number.isSafeInteger(staticInput.neighborLimit) || staticInput.neighborLimit < 0) {
		throw new RangeError('neighborLimit must be a non-negative safe integer');
	}
	if (staticInput.overlapCandidates.length !== rawCones.cityCount * staticInput.neighborLimit) {
		throw new RangeError('overlapCandidates length does not match cityCount and neighborLimit');
	}
	if (staticInput.overlapCandidateCounts.length !== rawCones.cityCount) {
		throw new RangeError('overlapCandidateCounts length does not match cityCount');
	}
	if (rawCones.rawConeRimEcef.length !== rawCones.cityCount * rawCones.azimuthSampleCount * RAW_CONE_RIM_ECEF_STRIDE) {
		throw new RangeError('rawConeRimEcef length does not match cityCount and azimuthSampleCount');
	}
	if (rawCones.coneAlphaRadians.length !== rawCones.cityCount * rawCones.azimuthSampleCount) {
		throw new RangeError('coneAlphaRadians length does not match cityCount and azimuthSampleCount');
	}
	for (let cityIndex = 0; cityIndex < rawCones.cityCount; cityIndex += 1) {
		const count = staticInput.overlapCandidateCounts[cityIndex];
		if (count > staticInput.neighborLimit) {
			throw new RangeError('overlapCandidateCounts contains a count greater than neighborLimit');
		}
		for (let candidateIndex = 0; candidateIndex < count; candidateIndex += 1) {
			const neighborCityIndex = staticInput.overlapCandidates[cityIndex * staticInput.neighborLimit + candidateIndex];
			if (neighborCityIndex >= rawCones.cityCount || neighborCityIndex === cityIndex) {
				throw new RangeError('overlapCandidates contains an invalid neighbor city index');
			}
		}
	}
}

export function validatePairInputs(staticInput: SymmetricConeIntersectionStaticInput, cityCount: number): void {
	const pairCount = cityCount * cityCount;
	if (
		staticInput.cityPairInvariants.length !== pairCount * CITY_PAIR_INVARIANT_STRIDE ||
		staticInput.cityPairSectorIndexes.length !== pairCount
	) {
		throw new RangeError('city pair buffers do not match cityCount');
	}
}

export function validateBlockPruningValues(blockFaceCount: number): void {
	if (!Number.isSafeInteger(blockFaceCount) || blockFaceCount < 1) {
		throw new RangeError('blockFaceCount must be a strictly positive safe integer');
	}
}

export function readCitySummit(buffer: Float32Array, cityIndex: number, output: [number, number, number]): void {
	const offset = cityIndex * CITY_NED2ECEF_MATRIX_STRIDE + 12;
	output[0] = buffer[offset];
	output[1] = buffer[offset + 1];
	output[2] = buffer[offset + 2];
}

export function readRawRim(
	rawCones: RawConePrecompute,
	cityIndex: number,
	sampleIndex: number,
	output: [number, number, number],
): void {
	const offset = (cityIndex * rawCones.azimuthSampleCount + sampleIndex) * RAW_CONE_RIM_ECEF_STRIDE;
	output[0] = rawCones.rawConeRimEcef[offset];
	output[1] = rawCones.rawConeRimEcef[offset + 1];
	output[2] = rawCones.rawConeRimEcef[offset + 2];
}

export function computeBlockEntryDistanceMeters(
	rayOrigin: Vector3,
	rayDirection: Vector3,
	blockSummit: Vector3,
	rawCones: RawConePrecompute,
	cityIndex: number,
	faceIndexes: ArrayLike<number>,
	blockStartIndex: number,
	blockEndIndex: number,
	triangleRim0: [number, number, number],
	triangleRim1: [number, number, number],
): number | undefined {
	let minX = blockSummit[0];
	let minY = blockSummit[1];
	let minZ = blockSummit[2];
	let maxX = blockSummit[0];
	let maxY = blockSummit[1];
	let maxZ = blockSummit[2];

	for (let localVisitIndex = blockStartIndex; localVisitIndex < blockEndIndex; localVisitIndex += 1) {
		const faceIndex = faceIndexes[localVisitIndex];
		const nextFaceIndex = (faceIndex + 1) % rawCones.azimuthSampleCount;
		readRawRim(rawCones, cityIndex, faceIndex, triangleRim0);
		readRawRim(rawCones, cityIndex, nextFaceIndex, triangleRim1);
		minX = Math.min(minX, triangleRim0[0], triangleRim1[0]);
		minY = Math.min(minY, triangleRim0[1], triangleRim1[1]);
		minZ = Math.min(minZ, triangleRim0[2], triangleRim1[2]);
		maxX = Math.max(maxX, triangleRim0[0], triangleRim1[0]);
		maxY = Math.max(maxY, triangleRim0[1], triangleRim1[1]);
		maxZ = Math.max(maxZ, triangleRim0[2], triangleRim1[2]);
	}

	return intersectRayAxisAlignedBoundingBoxEntryDistanceMeters(rayOrigin, rayDirection, [minX, minY, minZ], [maxX, maxY, maxZ]);
}

export function intersectRayAxisAlignedBoundingBoxEntryDistanceMeters(
	rayOrigin: Vector3,
	rayDirection: Vector3,
	minCorner: Vector3,
	maxCorner: Vector3,
): number | undefined {
	let entryDistanceMeters = 0;
	let exitDistanceMeters = Number.POSITIVE_INFINITY;

	for (let axisIndex = 0; axisIndex < 3; axisIndex += 1) {
		const originComponent = rayOrigin[axisIndex];
		const directionComponent = rayDirection[axisIndex];
		const minimumComponent = minCorner[axisIndex];
		const maximumComponent = maxCorner[axisIndex];

		if (Math.abs(directionComponent) <= RAY_ORIGIN_EPSILON_METERS) {
			if (originComponent < minimumComponent || originComponent > maximumComponent) {
				return undefined;
			}
			continue;
		}

		const inverseDirection = 1 / directionComponent;
		let nearPlaneDistance = (minimumComponent - originComponent) * inverseDirection;
		let farPlaneDistance = (maximumComponent - originComponent) * inverseDirection;
		if (nearPlaneDistance > farPlaneDistance) {
			[nearPlaneDistance, farPlaneDistance] = [farPlaneDistance, nearPlaneDistance];
		}
		entryDistanceMeters = Math.max(entryDistanceMeters, nearPlaneDistance);
		exitDistanceMeters = Math.min(exitDistanceMeters, farPlaneDistance);
		if (entryDistanceMeters > exitDistanceMeters) {
			return undefined;
		}
	}

	return entryDistanceMeters >= RAY_ORIGIN_EPSILON_METERS ? entryDistanceMeters : 0;
}

function isFiniteVector(vector: Vector3): boolean {
	return Number.isFinite(vector[0]) && Number.isFinite(vector[1]) && Number.isFinite(vector[2]);
}

export function isPreferredIntersection(
	distanceMeters: number,
	neighborCityIndex: number,
	faceIndex: number,
	bestDistanceMeters: number,
	winningNeighborCityIndex: number,
	winningFaceIndex: number,
): boolean {
	return (
		distanceMeters < bestDistanceMeters ||
		(distanceMeters === bestDistanceMeters &&
			winningNeighborCityIndex !== UNUSED_INDEX &&
			(neighborCityIndex < winningNeighborCityIndex ||
				(neighborCityIndex === winningNeighborCityIndex && faceIndex < winningFaceIndex)))
	);
}
