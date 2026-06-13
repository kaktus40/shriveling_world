import {
	benchmarkConeIntersectionAlphaAwareNeighborhoodSweepCpu,
	computeRawConePrecomputeCpu,
	computeStaticTownPrecomputeCpu,
	type AlphaAwareNeighborhoodBenchmarkReport,
} from '$lib/domain/precompute';
import type {
	DynamicTownPrecompute,
	RawConePrecompute,
	StaticTownPrecompute,
	StaticTownPrecomputeOptions,
	StaticTownInput,
	SymmetricConeIntersectionStaticInput,
} from '$lib/domain/precompute';

export interface WorkspaceSyntheticHeuristicInput {
	readonly cityCoordinatesText: string;
	readonly cityLinksText: string;
	readonly roadAlphaRadians: number;
	readonly azimuthSampleCount: number;
	readonly coneLengthMeters: number;
	readonly attenuationRadians: number;
	readonly sectorCount: number;
	readonly neighborLimit: number;
	readonly sweepWidths: readonly number[];
}

export interface WorkspaceSyntheticHeuristicReport {
	readonly staticTown: StaticTownPrecompute;
	readonly dynamicTown: DynamicTownPrecompute;
	readonly rawCones: RawConePrecompute;
	readonly benchmark: AlphaAwareNeighborhoodBenchmarkReport;
}

export function benchmarkSyntheticAlphaAwareHeuristic(
	input: WorkspaceSyntheticHeuristicInput,
): WorkspaceSyntheticHeuristicReport {
	const cityLonLatRadians = parseCityCoordinates(input.cityCoordinatesText);
	const staticTownInput: StaticTownInput = { cityLonLatRadians };
	const staticTownOptions: StaticTownPrecomputeOptions = {
		sectorCount: input.sectorCount,
		neighborLimit: input.neighborLimit,
	};
	const staticTown = computeStaticTownPrecomputeCpu(staticTownInput, staticTownOptions);
	const dynamicTown = parseDynamicTown(input.cityLinksText, cityLonLatRadians.length / 2, input.roadAlphaRadians);
	const rawCones = computeRawConePrecomputeCpu(staticTown, dynamicTown, {
		shape: 'complex',
		azimuthSampleCount: input.azimuthSampleCount,
		coneLengthMeters: input.coneLengthMeters,
		attenuationRadians: input.attenuationRadians,
	});
	const benchmark = benchmarkConeIntersectionAlphaAwareNeighborhoodSweepCpu(
		staticTown as SymmetricConeIntersectionStaticInput,
		rawCones,
		{ roadAlphaRadians: input.roadAlphaRadians, alphaEpsilonRadians: input.attenuationRadians },
		input.sweepWidths,
		{ warmupIterations: 0, measurementIterations: 1 },
	);

	return { staticTown, dynamicTown, rawCones, benchmark };
}

function parseCityCoordinates(text: string): Float32Array {
	const rows = splitMeaningfulLines(text);
	if (rows.length === 0) {
		throw new RangeError('at least one city coordinate is required');
	}
	const coordinates: number[] = [];
	for (const row of rows) {
		const [lonText, latText] = row.split(/[,\s]+/).filter(Boolean);
		const longitudeRadians = Number(lonText);
		const latitudeRadians = Number(latText);
		if (!Number.isFinite(longitudeRadians) || !Number.isFinite(latitudeRadians)) {
			throw new RangeError(`invalid city coordinate row: "${row}"`);
		}
		coordinates.push(longitudeRadians, latitudeRadians);
	}
	return Float32Array.from(coordinates);
}

function parseDynamicTown(text: string, cityCount: number, roadAlphaRadians: number): DynamicTownPrecompute {
	const rows = splitMeaningfulLines(text);
	if (rows.length !== cityCount) {
		throw new RangeError(`cityLinksText must contain exactly ${cityCount} row(s)`);
	}
	const cityLinkOffsets = new Uint32Array(cityCount);
	const cityLinkCounts = new Uint32Array(cityCount);
	const cityLinkDestinationIndexes: number[] = [];
	const cityLinkAzimuthRadians: number[] = [];
	const cityLinkAlphaRadians: number[] = [];
	const cityFastestTerrestrialAlphaRadians = new Float32Array(cityCount);
	cityFastestTerrestrialAlphaRadians.fill(roadAlphaRadians);

	let compactOffset = 0;
	for (let cityIndex = 0; cityIndex < cityCount; cityIndex += 1) {
		const tokens = rows[cityIndex]
			.split(/[;|]/)
			.map((token) => token.trim())
			.filter(Boolean);
		cityLinkOffsets[cityIndex] = compactOffset;
		cityLinkCounts[cityIndex] = tokens.length;
		for (const token of tokens) {
			const [destinationPart, azimuthAlphaPart] = token.includes('@') ? token.split('@', 2) : ['', token];
			const [azimuthText, alphaText] = azimuthAlphaPart.split(':').map((part) => part.trim());
			const azimuthRadians = Number(azimuthText);
			const alphaRadians = Number(alphaText);
			if (!Number.isFinite(azimuthRadians) || !Number.isFinite(alphaRadians)) {
				throw new RangeError(`invalid link row: "${token}"`);
			}
			const destinationCityIndex = destinationPart ? Number(destinationPart) : cityIndex;
			if (!Number.isSafeInteger(destinationCityIndex) || destinationCityIndex < 0) {
				throw new RangeError(`invalid destination city index in "${token}"`);
			}
			cityLinkDestinationIndexes.push(destinationCityIndex);
			cityLinkAzimuthRadians.push(azimuthRadians);
			cityLinkAlphaRadians.push(alphaRadians);
			cityFastestTerrestrialAlphaRadians[cityIndex] = Math.min(cityFastestTerrestrialAlphaRadians[cityIndex], alphaRadians);
			compactOffset += 1;
		}
	}

	return {
		year: 0,
		roadAlphaRadians,
		cityLinkOffsets,
		cityLinkCounts,
		cityLinkDestinationIndexes: Uint32Array.from(cityLinkDestinationIndexes),
		cityLinkAzimuthRadians: Float32Array.from(cityLinkAzimuthRadians),
		cityLinkAlphaRadians: Float32Array.from(cityLinkAlphaRadians),
		cityFastestTerrestrialAlphaRadians,
	};
}

function splitMeaningfulLines(text: string): string[] {
	return text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith('#'));
}
