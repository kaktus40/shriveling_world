import type { ComputeBenchmarkReport, StageTiming } from '../core';

/** Merges extra timings into a backend benchmark while forcing the selected profile. */
export function remapBenchmarkProfile(
	benchmark: ComputeBenchmarkReport,
	profile: 'webgl2' | 'webgpu',
	extraTimings: readonly StageTiming[],
	notes: readonly string[],
): ComputeBenchmarkReport {
	const timings = [...benchmark.timings, ...extraTimings];
	return {
		...benchmark,
		profile,
		timings: timings.map((timing) => ({
			...timing,
			profile,
		})),
		totalDurationMs: benchmark.totalDurationMs + extraTimings.reduce((sum, timing) => sum + timing.durationMs, 0),
		notes: [...benchmark.notes, ...notes],
	};
}

/** Ensures diagnostics are tagged with the active profile. */
export function tagDiagnostics<T extends { severity: 'warning' | 'error'; code: string; profile?: string }>(
	diagnostics: readonly T[],
	profile: string,
): T[] {
	return diagnostics.map((diagnostic) =>
		diagnostic.profile === profile ? diagnostic : { ...diagnostic, profile },
	);
}

/** Returns a stable GPU buffer usage snapshot that works across runtime profiles. */
export function getGpuBufferUsage(): {
	readonly STORAGE: number;
	readonly COPY_DST: number;
	readonly COPY_SRC: number;
	readonly UNIFORM: number;
	readonly MAP_READ: number;
} {
	const usage = (globalThis as typeof globalThis & {
		GPUBufferUsage?: {
			STORAGE: number;
			COPY_DST: number;
			COPY_SRC: number;
			UNIFORM: number;
			MAP_READ: number;
		};
	}).GPUBufferUsage;
	return (
		usage ?? {
			STORAGE: 1 << 7,
			COPY_DST: 1 << 3,
			COPY_SRC: 1 << 1,
			UNIFORM: 1 << 6,
			MAP_READ: 1 << 0,
		}
	);
}
