import type { ComputeProfile, ComputeStage, ComputeStageScope, StageTiming } from './types';

/** Returns the best monotonic clock available in the current runtime. */
export function nowMilliseconds(): number {
	if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
		return performance.now();
	}
	return Date.now();
}

/** Measures one compute stage and returns its timing. */
export function measureStage<T>(
	stage: ComputeStage,
	scope: ComputeStageScope,
	profile: ComputeProfile,
	compute: () => T,
	clock: () => number = nowMilliseconds,
): { value: T; timing: StageTiming } {
	const startedAtMs = clock();
	const value = compute();
	const endedAtMs = clock();
	return {
		value,
		timing: {
			stage,
			scope,
			profile,
			startedAtMs,
			endedAtMs,
			durationMs: endedAtMs - startedAtMs,
		},
	};
}

/** Measures one async compute stage and returns its timing. */
export async function measureAsyncStage<T>(
	stage: ComputeStage,
	scope: ComputeStageScope,
	profile: ComputeProfile,
	compute: () => Promise<T>,
	clock: () => number = nowMilliseconds,
): Promise<{ value: T; timing: StageTiming }> {
	const startedAtMs = clock();
	const value = await compute();
	const endedAtMs = clock();
	return {
		value,
		timing: {
			stage,
			scope,
			profile,
			startedAtMs,
			endedAtMs,
			durationMs: endedAtMs - startedAtMs,
		},
	};
}

/** Aggregates a stage list into a total benchmark duration. */
export function sumStageDurations(timings: readonly StageTiming[]): number {
	return timings.reduce((sum, timing) => sum + timing.durationMs, 0);
}
