import type { ComputeProfile } from './backend';
import {
	computeCityInvariantsCpu,
	computeCityPairInvariantsCpu,
	computeStaticTownInvariantsCpu,
} from './static-town-cpu';
import type { CityPairPrecomputeOptions, StaticCityInput } from './types';

/** Stable names used to compare equivalent compute phases across backends. */
export type StaticTownBenchmarkPhase = 'city-invariants' | 'city-pair-invariants' | 'total';

/** Clock source returning a monotonic duration value in milliseconds. */
export type BenchmarkClock = () => number;

/** Options controlling repeatable compute benchmarks. */
export interface ComputeBenchmarkOptions {
	/** Number of unmeasured executions used to warm up the runtime. */
	warmupIterations?: number;
	/** Number of measured executions retained in the report. */
	measurementIterations?: number;
	/** Injectable monotonic clock, primarily used by deterministic tests. */
	clock?: BenchmarkClock;
}

/** Descriptive statistics for one measured phase and timing scope. */
export interface ComputeBenchmarkStatistics {
	/** Fastest measured execution, in milliseconds. */
	minMilliseconds: number;
	/** Median measured execution, in milliseconds. */
	medianMilliseconds: number;
	/** 95th percentile measured execution, in milliseconds. */
	p95Milliseconds: number;
	/** Slowest measured execution, in milliseconds. */
	maxMilliseconds: number;
}

/** Measurement of one equivalent compute phase. */
export interface ComputePhaseBenchmark {
	/** Stable phase name shared by every backend. */
	phase: StaticTownBenchmarkPhase;
	/** End-to-end duration observed by the application. */
	wallClock: ComputeBenchmarkStatistics;
	/**
	 * Device-only GPU duration when timestamp queries are available.
	 *
	 * CPU reports and unsupported GPU environments leave this value undefined.
	 */
	device?: ComputeBenchmarkStatistics;
}

/** Comparable benchmark report emitted by one compute profile. */
export interface StaticTownBenchmarkReport {
	/** Backend profile that produced the report. */
	profile: ComputeProfile;
	/** City count used by the benchmark. */
	cityCount: number;
	/** Number of measured executions per phase. */
	measurementIterations: number;
	/** Measurements ordered from individual phases to total execution. */
	phases: ComputePhaseBenchmark[];
}

/**
 * Benchmarks the currently implemented CPU static-town phases.
 *
 * Pair timing reuses precomputed city matrices so it measures only the pair
 * phase. Total timing includes both phases and their intermediate allocations.
 */
export function benchmarkStaticTownInvariantsCpu(
	input: StaticCityInput,
	options: CityPairPrecomputeOptions,
	benchmarkOptions: ComputeBenchmarkOptions = {},
): StaticTownBenchmarkReport {
	const warmupIterations = normalizeIterationCount(benchmarkOptions.warmupIterations ?? 2, 'warmupIterations', true);
	const measurementIterations = normalizeIterationCount(
		benchmarkOptions.measurementIterations ?? 10,
		'measurementIterations',
		false,
	);
	const clock = benchmarkOptions.clock ?? (() => performance.now());
	const cityInvariants = computeCityInvariantsCpu(input);

	const phases: ComputePhaseBenchmark[] = [
		measureCpuPhase('city-invariants', warmupIterations, measurementIterations, clock, () => {
			computeCityInvariantsCpu(input);
		}),
		measureCpuPhase('city-pair-invariants', warmupIterations, measurementIterations, clock, () => {
			computeCityPairInvariantsCpu(cityInvariants, options);
		}),
		measureCpuPhase('total', warmupIterations, measurementIterations, clock, () => {
			computeStaticTownInvariantsCpu(input, options);
		}),
	];

	return {
		profile: 'cpu',
		cityCount: cityInvariants.cityCount,
		measurementIterations,
		phases,
	};
}

function measureCpuPhase(
	phase: StaticTownBenchmarkPhase,
	warmupIterations: number,
	measurementIterations: number,
	clock: BenchmarkClock,
	execute: () => void,
): ComputePhaseBenchmark {
	for (let iteration = 0; iteration < warmupIterations; iteration += 1) {
		execute();
	}

	const samples: number[] = [];
	for (let iteration = 0; iteration < measurementIterations; iteration += 1) {
		const beginMilliseconds = clock();
		execute();
		samples.push(clock() - beginMilliseconds);
	}

	return { phase, wallClock: summarizeBenchmarkSamples(samples) };
}

/** Summarizes non-negative duration samples in milliseconds. */
export function summarizeBenchmarkSamples(samples: readonly number[]): ComputeBenchmarkStatistics {
	if (samples.length === 0 || samples.some((sample) => !Number.isFinite(sample) || sample < 0)) {
		throw new RangeError('benchmark samples must contain finite non-negative durations');
	}

	const sorted = [...samples].sort((a, b) => a - b);
	return {
		minMilliseconds: sorted[0],
		medianMilliseconds: percentile(sorted, 0.5),
		p95Milliseconds: percentile(sorted, 0.95),
		maxMilliseconds: sorted[sorted.length - 1],
	};
}

function percentile(sortedSamples: readonly number[], ratio: number): number {
	const index = Math.ceil(ratio * sortedSamples.length) - 1;
	return sortedSamples[Math.max(0, index)];
}

function normalizeIterationCount(value: number, name: string, allowZero: boolean): number {
	if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
		throw new RangeError(`${name} must be ${allowZero ? 'a non-negative' : 'a strictly positive'} safe integer`);
	}
	return value;
}
