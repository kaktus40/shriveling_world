import { type ComputeProfile } from '$lib/compute';
import { computeWorkspaceDataset, type WorkspaceComputeResult } from '$lib/application/workspace';
import type { WorkspaceDatasetSnapshot } from '$lib/application/workspace';

/** Input used by the operational app to refresh real computed geometry. */
export interface AppSceneComputeRequest {
	readonly year: number;
	readonly profile?: ComputeProfile;
	readonly forced?: ComputeProfile;
	readonly allowFallback?: boolean;
}

/**
 * Computes the real business layers consumed by the Babylon shell.
 *
 * The helper stays tiny on purpose: it delegates the heavy compute work to the
 * shared workspace orchestrator and only selects the operational defaults used
 * by the application surface.
 */
export async function loadAppSceneCompute(
	workspace: WorkspaceDatasetSnapshot,
	request: AppSceneComputeRequest,
): Promise<WorkspaceComputeResult> {
	return computeWorkspaceDataset(workspace, {
		profile: request.profile ?? 'webgpu',
		forced: request.forced,
		allowFallback: request.allowFallback ?? true,
		benchmark: true,
		dynamicYear: request.year,
		curve: {
			enabled: true,
			year: request.year,
			pointsPerCurve: 15,
			curvePosition: 'above',
			coefficient: 1,
		},
		coneIntersectionStrategy: 'alpha-aware-block-pruned',
	});
}
