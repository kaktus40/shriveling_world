import type { StaticTownInput, StaticTownPrecompute, StaticTownPrecomputeOptions } from './types';
import { computeStaticTownPrecomputeCpu } from './cpu';
import { benchmarkStaticTownInvariantsCpu } from './benchmark';
import type { ComputeBenchmarkOptions, StaticTownBenchmarkReport } from './benchmark';

/** Available static-town compute profiles, ordered independently from fallback priority. */
export type ComputeProfile = 'cpu' | 'webgl2' | 'webgpu';

/**
 * Compute backend producing the common static-town invariant buffer contract.
 *
 * WebGPU is the preferred production profile, WebGL2 is its accelerated
 * fallback, and CPU is the final fallback and conformance oracle.
 */
export interface StaticTownInvariantBackend {
	/** Profile implemented by this backend. */
	readonly profile: ComputeProfile;
	/** Computes static city and ordered-pair invariant buffers. */
	compute(input: StaticTownInput, options: StaticTownPrecomputeOptions): Promise<StaticTownPrecompute>;
	/** Benchmarks every implemented phase and the complete backend pipeline. */
	benchmark(
		input: StaticTownInput,
		options: StaticTownPrecomputeOptions,
		benchmarkOptions?: ComputeBenchmarkOptions,
	): Promise<StaticTownBenchmarkReport>;
}

/** CPU reference backend and final fallback in the compute profile chain. */
export class CpuStaticTownInvariantBackend implements StaticTownInvariantBackend {
	readonly profile = 'cpu' as const;

	async compute(input: StaticTownInput, options: StaticTownPrecomputeOptions): Promise<StaticTownPrecompute> {
		return computeStaticTownPrecomputeCpu(input, options);
	}

	async benchmark(
		input: StaticTownInput,
		options: StaticTownPrecomputeOptions,
		benchmarkOptions?: ComputeBenchmarkOptions,
	): Promise<StaticTownBenchmarkReport> {
		return benchmarkStaticTownInvariantsCpu(input, options, benchmarkOptions);
	}
}

/**
 * Returns the preferred profile fallback chain.
 *
 * An orchestrator must select the first available and successfully initialized
 * backend. Runtime execution errors may trigger the next profile after
 * releasing resources owned by the failed backend.
 */
export function getComputeProfileFallbackChain(preferredProfile: ComputeProfile = 'webgpu'): readonly ComputeProfile[] {
	switch (preferredProfile) {
		case 'webgpu':
			return ['webgpu', 'webgl2', 'cpu'];
		case 'webgl2':
			return ['webgl2', 'cpu'];
		case 'cpu':
			return ['cpu'];
	}
}
