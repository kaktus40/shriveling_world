import type { ComputeOptions } from './types';

/** Stage-level impact of changing one compute stack request. */
export interface ComputeInvalidation {
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
 * Compares two compute option sets and marks the stages that need rerunning.
 *
 * The prepared dataset is not invalidated here: dataset ingestion remains a
 * separate concern from compute orchestration.
 */
export function diffComputeOptions(
	previous: ComputeOptions,
	next: ComputeOptions,
): ComputeInvalidation {
	const boundary = previous.boundaryRaycast?.azimuthSampleCount !== next.boundaryRaycast?.azimuthSampleCount;
		previous.boundaryRaycast?.interiorPointSpacingRadians !== next.boundaryRaycast?.interiorPointSpacingRadians ||
	const staticTown =
		previous.staticTown?.neighborLimit !== next.staticTown?.neighborLimit ||
		previous.staticTown?.sectorCount !== next.staticTown?.sectorCount;
	const dynamicTown = previous.dynamicYear !== next.dynamicYear;
	const projection = diffProjectionOptions(previous, next);
	const rawCones =
		dynamicTown ||
		previous.rawCone?.shape !== next.rawCone?.shape ||
		previous.rawCone?.azimuthSampleCount !== next.rawCone?.azimuthSampleCount ||
		previous.rawCone?.coneLengthMeters !== next.rawCone?.coneLengthMeters ||
		previous.rawCone?.attenuationRadians !== next.rawCone?.attenuationRadians;
	const coneIntersections = rawCones || diffConeIntersectionStrategy(previous, next);
	const finalCones = boundary || coneIntersections || projection;
	const curveGeometry =
		previous.curve?.enabled !== next.curve?.enabled ||
		previous.curve?.year !== next.curve?.year ||
		previous.curve?.pointsPerCurve !== next.curve?.pointsPerCurve ||
		previous.curve?.curvePosition !== next.curve?.curvePosition ||
		previous.curve?.coefficient !== next.curve?.coefficient ||
		projection;

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

function diffProjectionOptions(previous: ComputeOptions, next: ComputeOptions): boolean {
	const previousProjection = previous.projection;
	const nextProjection = next.projection;
	if (previousProjection?.start !== nextProjection?.start) {
		return true;
	}
	if (previousProjection?.end !== nextProjection?.end) {
		return true;
	}
	if (previousProjection?.percent !== nextProjection?.percent) {
		return true;
	}
	const previousSettings = previousProjection?.settings;
	const nextSettings = nextProjection?.settings;
	return (
		previousSettings?.globeRadius !== nextSettings?.globeRadius ||
		previousSettings?.referenceLongitudeRadians !== nextSettings?.referenceLongitudeRadians ||
		previousSettings?.referenceLatitudeRadians !== nextSettings?.referenceLatitudeRadians ||
		previousSettings?.referenceHeightMeters !== nextSettings?.referenceHeightMeters ||
		previousSettings?.standardParallel1Radians !== nextSettings?.standardParallel1Radians ||
		previousSettings?.standardParallel2Radians !== nextSettings?.standardParallel2Radians ||
		previousSettings?.zCoefficient !== nextSettings?.zCoefficient
	);
}

function diffConeIntersectionStrategy(
	previous: ComputeOptions,
	next: ComputeOptions,
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
