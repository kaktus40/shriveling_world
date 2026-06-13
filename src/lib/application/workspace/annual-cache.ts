import { toStaticTownInput, type PreparedDataset } from '$lib/domain/data';
import {
	computeConeIntersectionOracleCpu,
	computeDynamicTownPrecomputeForYearCpu,
	computeRawConePrecomputeCpu,
	computeStaticTownPrecomputeCpu,
	summarizeBenchmarkSamples,
	type ComputeBenchmarkOptions,
	type ComputeBenchmarkStatistics,
	type RawConePrecomputeOptions,
	type StaticTownPrecompute,
	type StaticTownPrecomputeOptions,
} from '$lib/domain/precompute';
import { createDefaultConePipelineOptions } from '$lib/application/validation';

type AnnualCacheConeOptions = ReturnType<typeof createDefaultConePipelineOptions>;

/** Yearly cache measurement for one representative annual slice. */
export interface WorkspaceAnnualCacheCase {
	readonly year: number;
	readonly miss: ComputeBenchmarkStatistics;
	readonly hit: ComputeBenchmarkStatistics;
	readonly rayCount: number;
	readonly byteLength: number;
}

/** Summary of the annual cache measurement. */
export interface WorkspaceAnnualCacheSummary {
	readonly yearCount: number;
	readonly averageMissMilliseconds: number;
	readonly averageHitMilliseconds: number;
	readonly averageGainMilliseconds: number;
	readonly bestGainMilliseconds: number;
	readonly bestYear: number | null;
	readonly totalByteLength: number;
}

/** Reusable cache benchmark for cone-intersection distances across years. */
export interface WorkspaceAnnualCacheReport {
	readonly staticTown: StaticTownPrecompute;
	readonly years: readonly number[];
	readonly cases: readonly WorkspaceAnnualCacheCase[];
	readonly summary: WorkspaceAnnualCacheSummary;
}

/** Options controlling the annual cache benchmark. */
export interface WorkspaceAnnualCacheRequest extends ComputeBenchmarkOptions {
	readonly yearSamples?: readonly number[];
}

/**
 * Benchmarks the annual cache contract used for cone-intersection distances.
 *
 * The cache stores only `coneIntersectionDistanceMeters` by year. The yearly
 * benchmark uses the CPU oracle so the measurement stays stable and keeps the
 * cache contract independent from the selected compute profile.
 */
export function benchmarkWorkspaceAnnualConeIntersectionCache(
	preparedDataset: PreparedDataset,
	request: WorkspaceAnnualCacheRequest = {},
): WorkspaceAnnualCacheReport {
	const coneOptions = createDefaultConePipelineOptions(preparedDataset);
	const years = normalizeYearSamples(
		preparedDataset.speedTimeline.span.beginYear,
		preparedDataset.speedTimeline.span.endYear,
		request.yearSamples,
	);
	const warmupIterations = request.warmupIterations ?? 1;
	const measurementIterations = request.measurementIterations ?? 3;
	const clock = request.clock ?? (() => performance.now());
	const staticTown = computeStaticTownPrecomputeCpu(toStaticTownInput(preparedDataset), {
		sectorCount: coneOptions.sectorCount,
		neighborLimit: coneOptions.neighborLimit,
	});
	const cache = new Map<number, Float32Array>();
	const cases = years.map((year) =>
		measureAnnualCacheCase(preparedDataset, staticTown, coneOptions, year, cache, warmupIterations, measurementIterations, clock),
	);

	return {
		staticTown,
		years,
		cases,
		summary: summarizeAnnualCacheCases(cases),
	};
}

