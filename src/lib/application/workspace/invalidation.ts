import {
	type ComputeWorkflowOptions,
	diffComputeWorkflowOptions,
} from '$lib/compute';
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
	readonly curveGeometry: boolean;
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
	const previousWorkflow = toWorkspaceComputeOptions(previous);
	const nextWorkflow = toWorkspaceComputeOptions(next);
	const invalidation = diffComputeWorkflowOptions(previousWorkflow, nextWorkflow);

	return {
		preparedDataset: false,
		boundary: invalidation.boundary,
		staticTown: invalidation.staticTown,
		dynamicTown: invalidation.dynamicTown,
		rawCones: invalidation.rawCones,
		coneIntersections: invalidation.coneIntersections,
		finalCones: invalidation.finalCones,
		curveGeometry: invalidation.curveGeometry,
	};
}

function toWorkspaceComputeOptions(request: WorkspacePrecomputeRequest): ComputeWorkflowOptions {
	return {
		boundaryRaycast: {
			azimuthSampleCount: request.boundaryAzimuthSampleCount ?? 360,
		},
		staticTown: {
			sectorCount: request.sectorCount ?? 360,
			neighborLimit: request.neighborLimit ?? 16,
		},
		dynamicYear: request.year ?? 0,
		rawCone: {
			shape: request.shape ?? 'complex',
			azimuthSampleCount: request.azimuthSampleCount ?? 360,
			coneLengthMeters: request.coneLengthMeters ?? 1,
			attenuationRadians: request.attenuationRadians ?? Math.PI / 6,
		},
	};
}
