import {
	computeConeIntersectionAlphaAwareBlockPrunedCpu,
	computeConeIntersectionAlphaAwareOrderCpu,
	computeConeIntersectionOracleCpu,
	computeConeIntersectionSymmetricOrderCpu,
	type AlphaAwareBlockPrunedConeIntersectionOptions,
	type AlphaAwareConeIntersectionOptions,
	type ConeIntersectionOraclePrecompute,
	type DynamicTownPrecompute,
	type RawConePrecompute,
	type StaticTownPrecompute,
	type SymmetricConeIntersectionStaticInput,
} from '../../domain/precompute';
import type { ComputeConeIntersectionStrategy, ComputeOptions } from '../core';

/** Computes the CPU cone-intersection stage for one workspace snapshot. */
export function runCpuConeIntersectionStage(
	staticTown: StaticTownPrecompute,
	rawCones: RawConePrecompute,
	dynamicTown: DynamicTownPrecompute,
	strategy: ComputeConeIntersectionStrategy,
	options?: ComputeOptions['coneIntersection'],
): ConeIntersectionOraclePrecompute {
	switch (strategy) {
		case 'oracle':
			return computeConeIntersectionOracleCpu(staticTown, rawCones);
		case 'symmetric-order':
			return computeConeIntersectionSymmetricOrderCpu(staticTown as SymmetricConeIntersectionStaticInput, rawCones);
		case 'alpha-aware-order': {
			const alphaAwareOptions = resolveAlphaAwareConeIntersectionOptions(dynamicTown, rawCones, options);
			return computeConeIntersectionAlphaAwareOrderCpu(
				staticTown as SymmetricConeIntersectionStaticInput,
				rawCones,
				alphaAwareOptions,
			);
		}
		case 'alpha-aware-block-pruned': {
			const alphaAwareOptions = resolveAlphaAwareBlockPrunedConeIntersectionOptions(dynamicTown, rawCones, options);
			return computeConeIntersectionAlphaAwareBlockPrunedCpu(
				staticTown as SymmetricConeIntersectionStaticInput,
				rawCones,
				alphaAwareOptions,
			);
		}
		default:
			return computeConeIntersectionOracleCpu(staticTown, rawCones);
	}
}

function resolveAlphaAwareConeIntersectionOptions(
	dynamicTown: DynamicTownPrecompute,
	rawCones: RawConePrecompute,
	override?: ComputeOptions['coneIntersection'],
): AlphaAwareConeIntersectionOptions {
	return {
		roadAlphaRadians: dynamicTown.roadAlphaRadians,
		bilateralNeighborhoodFaceCount:
			override?.alphaAware?.bilateralNeighborhoodFaceCount ?? Math.min(Math.max(rawCones.azimuthSampleCount, 1), 8),
		alphaEpsilonRadians: override?.alphaAware?.alphaEpsilonRadians,
	};
}

function resolveAlphaAwareBlockPrunedConeIntersectionOptions(
	dynamicTown: DynamicTownPrecompute,
	rawCones: RawConePrecompute,
	override?: ComputeOptions['coneIntersection'],
): AlphaAwareBlockPrunedConeIntersectionOptions {
	return {
		...resolveAlphaAwareConeIntersectionOptions(dynamicTown, rawCones, override),
		blockFaceCount: override?.alphaAware?.blockFaceCount ?? Math.min(Math.max(rawCones.azimuthSampleCount, 1), 4),
		pruningEnabled: override?.alphaAware?.pruningEnabled,
	};
}
