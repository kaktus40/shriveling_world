import {
	createDefaultComputeBackendRegistry,
	createWebGl2ComputeBackendDescriptor,
	createWebGpuComputeBackendDescriptor,
	selectComputeProfile,
	type ComputeBenchmarkReport,
	type ComputeConeIntersectionStrategy,
	type ComputeProfile,
	type ComputeProfileSelection,
	type ComputeBackend,
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
	const registry = createWorkspaceComputeBackendRegistry();
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
		const result = await backend.computeFrame(
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

function createWorkspaceComputeBackendRegistry(): ComputeBackendRegistry {
	return {
		...createDefaultComputeBackendRegistry(),
		webgl2: createWebGl2ComputeBackendDescriptor(),
		webgpu: createWebGpuComputeBackendDescriptor(),
	};
}

async function resolveSelectedBackend(
	registry: ComputeBackendRegistry,
	selection: ComputeProfileSelection,
): Promise<ComputeBackend> {
	if (selection.selected === 'webgl2' && registry.webgl2) {
		return registry.webgl2.create();
	}
	return registry.cpu.create();
}
