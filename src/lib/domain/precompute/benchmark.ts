import type { ComputeProfile } from './backend';
import {
	computeCityInvariantsCpu,
	computeCityPairInvariantsCpu,
	computeStaticTownPrecomputeCpu,
} from './static-town-cpu';
import { selectOverlapCandidatesCpu } from './overlap-cpu';
import { computeCurveControlPointsCpu } from './curve-cpu';
import type { StaticTownInput, StaticTownPrecomputeOptions } from './types';
import type { PreparedDataset } from '../data';
import type { StaticTownPrecompute } from './types';
import {
	computeDynamicTownPrecomputeByYearCpu,
	computeDynamicTownPrecomputeForYearCpu,
} from './dynamic-town-cpu';
import { computeConeAlphaSamplesCpu, computeRawConePrecomputeCpu } from './raw-cone-cpu';
import { computeConeIntersectionOracleCpu, computeConeIntersectionSymmetricOrderCpu } from './cone-intersection-cpu';
import type {
	ConeIntersectionStaticInput,
	DynamicTownPrecompute,
	RawConePrecompute,
	RawConePrecomputeOptions,
	SymmetricConeIntersectionStaticInput,
} from './types';

/** Stable names used to compare equivalent compute phases across backends. */
export type StaticTownBenchmarkPhase =
	| 'city-invariants'
	| 'city-pair-invariants'
	| 'overlap-reduction'
	| 'curve-controls'
	| 'total';

/** Stable dynamic phases used to compare yearly and complete-span costs. */
export type DynamicTownBenchmarkPhase = 'dynamic-year' | 'dynamic-all-years';

/** Stable raw-cone phases used to compare directional and geometric costs. */
export type RawConeBenchmarkPhase = 'raw-cone-alphas' | 'raw-cone-total';

/** Stable cone-intersection phases used to compare oracle and accelerations. */
export type ConeIntersectionBenchmarkPhase = 'cone-intersection-exhaustive' | 'cone-intersection-symmetric-order';

/** Stable phase names shared by current and future compute backends. */
export type ComputeBenchmarkPhase =
	| StaticTownBenchmarkPhase
	| DynamicTownBenchmarkPhase
	| RawConeBenchmarkPhase
	| ConeIntersectionBenchmarkPhase;

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
	phase: ComputeBenchmarkPhase;
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

/** Comparable dynamic-town benchmark report emitted by one compute profile. */
export interface DynamicTownBenchmarkReport {
	/** Backend profile that produced the report. */
	profile: ComputeProfile;
	/** City count used by the benchmark. */
	cityCount: number;
	/** Edge count evaluated by the benchmark. */
	edgeCount: number;
	/** Representative year measured independently. */
	year: number;
	/** Number of measured executions per phase. */
	measurementIterations: number;
	/** Per-year and complete-span measurements. */
	phases: ComputePhaseBenchmark[];
}

/** Comparable raw-cone benchmark report emitted by one compute profile. */
export interface RawConeBenchmarkReport {
	/** Backend profile that produced the report. */
	profile: ComputeProfile;
	/** City count used by the benchmark. */
	cityCount: number;
	/** Number of uniformly spaced azimuth samples per city. */
	azimuthSampleCount: number;
	/** Number of measured executions per phase. */
	measurementIterations: number;
	/** Directional-alpha and complete-geometry measurements. */
	phases: ComputePhaseBenchmark[];
}

/** Comparable report for one cone-intersection strategy. */
export interface ConeIntersectionBenchmarkReport {
	/** Backend profile that produced the report. */
	profile: ComputeProfile;
	/** City count used by the benchmark. */
	cityCount: number;
	/** Number of uniformly spaced azimuth samples per city. */
	azimuthSampleCount: number;
	/** Total number of neighbor faces tested by one execution. */
	testedFaceCount: number;
	/** Discovery-order statistics for final winning faces, when available. */
	winningFaceVisitOrder?: ConeIntersectionVisitOrderStatistics;
	/** Number of measured executions. */
	measurementIterations: number;
	/** Intersection strategy measurements. */
	phases: ComputePhaseBenchmark[];
}

