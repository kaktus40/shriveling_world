import {
	type AlphaAwareConeIntersectionOptions,
	type AlphaAwareConeIntersectionPrecompute,
	CITY_PAIR_INVARIANT_STRIDE,
	type RawConePrecompute,
	type SymmetricConeIntersectionStaticInput,
	UNUSED_INDEX,
} from '../types';
import { RAW_CONE_RIM_ECEF_STRIDE, getRawConeAzimuthRadians } from './raw-cone-cpu';
import {
	ALPHA_SUPPORT_EPSILON_RADIANS,
	RAY_ORIGIN_EPSILON_METERS,
} from './cone-intersection-constants';
import { wrapPositive, wrapSigned } from './cone-intersection-angular';
import { validateAlphaAwareValues } from './cone-intersection-validation';
import {
	buildAlphaAwareFaceTraversalFromFastFaces,
	classifyFastConeFaces,
} from './cone-intersection-traversal';
import {
	isPreferredIntersection,
	readCitySummit,
	readRawRim,
	intersectRayTriangleDoubleSided,
	validateInputs,
	validatePairInputs,
} from './cone-intersection-support';

/**
 * Clips cones exhaustively while prioritizing the alpha-aware search window.
 *
 * The traversal still visits every face exactly once. The additional outputs
 * measure how often the proposal window finds the winning face early enough to
 * justify later pruning heuristics.
 */
export function computeConeIntersectionAlphaAwareOrderCpu(
	staticInput: SymmetricConeIntersectionStaticInput,
	rawCones: RawConePrecompute,
	options: AlphaAwareConeIntersectionOptions,
): AlphaAwareConeIntersectionPrecompute {
	validateInputs(staticInput, rawCones);
	validatePairInputs(staticInput, rawCones.cityCount);
	validateAlphaAwareValues(
		rawCones.azimuthSampleCount,
		options.roadAlphaRadians,
		options.bilateralNeighborhoodFaceCount,
		options.alphaEpsilonRadians ?? ALPHA_SUPPORT_EPSILON_RADIANS,
	);
	const { cityCount, azimuthSampleCount, rawConeRimEcef } = rawCones;
	const rayCount = cityCount * azimuthSampleCount;
	const coneIntersectionDistanceMeters = new Float32Array(rayCount);
	const ciseledConeRimEcef = new Float32Array(rawConeRimEcef);
	const winningNeighborCityIndexes = new Uint32Array(rayCount);
	const winningFaceIndexes = new Uint32Array(rayCount);
	const winningFaceVisitOrders = new Uint32Array(rayCount);
	const testedFaceCounts = new Uint32Array(rayCount);
	const priorityFaceCounts = new Uint32Array(rayCount);
	const priorityFastFaceCounts = new Uint32Array(rayCount);
	const winningFacePriorityFlags = new Uint8Array(rayCount);
	winningNeighborCityIndexes.fill(UNUSED_INDEX);
	winningFaceIndexes.fill(UNUSED_INDEX);
	winningFaceVisitOrders.fill(UNUSED_INDEX);
	const fastFacesByCity = new Uint8Array(rayCount);
	for (let cityIndex = 0; cityIndex < cityCount; cityIndex += 1) {
		const alphaOffset = cityIndex * azimuthSampleCount;
		fastFacesByCity.set(
			classifyFastConeFaces(
				rawCones.coneAlphaRadians.subarray(alphaOffset, alphaOffset + azimuthSampleCount),
				options.roadAlphaRadians,
				options.alphaEpsilonRadians ?? ALPHA_SUPPORT_EPSILON_RADIANS,
			),
			alphaOffset,
		);
	}

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
				const alphaOffset = cityBIndex * azimuthSampleCount;
				const traversal = buildAlphaAwareFaceTraversalFromFastFaces(
					phiB0Radians,
					gammaBARadians,
					fastFacesByCity.subarray(alphaOffset, alphaOffset + azimuthSampleCount),
					options.bilateralNeighborhoodFaceCount,
				);
				priorityFaceCounts[rayIndex] += traversal.priorityFaceCount;
				priorityFastFaceCounts[rayIndex] += traversal.priorityFastFaceCount;
				readCitySummit(staticInput.cityNed2EcefMatrices, cityBIndex, triangleSummit);

				for (let localVisitIndex = 0; localVisitIndex < traversal.faceIndexes.length; localVisitIndex += 1) {
					const faceIndex = traversal.faceIndexes[localVisitIndex];
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
						winningFacePriorityFlags[rayIndex] = localVisitIndex < traversal.priorityFaceCount ? 1 : 0;
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
		priorityFaceCounts,
		priorityFastFaceCounts,
		winningFacePriorityFlags,
	};
}
