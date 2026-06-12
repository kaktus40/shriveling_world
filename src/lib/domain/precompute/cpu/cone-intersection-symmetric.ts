import {
	CITY_PAIR_INVARIANT_STRIDE,
	UNUSED_INDEX,
	type RawConePrecompute,
	type SymmetricConeIntersectionPrecompute,
	type SymmetricConeIntersectionStaticInput,
} from '../types';
import { RAW_CONE_RIM_ECEF_STRIDE, getRawConeAzimuthRadians } from './raw-cone-cpu';
import { RAY_ORIGIN_EPSILON_METERS } from './cone-intersection-constants';
import { wrapPositive, wrapSigned } from './cone-intersection-angular';
import {
	isPreferredIntersection,
	readCitySummit,
	readRawRim,
	validateInputs,
	validatePairInputs,
	intersectRayTriangleDoubleSided,
} from './cone-intersection-support';
import { buildSymmetricFaceTraversal } from './cone-intersection-traversal';

/**
 * Clips cones exhaustively while visiting B faces in symmetric-ray order.
 *
 * The order changes only the traversal priority; it never removes a face and
 * therefore remains a pure characterization of the oracle.
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
			const phiARadians = getRawConeAzimuthRadians(sampleIndex, azimuthSampleCount);
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