/** Distribution of one-based final winning-face visit orders. */
export interface ConeIntersectionVisitOrderStatistics {
	/** Number of rays for which a cone intersection was found. */
	intersectionCount: number;
	/** Arithmetic mean visit order. */
	mean: number;
	/** 95th percentile visit order. */
	p95: number;
	/** Latest observed visit order. */
	max: number;
}

/**
 * Benchmarks the currently implemented CPU static-town phases.
 *
 * Pair timing reuses precomputed city matrices so it measures only the pair
 * phase. Total timing includes both phases and their intermediate allocations.
 */
export function benchmarkStaticTownInvariantsCpu(
	input: StaticTownInput,
	options: StaticTownPrecomputeOptions,
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
	const pairInvariants = computeCityPairInvariantsCpu(cityInvariants, options);

	const phases: ComputePhaseBenchmark[] = [
		measureCpuPhase('city-invariants', warmupIterations, measurementIterations, clock, () => {
			computeCityInvariantsCpu(input);
		}),
		measureCpuPhase('city-pair-invariants', warmupIterations, measurementIterations, clock, () => {
			computeCityPairInvariantsCpu(cityInvariants, options);
		}),
		measureCpuPhase('overlap-reduction', warmupIterations, measurementIterations, clock, () => {
			selectOverlapCandidatesCpu(pairInvariants, options.neighborLimit);
		}),
		measureCpuPhase('curve-controls', warmupIterations, measurementIterations, clock, () => {
			computeCurveControlPointsCpu(cityInvariants, input.curveEdgePairs ?? new Uint32Array());
		}),
		measureCpuPhase('total', warmupIterations, measurementIterations, clock, () => {
			computeStaticTownPrecomputeCpu(input, options);
		}),
	];

	return {
		profile: 'cpu',
		cityCount: cityInvariants.cityCount,
		measurementIterations,
		phases,
	};
}

/** Benchmarks one dynamic year and the complete prepared historical span. */
export function benchmarkDynamicTownPrecomputeCpu(
	dataset: PreparedDataset,
	staticTown: StaticTownPrecompute,
	year = dataset.speedTimeline.span.beginYear,
	benchmarkOptions: ComputeBenchmarkOptions = {},
): DynamicTownBenchmarkReport {
	const warmupIterations = normalizeIterationCount(benchmarkOptions.warmupIterations ?? 2, 'warmupIterations', true);
	const measurementIterations = normalizeIterationCount(
		benchmarkOptions.measurementIterations ?? 10,
		'measurementIterations',
		false,
	);
	const clock = benchmarkOptions.clock ?? (() => performance.now());
	const phases: ComputePhaseBenchmark[] = [
		measureCpuPhase('dynamic-year', warmupIterations, measurementIterations, clock, () => {
			computeDynamicTownPrecomputeForYearCpu(dataset, staticTown, year);
		}),
		measureCpuPhase('dynamic-all-years', warmupIterations, measurementIterations, clock, () => {
			computeDynamicTownPrecomputeByYearCpu(dataset, staticTown);
		}),
	];

	return {
		profile: 'cpu',
		cityCount: dataset.cityCount,
		edgeCount: dataset.edgeCount,
		year,
		measurementIterations,
		phases,
	};
}

/** Benchmarks directional alpha selection and complete raw cone generation. */
export function benchmarkRawConePrecomputeCpu(
	staticTown: StaticTownPrecompute,
	dynamicTown: DynamicTownPrecompute,
	options: RawConePrecomputeOptions,
	benchmarkOptions: ComputeBenchmarkOptions = {},
): RawConeBenchmarkReport {
	const warmupIterations = normalizeIterationCount(benchmarkOptions.warmupIterations ?? 2, 'warmupIterations', true);
	const measurementIterations = normalizeIterationCount(
		benchmarkOptions.measurementIterations ?? 10,
		'measurementIterations',
		false,
	);
	const clock = benchmarkOptions.clock ?? (() => performance.now());
	const phases: ComputePhaseBenchmark[] = [
		measureCpuPhase('raw-cone-alphas', warmupIterations, measurementIterations, clock, () => {
			computeConeAlphaSamplesCpu(dynamicTown, options);
		}),
		measureCpuPhase('raw-cone-total', warmupIterations, measurementIterations, clock, () => {
			computeRawConePrecomputeCpu(staticTown, dynamicTown, options);
		}),
	];

	return {
		profile: 'cpu',
		cityCount: staticTown.cityCount,
		azimuthSampleCount: options.azimuthSampleCount,
		measurementIterations,
		phases,
	};
}