function measureAnnualCacheCase(
	preparedDataset: PreparedDataset,
	staticTown: StaticTownPrecompute,
	coneOptions: AnnualCacheConeOptions,
	year: number,
	cache: Map<number, Float32Array>,
	warmupIterations: number,
	measurementIterations: number,
	clock: () => number,
): WorkspaceAnnualCacheCase {
	const missSamples = measureSamples(warmupIterations, measurementIterations, clock, () => {
		cache.delete(year);
		cache.set(year, computeAnnualConeIntersectionDistances(preparedDataset, staticTown, year, coneOptions));
	});

	const cachedDistances = cache.get(year);
	if (!cachedDistances) {
		throw new Error(`annual cache benchmark failed to populate year ${year}`);
	}

	const hitSamples = measureSamples(warmupIterations, measurementIterations, clock, () => {
		const value = cache.get(year);
		if (!value) {
			throw new Error(`annual cache benchmark missed year ${year}`);
		}
		void value.byteLength;
	});

	return {
		year,
		miss: summarizeBenchmarkSamples(missSamples),
		hit: summarizeBenchmarkSamples(hitSamples),
		rayCount: cachedDistances.length,
		byteLength: cachedDistances.byteLength,
	};
}

function computeAnnualConeIntersectionDistances(
	preparedDataset: PreparedDataset,
	staticTown: StaticTownPrecompute,
	year: number,
	coneOptions: AnnualCacheConeOptions,
): Float32Array {
	const dynamicTown = computeDynamicTownPrecomputeForYearCpu(preparedDataset, staticTown, year);
	const rawConeOptions: RawConePrecomputeOptions = {
		shape: coneOptions.shape,
		azimuthSampleCount: coneOptions.azimuthSampleCount,
		coneLengthMeters: coneOptions.coneLengthMeters,
		attenuationRadians: coneOptions.attenuationRadians,
	};
	const rawCones = computeRawConePrecomputeCpu(staticTown, dynamicTown, rawConeOptions);
	return computeConeIntersectionOracleCpu(staticTown, rawCones).coneIntersectionDistanceMeters;
}

function measureSamples(
	warmupIterations: number,
	measurementIterations: number,
	clock: () => number,
	execute: () => void,
): number[] {
	const warmups = Math.max(0, Math.floor(warmupIterations));
	const measurements = Math.max(1, Math.floor(measurementIterations));
	for (let iteration = 0; iteration < warmups; iteration += 1) {
		execute();
	}

	const samples: number[] = [];
	for (let iteration = 0; iteration < measurements; iteration += 1) {
		const beginMilliseconds = clock();
		execute();
		samples.push(clock() - beginMilliseconds);
	}
	return samples;
}

function summarizeAnnualCacheCases(cases: readonly WorkspaceAnnualCacheCase[]): WorkspaceAnnualCacheSummary {
	if (cases.length === 0) {
		return {
			yearCount: 0,
			averageMissMilliseconds: 0,
			averageHitMilliseconds: 0,
			averageGainMilliseconds: 0,
			bestGainMilliseconds: 0,
			bestYear: null,
			totalByteLength: 0,
		};
	}

	let totalMissMilliseconds = 0;
	let totalHitMilliseconds = 0;
	let totalGainMilliseconds = 0;
	let totalByteLength = 0;
	let bestGainMilliseconds = Number.NEGATIVE_INFINITY;
	let bestYear: number | null = null;
	for (const entry of cases) {
		const miss = entry.miss.medianMilliseconds;
		const hit = entry.hit.medianMilliseconds;
		const gain = miss - hit;
		totalMissMilliseconds += miss;
		totalHitMilliseconds += hit;
		totalGainMilliseconds += gain;
		totalByteLength += entry.byteLength;
		if (gain > bestGainMilliseconds) {
			bestGainMilliseconds = gain;
			bestYear = entry.year;
		}
	}

	return {
		yearCount: cases.length,
		averageMissMilliseconds: totalMissMilliseconds / cases.length,
		averageHitMilliseconds: totalHitMilliseconds / cases.length,
		averageGainMilliseconds: totalGainMilliseconds / cases.length,
		bestGainMilliseconds,
		bestYear,
		totalByteLength,
	};
}

function normalizeYearSamples(
	beginYear: number,
	endYear: number,
	requestedYears?: readonly number[],
): number[] {
	if (requestedYears && requestedYears.length > 0) {
		return [...new Set(requestedYears)].sort((left, right) => left - right);
	}

	const years = [beginYear];
	if (endYear !== beginYear) {
		const midYear = Math.floor((beginYear + endYear) / 2);
		if (midYear !== beginYear && midYear !== endYear) {
			years.push(midYear);
		}
		years.push(endYear);
	}
	return years;
}
