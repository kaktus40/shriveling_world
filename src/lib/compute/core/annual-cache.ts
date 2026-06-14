import type { SourceFile } from '$lib/domain/data';
import {
	type CurvePrecompute,
	type DynamicTownPrecomputeByYear,
	type StaticTownPrecompute,
	prepareCurvePrecompute,
	computeDynamicTownPrecomputeByYearCpu,
} from '$lib/domain/precompute';
import type { PreparedDataset } from '$lib/domain/data';
import type { StaticTownPrecomputeOptions } from '$lib/domain/precompute';

/** Cache of year-dependent precompute inputs shared by compute backends. */
export interface ComputeAnnualCache {
	readonly dynamicTownByYear: DynamicTownPrecomputeByYear;
	readonly curvePrecompute: CurvePrecompute;
}

/** Hashable inputs used to build a reusable annual cache key. */
export interface ComputeAnnualCacheKeyInput {
	readonly sourceFiles: readonly SourceFile[];
	readonly staticTown?: Partial<StaticTownPrecomputeOptions>;
}

/**
 * Builds the reusable annual cache for a prepared dataset and static-town
 * snapshot.
 */
export function createComputeAnnualCache(
	preparedDataset: PreparedDataset,
	staticTown: StaticTownPrecompute,
): ComputeAnnualCache {
	return {
		dynamicTownByYear: computeDynamicTownPrecomputeByYearCpu(preparedDataset, staticTown),
		curvePrecompute: prepareCurvePrecompute(preparedDataset, staticTown),
	};
}

/** Creates a stable signature for cache reuse across successive recomputations. */
export function createComputeAnnualCacheKey(input: ComputeAnnualCacheKeyInput): string {
	const parts: string[] = [];
	const staticTown = input.staticTown ?? {};
	parts.push(`sectorCount:${staticTown.sectorCount ?? 'default'}`);
	parts.push(`neighborLimit:${staticTown.neighborLimit ?? 'default'}`);
	for (const file of input.sourceFiles) {
		parts.push(file.name);
		parts.push(String(file.text.length));
		parts.push(String(hashText(file.text)));
	}
	return parts.join('|');
}

function hashText(text: string): number {
	let hash = 2166136261;
	for (let index = 0; index < text.length; index += 1) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}
