import {
	CITY_NED2ECEF_MATRIX_STRIDE,
	CITY_PAIR_INVARIANT_STRIDE,
	UNUSED_INDEX,
	type ConeIntersectionOraclePrecompute,
	type ConeIntersectionStaticInput,
	type RawConePrecompute,
	type SymmetricConeIntersectionPrecompute,
	type SymmetricConeIntersectionStaticInput,
} from './types';
import { RAW_CONE_RIM_ECEF_STRIDE } from './raw-cone-cpu';
import { PI, TWO_PI } from '../../shared';

/** Default algebraic tolerance used to reject parallel or degenerate faces. */
export const RAY_TRIANGLE_DETERMINANT_EPSILON = 1e-7;

/** Default minimum accepted distance in front of a ray origin, in meters. */
export const RAY_ORIGIN_EPSILON_METERS = 1e-5;

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

/**
 * Exhaustively clips every raw cone ray against all faces of static neighbors.
 *
 * This deliberately unoptimized CPU implementation is the conformity oracle.
 * It tests every face of every retained neighbor and must remain independent
 * from future search ordering, angular filters, BVHs, and GPU implementations.
 */
export function computeConeIntersectionOracleCpu(
	staticInput: ConeIntersectionStaticInput,
	rawCones: RawConePrecompute,
): ConeIntersectionOraclePrecompute {
	validateInputs(staticInput, rawCones);
	const { cityCount, azimuthSampleCount, rawConeRimEcef } = rawCones;
	const rayCount = cityCount * azimuthSampleCount;
	const coneIntersectionDistanceMeters = new Float32Array(rayCount);
	const ciseledConeRimEcef = new Float32Array(rawConeRimEcef);
	const winningNeighborCityIndexes = new Uint32Array(rayCount);
	const winningFaceIndexes = new Uint32Array(rayCount);
	const testedFaceCounts = new Uint32Array(rayCount);
	winningNeighborCityIndexes.fill(UNUSED_INDEX);
	winningFaceIndexes.fill(UNUSED_INDEX);

	const rayOrigin: [number, number, number] = [0, 0, 0];
	const rayDirection: [number, number, number] = [0, 0, 0];
	const triangleSummit: [number, number, number] = [0, 0, 0];
	const triangleRim0: [number, number, number] = [0, 0, 0];
	const triangleRim1: [number, number, number] = [0, 0, 0];

	for (let cityIndex = 0; cityIndex < cityCount; cityIndex += 1) {
		readCitySummit(staticInput.cityNed2EcefMatrices, cityIndex, rayOrigin);
		const candidateOffset = cityIndex * staticInput.neighborLimit;
		const candidateCount = staticInput.overlapCandidateCounts[cityIndex];

		for (let sampleIndex = 0; sampleIndex < azimuthSampleCount; sampleIndex += 1) {
			const rayIndex = cityIndex * azimuthSampleCount + sampleIndex;
			const rimOffset = rayIndex * RAW_CONE_RIM_ECEF_STRIDE;
			rayDirection[0] = rawConeRimEcef[rimOffset] - rayOrigin[0];
			rayDirection[1] = rawConeRimEcef[rimOffset + 1] - rayOrigin[1];
			rayDirection[2] = rawConeRimEcef[rimOffset + 2] - rayOrigin[2];
			const rawDistanceMeters = Math.hypot(rayDirection[0], rayDirection[1], rayDirection[2]);
			if (!(rawDistanceMeters > RAY_ORIGIN_EPSILON_METERS)) {
				throw new RangeError('raw cone rays must have a strictly positive finite length');
			}
			rayDirection[0] /= rawDistanceMeters;
			rayDirection[1] /= rawDistanceMeters;
			rayDirection[2] /= rawDistanceMeters;
			let bestDistanceMeters = rawDistanceMeters;

			for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
				const neighborCityIndex = staticInput.overlapCandidates[candidateOffset + candidateIndex];
				readCitySummit(staticInput.cityNed2EcefMatrices, neighborCityIndex, triangleSummit);

				for (let faceIndex = 0; faceIndex < azimuthSampleCount; faceIndex += 1) {
					const nextFaceIndex = (faceIndex + 1) % azimuthSampleCount;
					readRawRim(rawCones, neighborCityIndex, faceIndex, triangleRim0);
					readRawRim(rawCones, neighborCityIndex, nextFaceIndex, triangleRim1);
					testedFaceCounts[rayIndex] += 1;
					const distanceMeters = intersectRayTriangleDoubleSided(
						rayOrigin,
						rayDirection,
						triangleSummit,
						triangleRim0,
						triangleRim1,
						bestDistanceMeters,
					);
					if (
						distanceMeters !== undefined &&
						isPreferredIntersection(
							distanceMeters,
							neighborCityIndex,
							faceIndex,
							bestDistanceMeters,
							winningNeighborCityIndexes[rayIndex],
							winningFaceIndexes[rayIndex],
						)
					) {
						bestDistanceMeters = distanceMeters;
						winningNeighborCityIndexes[rayIndex] = neighborCityIndex;
						winningFaceIndexes[rayIndex] = faceIndex;
					}
				}
			}

			coneIntersectionDistanceMeters[rayIndex] = bestDistanceMeters;
			if (winningNeighborCityIndexes[rayIndex] !== UNUSED_INDEX) {
				ciseledConeRimEcef[rimOffset] = rayOrigin[0] + rayDirection[0] * bestDistanceMeters;
				ciseledConeRimEcef[rimOffset + 1] = rayOrigin[1] + rayDirection[1] * bestDistanceMeters;
				ciseledConeRimEcef[rimOffset + 2] = rayOrigin[2] + rayDirection[2] * bestDistanceMeters;
				ciseledConeRimEcef[rimOffset + 3] = 1;
			}
		}
	}

	return {
		cityCount,
		azimuthSampleCount,
		coneIntersectionDistanceMeters,
		ciseledConeRimEcef,
		winningNeighborCityIndexes,
		winningFaceIndexes,
		testedFaceCounts,
	};
}