/** Benchmarks the exhaustive CPU cone-intersection conformity oracle. */
export function benchmarkConeIntersectionOracleCpu(
	staticInput: ConeIntersectionStaticInput,
	rawCones: RawConePrecompute,
	benchmarkOptions: ComputeBenchmarkOptions = {},
): ConeIntersectionBenchmarkReport {
	const warmupIterations = normalizeIterationCount(benchmarkOptions.warmupIterations ?? 2, 'warmupIterations', true);
	const measurementIterations = normalizeIterationCount(
		benchmarkOptions.measurementIterations ?? 10,
		'measurementIterations',
		false,
	);
	const clock = benchmarkOptions.clock ?? (() => performance.now());
	const reference = computeConeIntersectionOracleCpu(staticInput, rawCones);
	const phases = [
		measureCpuPhase('cone-intersection-exhaustive', warmupIterations, measurementIterations, clock, () => {
			computeConeIntersectionOracleCpu(staticInput, rawCones);
		}),
	];

	return {
		profile: 'cpu',
		cityCount: rawCones.cityCount,
		azimuthSampleCount: rawCones.azimuthSampleCount,
		testedFaceCount: reference.testedFaceCounts.reduce((sum, count) => sum + count, 0),
		measurementIterations,
		phases,
	};
}

/** Benchmarks exhaustive face tests ordered by the symmetric-ray heuristic. */
export function benchmarkConeIntersectionSymmetricOrderCpu(
	staticInput: SymmetricConeIntersectionStaticInput,
	rawCones: RawConePrecompute,
	benchmarkOptions: ComputeBenchmarkOptions = {},
): ConeIntersectionBenchmarkReport {
	const warmupIterations = normalizeIterationCount(benchmarkOptions.warmupIterations ?? 2, 'warmupIterations', true);
	const measurementIterations = normalizeIterationCount(
		benchmarkOptions.measurementIterations ?? 10,
		'measurementIterations',
		false,
	);
	const clock = benchmarkOptions.clock ?? (() => performance.now());
	const reference = computeConeIntersectionSymmetricOrderCpu(staticInput, rawCones);
	const winningOrders = Array.from(reference.winningFaceVisitOrders).filter((order) => order !== 0xffffffff);
	const phases = [
		measureCpuPhase('cone-intersection-symmetric-order', warmupIterations, measurementIterations, clock, () => {
			computeConeIntersectionSymmetricOrderCpu(staticInput, rawCones);
		}),
	];

	return {
		profile: 'cpu',
		cityCount: rawCones.cityCount,
		azimuthSampleCount: rawCones.azimuthSampleCount,
		testedFaceCount: reference.testedFaceCounts.reduce((sum, count) => sum + count, 0),
		winningFaceVisitOrder: summarizeVisitOrders(winningOrders),
		measurementIterations,
		phases,
	};
}

function measureCpuPhase(
	phase: ComputeBenchmarkPhase,
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

function summarizeVisitOrders(orders: readonly number[]): ConeIntersectionVisitOrderStatistics | undefined {
	if (orders.length === 0) {
		return undefined;
	}
	const sorted = [...orders].sort((a, b) => a - b);
	return {
		intersectionCount: sorted.length,
		mean: sorted.reduce((sum, order) => sum + order, 0) / sorted.length,
		p95: percentile(sorted, 0.95),
		max: sorted[sorted.length - 1],
	};
}

function normalizeIterationCount(value: number, name: string, allowZero: boolean): number {
	if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
		throw new RangeError(`${name} must be ${allowZero ? 'a non-negative' : 'a strictly positive'} safe integer`);
	}
	return value;
}
