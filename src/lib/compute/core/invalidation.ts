import type { ComputeWorkflowOptions } from './types';

/** Stage-level impact of changing one compute workflow request. */
export interface ComputeWorkflowInvalidation {
	readonly preparedDataset: false;
	readonly boundary: boolean;
	readonly staticTown: boolean;
	readonly dynamicTown: boolean;
	readonly rawCones: boolean;
	readonly coneIntersections: boolean;
	readonly finalCones: boolean;
	readonly curveGeometry: boolean;
}

/**
 * Compares two workflow option sets and marks the stages that need rerunning.
 *
 * The prepared dataset is not invalidated here: dataset ingestion remains a
 * separate concern from compute orchestration.
 */
export function diffComputeWorkflowOptions(
	previous: ComputeWorkflowOptions,
	next: ComputeWorkflowOptions,
): ComputeWorkflowInvalidation {
	const boundary = previous.boundaryRaycast?.azimuthSampleCount !== next.boundaryRaycast?.azimuthSampleCount;
	const staticTown =
		previous.staticTown?.neighborLimit !== next.staticTown?.neighborLimit ||
		previous.staticTown?.sectorCount !== next.staticTown?.sectorCount;
	const dynamicTown = previous.dynamicYear !== next.dynamicYear;
	const rawCones =
		dynamicTown ||
		previous.rawCone?.shape !== next.rawCone?.shape ||
		previous.rawCone?.azimuthSampleCount !== next.rawCone?.azimuthSampleCount ||
		previous.rawCone?.coneLengthMeters !== next.rawCone?.coneLengthMeters ||
		previous.rawCone?.attenuationRadians !== next.rawCone?.attenuationRadians;
	const coneIntersections = rawCones || diffConeIntersectionStrategy(previous, next);
	const finalCones = boundary || coneIntersections;
	const curveGeometry =
		previous.curve?.enabled !== next.curve?.enabled ||
		previous.curve?.year !== next.curve?.year ||
		previous.curve?.pointsPerCurve !== next.curve?.pointsPerCurve ||
		previous.curve?.curvePosition !== next.curve?.curvePosition ||
		previous.curve?.coefficient !== next.curve?.coefficient;

	return {
		preparedDataset: false,
		boundary,
		staticTown,
		dynamicTown,
		rawCones,
		coneIntersections,
		finalCones,
		curveGeometry,
	};
}

function diffConeIntersectionStrategy(
	previous: ComputeWorkflowOptions,
	next: ComputeWorkflowOptions,
): boolean {
	const previousStrategy = previous.coneIntersection?.strategy;
	const nextStrategy = next.coneIntersection?.strategy;
	if (previousStrategy !== nextStrategy) {
		return true;
	}
	const previousAlphaAware = previous.coneIntersection?.alphaAware;
	const nextAlphaAware = next.coneIntersection?.alphaAware;
	return (
		previousAlphaAware?.blockFaceCount !== nextAlphaAware?.blockFaceCount ||
		previousAlphaAware?.pruningEnabled !== nextAlphaAware?.pruningEnabled ||
		previousAlphaAware?.bilateralNeighborhoodFaceCount !== nextAlphaAware?.bilateralNeighborhoodFaceCount
	);
}