/**
 * Returns every face index once, ordered from the symmetric ray toward B->A.
 *
 * `phiB0` is the symmetric image in B's local referential of the considered
 * ray of A. The traversal follows the shortest signed direction from `phiB0`
 * to `gammaBA`, then continues around the circular cone. No face is removed.
 */
export function buildSymmetricFaceTraversal(
	phiB0Radians: number,
	gammaBARadians: number,
	azimuthSampleCount: number,
): Uint32Array {
	if (
		!Number.isFinite(phiB0Radians) ||
		!Number.isFinite(gammaBARadians) ||
		!Number.isSafeInteger(azimuthSampleCount) ||
		azimuthSampleCount < 3
	) {
		throw new RangeError('symmetric traversal requires finite angles and at least three azimuth samples');
	}
	const sampleStepRadians = TWO_PI / azimuthSampleCount;
	const normalizedPhiB0 = wrapPositive(phiB0Radians);
	const startFaceIndex = Math.min(Math.floor(normalizedPhiB0 / sampleStepRadians), azimuthSampleCount - 1);
	const direction = wrapSigned(gammaBARadians - normalizedPhiB0) < 0 ? -1 : 1;
	const traversal = new Uint32Array(azimuthSampleCount);
	for (let visitIndex = 0; visitIndex < azimuthSampleCount; visitIndex += 1) {
		traversal[visitIndex] = positiveModulo(startFaceIndex + direction * visitIndex, azimuthSampleCount);
	}
	return traversal;
}

/**
 * Clips cones exhaustively while visiting B faces in symmetric-ray order.
 *
 * This characterization strategy must match {@link computeConeIntersectionOracleCpu}
 * exactly: it changes only face order and never removes a face. The additional
 * visit-order output measures whether the heuristic finds the final minimum
 * early enough to justify later conservative pruning structures.
 */
