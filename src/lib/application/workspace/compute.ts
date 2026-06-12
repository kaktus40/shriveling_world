import {
	createDefaultComputeBackendRegistry,
	createWebGl2ComputeBackendDescriptor,
	createWebGpuComputeBackendDescriptor,
	createComputeOrchestrator,
	type ComputeBenchmarkReport,
	type ComputeConeIntersectionStrategy,
	type ComputeProfile,
	type ComputeProfileSelection,
	type ComputeBackendRegistry,
	type ComputeResult,
} from '$lib/compute';
import { createDefaultConePipelineOptions } from '$lib/application/validation';
import type { WorkspaceDatasetSnapshot } from './catalog';

/** Compute profile and benchmark exposed by the dataset workspace. */
export interface WorkspaceComputeResult {
	selection: ComputeProfileSelection;
	benchmark: ComputeBenchmarkReport;
	result: ComputeResult;
}

/** Profile request supported by the workspace compute preview. */
export interface WorkspaceComputeRequest {
	profile?: ComputeProfile;
	forced?: ComputeProfile;
	allowFallback?: boolean;
	benchmark?: boolean;
	coneIntersectionStrategy?: ComputeConeIntersectionStrategy;
}

/**
 * Runs the compute backend on one workspace snapshot.
 *
 * The current migration ships the CPU reference backend first. The same
 * contract will later be used by WebGL2 and WebGPU without changing the
 * workspace API.
 */
export async function computeWorkspaceDataset(
	workspace: WorkspaceDatasetSnapshot,
	request: WorkspaceComputeRequest = {},
): Promise<WorkspaceComputeResult> {
	const orchestrator = createComputeOrchestrator(createWorkspaceComputeBackendRegistry());
	const coneOptions = createDefaultConePipelineOptions(workspace.pipeline.preparedDataset);
	const result = await orchestrator.computeFrame(
		{
			sourceFiles: workspace.files,
			geojsonSources: workspace.geojsonEntries,
		},
		{
			profileRequest: {
				preferred: request.profile,
				forced: request.forced,
				allowFallback: request.allowFallback ?? true,
			},
			benchmark: request.benchmark ?? true,
			boundaryRaycast: { azimuthSampleCount: 360 },
			staticTown: { sectorCount: 360, neighborLimit: Math.min(Math.max(workspace.pipeline.preparedDataset.cityCount - 1, 0), 16) },
			dynamicYear: workspace.pipeline.preparedDataset.speedTimeline.span.beginYear,
			rawCone: {
				shape: coneOptions.shape,
				azimuthSampleCount: coneOptions.azimuthSampleCount,
				coneLengthMeters: coneOptions.coneLengthMeters,
				attenuationRadians: coneOptions.attenuationRadians,
			},
			coneIntersection: {
				enabled: true,
				strategy: request.coneIntersectionStrategy ?? 'oracle',
			},
		},
		{
			preferred: request.profile,
			forced: request.forced,
			allowFallback: request.allowFallback ?? true,
		},
	);
	return {
		selection: result.selection,
		benchmark: result.benchmark,
		result,
	};
}

function createWorkspaceComputeBackendRegistry(): ComputeBackendRegistry {
	return {
		...createDefaultComputeBackendRegistry(),
		webgl2: createWebGl2ComputeBackendDescriptor(),
		webgpu: createWebGpuComputeBackendDescriptor(),
	};
}
