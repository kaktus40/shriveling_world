import {
	UNUSED_INDEX,
	type ConeIntersectionOraclePrecompute,
	type ConeIntersectionStaticInput,
	type RawConePrecompute,
} from '../types';
import { RAW_CONE_RIM_ECEF_STRIDE } from './raw-cone-cpu';
import { RAY_ORIGIN_EPSILON_METERS } from './cone-intersection-constants';
import {
	intersectRayTriangleDoubleSided,
	isPreferredIntersection,
	readCitySummit,
	readRawRim,
	validateInputs,
} from './cone-intersection-support';

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
