import type { WorkspacePrecomputeRequest } from './precompute';

/** Stage-level impact of changing one workspace precompute request. */
export interface WorkspacePrecomputeInvalidation {
	readonly preparedDataset: false;
	readonly boundary: boolean;
	readonly staticTown: boolean;
	readonly dynamicTown: boolean;
	readonly rawCones: boolean;
	readonly coneIntersections: boolean;
	readonly finalCones: boolean;
}

/**
 * Compares two workspace precompute requests and marks the impacted stages.
 *
 * The prepared dataset itself is never invalidated by request changes here.
 * Dataset-level invalidation remains a separate concern handled at ingestion.
 */
export function diffWorkspacePrecomputeRequest(
	previous: WorkspacePrecomputeRequest,
	next: WorkspacePrecomputeRequest,
): WorkspacePrecomputeInvalidation {
	const boundary = previous.boundaryAzimuthSampleCount !== next.boundaryAzimuthSampleCount;
	const staticTown =
		previous.neighborLimit !== next.neighborLimit ||
		previous.sectorCount !== next.sectorCount;
	const dynamicTown = previous.year !== next.year;
	const rawCones =
		dynamicTown ||
		previous.shape !== next.shape ||
		previous.azimuthSampleCount !== next.azimuthSampleCount ||
		previous.coneLengthMeters !== next.coneLengthMeters ||
		previous.attenuationRadians !== next.attenuationRadians;
	const coneIntersections = rawCones;
	const finalCones = boundary || coneIntersections;

	return {
		preparedDataset: false,
		boundary,
		staticTown,
		dynamicTown,
		rawCones,
		coneIntersections,
		finalCones,
	};
}