export function computeConeIntersectionSymmetricOrderCpu(
	staticInput: SymmetricConeIntersectionStaticInput,
	rawCones: RawConePrecompute,
): SymmetricConeIntersectionPrecompute {
	validateInputs(staticInput, rawCones);
	validatePairInputs(staticInput, rawCones.cityCount);
	const { cityCount, azimuthSampleCount, rawConeRimEcef } = rawCones;
	const rayCount = cityCount * azimuthSampleCount;
	const coneIntersectionDistanceMeters = new Float32Array(rayCount);
	const ciseledConeRimEcef = new Float32Array(rawConeRimEcef);
	const winningNeighborCityIndexes = new Uint32Array(rayCount);
	const winningFaceIndexes = new Uint32Array(rayCount);
	const winningFaceVisitOrders = new Uint32Array(rayCount);
	const testedFaceCounts = new Uint32Array(rayCount);
	winningNeighborCityIndexes.fill(UNUSED_INDEX);
	winningFaceIndexes.fill(UNUSED_INDEX);
	winningFaceVisitOrders.fill(UNUSED_INDEX);

	const rayOrigin: [number, number, number] = [0, 0, 0];
	const rayDirection: [number, number, number] = [0, 0, 0];
	const triangleSummit: [number, number, number] = [0, 0, 0];
	const triangleRim0: [number, number, number] = [0, 0, 0];
	const triangleRim1: [number, number, number] = [0, 0, 0];

	for (let cityAIndex = 0; cityAIndex < cityCount; cityAIndex += 1) {
		readCitySummit(staticInput.cityNed2EcefMatrices, cityAIndex, rayOrigin);
		const candidateOffset = cityAIndex * staticInput.neighborLimit;
		const candidateCount = staticInput.overlapCandidateCounts[cityAIndex];

		for (let sampleIndex = 0; sampleIndex < azimuthSampleCount; sampleIndex += 1) {
			const rayIndex = cityAIndex * azimuthSampleCount + sampleIndex;
			const rimOffset = rayIndex * RAW_CONE_RIM_ECEF_STRIDE;
			const phiARadians = (sampleIndex * TWO_PI) / azimuthSampleCount;
			rayDirection[0] = rawConeRimEcef[rimOffset] - rayOrigin[0];
			rayDirection[1] = rawConeRimEcef[rimOffset + 1] - rayOrigin[1];
			rayDirection[2] = rawConeRimEcef[rimOffset + 2] - rayOrigin[2];
			const rawDistanceMeters = Math.hypot(rayDirection[0], rayDirection[1], rayDirection[2]);
			if (!(rawDistanceMeters > RAY_ORIGIN_EPSILON_METERS)) {
				throw new RangeError('raw cone rays must have a strictly positive finite length');
			}
			rayDirection[0] /= rawDistanceMeters;
			rayDirection[1] /= rawDistanceMeters;
			rayDirection[2] /= rawDistanceMeters;
			let bestDistanceMeters = rawDistanceMeters;

			for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
				const cityBIndex = staticInput.overlapCandidates[candidateOffset + candidateIndex];
				const pairOffset = (cityAIndex * cityCount + cityBIndex) * CITY_PAIR_INVARIANT_STRIDE;
				const gammaABRadians = staticInput.cityPairInvariants[pairOffset];
				const gammaBARadians = staticInput.cityPairInvariants[pairOffset + 1];
				const phiB0Radians = wrapPositive(gammaBARadians - wrapSigned(phiARadians - gammaABRadians));
				const faceTraversal = buildSymmetricFaceTraversal(phiB0Radians, gammaBARadians, azimuthSampleCount);
				readCitySummit(staticInput.cityNed2EcefMatrices, cityBIndex, triangleSummit);

				for (const faceIndex of faceTraversal) {
					const nextFaceIndex = (faceIndex + 1) % azimuthSampleCount;
					readRawRim(rawCones, cityBIndex, faceIndex, triangleRim0);
					readRawRim(rawCones, cityBIndex, nextFaceIndex, triangleRim1);
					testedFaceCounts[rayIndex] += 1;
					const distanceMeters = intersectRayTriangleDoubleSided(
						rayOrigin,
						rayDirection,
						triangleSummit,
						triangleRim0,
						triangleRim1,
						bestDistanceMeters,
					);
					if (
						distanceMeters !== undefined &&
						isPreferredIntersection(
							distanceMeters,
							cityBIndex,
							faceIndex,
							bestDistanceMeters,
							winningNeighborCityIndexes[rayIndex],
							winningFaceIndexes[rayIndex],
						)
					) {
						bestDistanceMeters = distanceMeters;
						winningNeighborCityIndexes[rayIndex] = cityBIndex;
						winningFaceIndexes[rayIndex] = faceIndex;
						winningFaceVisitOrders[rayIndex] = testedFaceCounts[rayIndex];
					}
				}
			}

			coneIntersectionDistanceMeters[rayIndex] = bestDistanceMeters;
			if (winningNeighborCityIndexes[rayIndex] !== UNUSED_INDEX) {
				ciseledConeRimEcef[rimOffset] = rayOrigin[0] + rayDirection[0] * bestDistanceMeters;
				ciseledConeRimEcef[rimOffset + 1] = rayOrigin[1] + rayDirection[1] * bestDistanceMeters;
				ciseledConeRimEcef[rimOffset + 2] = rayOrigin[2] + rayDirection[2] * bestDistanceMeters;
				ciseledConeRimEcef[rimOffset + 3] = 1;
			}
		}
	}

	return {
		cityCount,
		azimuthSampleCount,
		coneIntersectionDistanceMeters,
		ciseledConeRimEcef,
		winningNeighborCityIndexes,
		winningFaceIndexes,
		testedFaceCounts,
		winningFaceVisitOrders,
	};
}

function validateInputs(staticInput: ConeIntersectionStaticInput, rawCones: RawConePrecompute): void {
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

function validatePairInputs(staticInput: SymmetricConeIntersectionStaticInput, cityCount: number): void {
	const pairCount = cityCount * cityCount;
	if (
		staticInput.cityPairInvariants.length !== pairCount * CITY_PAIR_INVARIANT_STRIDE ||
		staticInput.cityPairSectorIndexes.length !== pairCount
	) {
		throw new RangeError('city pair buffers do not match cityCount');
	}
}

function readCitySummit(buffer: Float32Array, cityIndex: number, output: [number, number, number]): void {
	const offset = cityIndex * CITY_NED2ECEF_MATRIX_STRIDE + 12;
	output[0] = buffer[offset];
	output[1] = buffer[offset + 1];
	output[2] = buffer[offset + 2];
}

function readRawRim(
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

function isFiniteVector(vector: Vector3): boolean {
	return Number.isFinite(vector[0]) && Number.isFinite(vector[1]) && Number.isFinite(vector[2]);
}

function wrapPositive(angleRadians: number): number {
	const remainder = angleRadians % TWO_PI;
	return remainder < 0 ? remainder + TWO_PI : remainder;
}

function wrapSigned(angleRadians: number): number {
	const positive = wrapPositive(angleRadians);
	return positive > PI ? positive - TWO_PI : positive;
}

function positiveModulo(value: number, modulus: number): number {
	const remainder = value % modulus;
	return remainder < 0 ? remainder + modulus : remainder;
}

function isPreferredIntersection(
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
