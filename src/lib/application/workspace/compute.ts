import {
	createDefaultComputeWorkflowRegistry,
	createWebGl2WorkflowBackendDescriptor,
	createWebGpuWorkflowBackendDescriptor,
	selectComputeProfile,
	type ComputeBenchmarkReport,
	type ComputeConeIntersectionStrategy,
	type ComputeProfile,
	type ComputeProfileSelection,
	type ComputeWorkflowBackend,
	type ComputeWorkflowBackendRegistry,
	type ComputeWorkflowResult,
} from '$lib/compute';
import { createDefaultConePipelineOptions } from '$lib/application/validation';
import type { DatasetWorkspaceSnapshot } from './catalog';

/** Compute profile and benchmark exposed by the dataset workspace. */
export interface DatasetWorkspaceCompute {
	selection: ComputeProfileSelection;
	benchmark: ComputeBenchmarkReport;
	result: ComputeWorkflowResult;
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
export async function runDatasetWorkspaceCompute(
	workspace: DatasetWorkspaceSnapshot,
	request: WorkspaceComputeRequest = {},
): Promise<DatasetWorkspaceCompute> {
	const registry = createWorkspaceComputeRegistry();
	const selection = await selectComputeProfile(
		{
			preferred: request.profile,
			forced: request.forced,
			allowFallback: request.allowFallback ?? true,
		},
		registry,
	);
	const backend = await resolveSelectedBackend(registry, selection);
	try {
		const coneOptions = createDefaultConePipelineOptions(workspace.pipeline.preparedDataset);
		const result = await backend.run(
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
			selection,
		);
		return {
			selection,
			benchmark: result.benchmark,
			result,
		};
	} finally {
		await backend.dispose();
	}
}

function createWorkspaceComputeRegistry(): ComputeWorkflowBackendRegistry {
	return {
		...createDefaultComputeWorkflowRegistry(),
		webgl2: createWebGl2WorkflowBackendDescriptor(),
		webgpu: createWebGpuWorkflowBackendDescriptor(),
	};
}

async function resolveSelectedBackend(
	registry: ComputeWorkflowBackendRegistry,
	selection: ComputeProfileSelection,
): Promise<ComputeWorkflowBackend> {
	if (selection.selected === 'webgl2' && registry.webgl2) {
		return registry.webgl2.create();
	}
	return registry.cpu.create();
}
