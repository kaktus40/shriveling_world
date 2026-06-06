import {
	CITY_PAIR_INVARIANT_STRIDE,
	UNUSED_INDEX,
	type CityPairInvariantBuffers,
	type OverlapCandidateBuffers,
} from './types';

interface OverlapCandidate {
	cityIndex: number;
	forwardAzimuthRadians: number;
	angularDistanceRadians: number;
}

interface SectorCandidates {
	sectorIndex: number;
	candidates: OverlapCandidate[];
}

/**
 * Selects a bounded, angularly distributed set of neighbors for every city.
 *
 * This CPU reference reproduces the historical quota redistribution:
 *
 * 1. Group all non-diagonal ordered pairs by azimuth sector.
 * 2. Process sectors from least to most populated.
 * 3. Give each sector up to `ceil(remainingSlots / remainingSectors)` nearest
 *    candidates.
 * 4. Order the retained candidates by forward azimuth.
 *
 * Only neighbor indexes are stored. Azimuths and distances remain available
 * without duplication through the dense ordered-pair invariant buffer.
 */
export function selectOverlapCandidatesCpu(
	pairInvariants: CityPairInvariantBuffers,
	neighborLimit: number,
): OverlapCandidateBuffers {
	validatePairInvariantBuffers(pairInvariants);
	if (!Number.isSafeInteger(neighborLimit) || neighborLimit < 0) {
		throw new RangeError('neighborLimit must be a non-negative safe integer');
	}

	const { cityCount, sectorCount, cityPairInvariants, cityPairSectorIndexes } = pairInvariants;
	const effectiveNeighborLimit = Math.min(neighborLimit, Math.max(0, cityCount - 1));
	const overlapCandidates = new Uint32Array(cityCount * effectiveNeighborLimit);
	overlapCandidates.fill(UNUSED_INDEX);
	const overlapCandidateCounts = new Uint32Array(cityCount);

	for (let cityIndex = 0; cityIndex < cityCount; cityIndex += 1) {
		const sectors: SectorCandidates[] = Array.from({ length: sectorCount }, (_, sectorIndex) => ({
			sectorIndex,
			candidates: [],
		}));

		for (let neighborCityIndex = 0; neighborCityIndex < cityCount; neighborCityIndex += 1) {
			if (cityIndex === neighborCityIndex) {
				continue;
			}

			const pairIndex = cityIndex * cityCount + neighborCityIndex;
			const pairOffset = pairIndex * CITY_PAIR_INVARIANT_STRIDE;
			sectors[cityPairSectorIndexes[pairIndex]].candidates.push({
				cityIndex: neighborCityIndex,
				forwardAzimuthRadians: cityPairInvariants[pairOffset],
				angularDistanceRadians: cityPairInvariants[pairOffset + 2],
			});
		}

		sectors.sort(
			(a, b) => a.candidates.length - b.candidates.length || a.sectorIndex - b.sectorIndex,
		);

		let remainingSlots = effectiveNeighborLimit;
		const selected: OverlapCandidate[] = [];
		for (let sectorOrder = 0; sectorOrder < sectors.length; sectorOrder += 1) {
			const sector = sectors[sectorOrder];
			sector.candidates.sort(
				(a, b) => a.angularDistanceRadians - b.angularDistanceRadians || a.cityIndex - b.cityIndex,
			);
			const remainingSectors = sectors.length - sectorOrder;
			const contributionCount = Math.min(
				sector.candidates.length,
				Math.ceil(remainingSlots / remainingSectors),
			);
			selected.push(...sector.candidates.slice(0, contributionCount));
			remainingSlots -= contributionCount;
		}

		selected.sort(
			(a, b) => a.forwardAzimuthRadians - b.forwardAzimuthRadians || a.cityIndex - b.cityIndex,
		);
		overlapCandidateCounts[cityIndex] = selected.length;
		const cityOffset = cityIndex * effectiveNeighborLimit;
		for (let candidateIndex = 0; candidateIndex < selected.length; candidateIndex += 1) {
			overlapCandidates[cityOffset + candidateIndex] = selected[candidateIndex].cityIndex;
		}
	}

	return { neighborLimit: effectiveNeighborLimit, overlapCandidates, overlapCandidateCounts };
}

function validatePairInvariantBuffers(pairInvariants: CityPairInvariantBuffers): void {
	const { cityCount, sectorCount, cityPairInvariants, cityPairSectorIndexes } = pairInvariants;
	if (!Number.isSafeInteger(cityCount) || cityCount < 0) {
		throw new RangeError('cityCount must be a non-negative safe integer');
	}
	if (!Number.isSafeInteger(sectorCount) || sectorCount <= 0) {
		throw new RangeError('sectorCount must be a strictly positive safe integer');
	}
	const pairCount = cityCount * cityCount;
	if (cityPairInvariants.length !== pairCount * CITY_PAIR_INVARIANT_STRIDE) {
		throw new RangeError('cityPairInvariants length does not match cityCount');
	}
	if (cityPairSectorIndexes.length !== pairCount) {
		throw new RangeError('cityPairSectorIndexes length does not match cityCount');
	}
	for (const sectorIndex of cityPairSectorIndexes) {
		if (sectorIndex >= sectorCount) {
			throw new RangeError('cityPairSectorIndexes contains an invalid sector index');
		}
	}
}
