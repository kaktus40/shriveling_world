import {
	PREPARED_EDGE_STRIDE,
	type PreparedDataset,
} from '../data';
import {
	CITY_PAIR_INVARIANT_STRIDE,
	type DynamicTownPrecompute,
	type DynamicTownPrecomputeByYear,
	type StaticTownPrecompute,
} from './types';
import { getCityPairIndex } from './static-town-cpu';

interface SelectedLink {
	destinationCityIndex: number;
	azimuthRadians: number;
	alphaRadians: number;
}

/**
 * Computes compact dynamic cone inputs for one year using the CPU profile.
 *
 * Each resolved business edge is evaluated once and emits both directions.
 * Road edges are omitted because Road defines the default surface. For
 * multiple active terrestrial modes toward the same destination, the lowest
 * alpha is retained and never allowed to exceed Road alpha.
 */
export function computeDynamicTownPrecomputeForYearCpu(
	dataset: PreparedDataset,
	staticTown: StaticTownPrecompute,
	year: number,
): DynamicTownPrecompute {
	validateDynamicInputs(dataset, staticTown, year);

	const roadSpeedYear = dataset.speedTimeline.speedByModeByYear[String(dataset.speedTimeline.roadModeCode)]?.[String(year)];
	if (!roadSpeedYear || !Number.isFinite(roadSpeedYear.alphaRadians)) {
		throw new RangeError(`Road alpha is unavailable for year ${year}`);
	}
	const roadAlphaRadians = roadSpeedYear.alphaRadians;
	const selectedByCity = Array.from({ length: dataset.cityCount }, () => new Map<number, SelectedLink>());
	const terrestrialModeIds = new Set(dataset.speedTimeline.transportTypes.cones);

	for (let edgeIndex = 0; edgeIndex < dataset.edgeCount; edgeIndex += 1) {
		if (year < dataset.edgeYearBegins[edgeIndex] || year > dataset.edgeYearEnds[edgeIndex]) {
			continue;
		}

		const edgeOffset = edgeIndex * PREPARED_EDGE_STRIDE;
		const originCityIndex = dataset.edges[edgeOffset];
		const destinationCityIndex = dataset.edges[edgeOffset + 1];
		const modeIndex = dataset.edges[edgeOffset + 2];
		const modeId = dataset.modeIds[modeIndex];
		if (modeId === dataset.speedTimeline.roadModeId || !terrestrialModeIds.has(modeId)) {
			continue;
		}

		const modeCode = dataset.modeCodes[modeIndex];
		const modeSpeedYear = dataset.speedTimeline.speedByModeByYear[String(modeCode)]?.[String(year)];
		if (!modeSpeedYear || !Number.isFinite(modeSpeedYear.alphaRadians)) {
			continue;
		}
		const alphaRadians = Math.min(roadAlphaRadians, modeSpeedYear.alphaRadians);
		selectLink(selectedByCity, staticTown, originCityIndex, destinationCityIndex, alphaRadians);
		selectLink(selectedByCity, staticTown, destinationCityIndex, originCityIndex, alphaRadians);
	}

	return compactSelectedLinks(selectedByCity, year, roadAlphaRadians);
}

/** Computes dynamic cone inputs for every integer year in the prepared span. */
export function computeDynamicTownPrecomputeByYearCpu(
	dataset: PreparedDataset,
	staticTown: StaticTownPrecompute,
): DynamicTownPrecomputeByYear {
	const { beginYear, endYear } = dataset.speedTimeline.span;
	if (!Number.isSafeInteger(beginYear) || !Number.isSafeInteger(endYear) || beginYear > endYear) {
		throw new RangeError('prepared historical span must contain inclusive integer years');
	}

	const byYear: DynamicTownPrecomputeByYear = {};
	for (let year = beginYear; year <= endYear; year += 1) {
		byYear[String(year)] = computeDynamicTownPrecomputeForYearCpu(dataset, staticTown, year);
	}
	return byYear;
}

function selectLink(
	selectedByCity: Map<number, SelectedLink>[],
	staticTown: StaticTownPrecompute,
	originCityIndex: number,
	destinationCityIndex: number,
	alphaRadians: number,
): void {
	const links = selectedByCity[originCityIndex];
	const current = links.get(destinationCityIndex);
	if (current && current.alphaRadians <= alphaRadians) {
		return;
	}
	const pairOffset =
		getCityPairIndex(originCityIndex, destinationCityIndex, staticTown.cityCount) * CITY_PAIR_INVARIANT_STRIDE;
	links.set(destinationCityIndex, {
		destinationCityIndex,
		azimuthRadians: staticTown.cityPairInvariants[pairOffset],
		alphaRadians,
	});
}

function compactSelectedLinks(
	selectedByCity: Map<number, SelectedLink>[],
	year: number,
	roadAlphaRadians: number,
): DynamicTownPrecompute {
	const cityCount = selectedByCity.length;
	const cityLinkOffsets = new Uint32Array(cityCount);
	const cityLinkCounts = new Uint32Array(cityCount);
	const cityFastestTerrestrialAlphaRadians = new Float32Array(cityCount);
	const compactLinks: SelectedLink[] = [];

	for (let cityIndex = 0; cityIndex < cityCount; cityIndex += 1) {
		const links = [...selectedByCity[cityIndex].values()].sort(
			(left, right) => left.azimuthRadians - right.azimuthRadians || left.destinationCityIndex - right.destinationCityIndex,
		);
		cityLinkOffsets[cityIndex] = compactLinks.length;
		cityLinkCounts[cityIndex] = links.length;
		cityFastestTerrestrialAlphaRadians[cityIndex] = links.reduce(
			(minimum, link) => Math.min(minimum, link.alphaRadians),
			roadAlphaRadians,
		);
		compactLinks.push(...links);
	}

	return {
		year,
		roadAlphaRadians,
		cityLinkOffsets,
		cityLinkCounts,
		cityLinkDestinationIndexes: Uint32Array.from(compactLinks.map((link) => link.destinationCityIndex)),
		cityLinkAzimuthRadians: Float32Array.from(compactLinks.map((link) => link.azimuthRadians)),
		cityLinkAlphaRadians: Float32Array.from(compactLinks.map((link) => link.alphaRadians)),
		cityFastestTerrestrialAlphaRadians,
	};
}

function validateDynamicInputs(dataset: PreparedDataset, staticTown: StaticTownPrecompute, year: number): void {
	if (!Number.isSafeInteger(year)) {
		throw new RangeError('year must be a safe integer');
	}
	if (staticTown.cityCount !== dataset.cityCount) {
		throw new RangeError('static-town city count must match prepared dataset city count');
	}
	if (dataset.edgeYearBegins.length !== dataset.edgeCount || dataset.edgeYearEnds.length !== dataset.edgeCount) {
		throw new RangeError('prepared edge-year buffers must match edge count');
	}
}
