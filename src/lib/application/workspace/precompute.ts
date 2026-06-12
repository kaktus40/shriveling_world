import type GeoJSON from 'geojson';
import {
	type PreparedDataset,
} from '$lib/domain/data';
import {
	createDefaultConePipelineOptions,
	runBoundaryPipeline,
	runConePipeline,
	type BoundaryPipelineResult,
	type ConePipelineOptions,
	type ConePipelineResult,
} from '$lib/application/validation';
import type { DatasetWorkspaceSnapshot } from './datasets';

/** Options controlling the prepared-workspace precompute snapshot. */
export interface WorkspacePrecomputeRequest extends Partial<ConePipelineOptions> {
	/** Azimuth sampling used for the GeoJSON boundary preparation. */
	readonly boundaryAzimuthSampleCount?: number;
}

/** Prepared snapshot exposing the per-stage precompute boundary for a workspace. */
export interface WorkspacePrecomputeSnapshot {
	readonly datasetName: string;
	readonly preparedDataset: PreparedDataset;
	readonly boundaryRuns: readonly BoundaryPipelineResult[];
	readonly conePipeline: ConePipelineResult;
}

/**
 * Runs the precompute phases on an already prepared workspace snapshot.
 *
 * This helper keeps the ingestion/preparation boundary explicit: callers reuse
 * the prepared dataset as-is and only vary the year or the geometry options
 * relevant to the precompute tranches.
 */
export function runDatasetWorkspacePrecompute(
	workspace: DatasetWorkspaceSnapshot,
	request: WorkspacePrecomputeRequest = {},
): WorkspacePrecomputeSnapshot {
	const boundaryAzimuthSampleCount = request.boundaryAzimuthSampleCount ?? 360;
	const boundaryRuns = workspace.geojsonEntries.map((entry) =>
		runBoundaryPipeline(entry.geojson, workspace.pipeline.preparedDataset, boundaryAzimuthSampleCount),
	);
	const coneDefaults = createDefaultConePipelineOptions(workspace.pipeline.preparedDataset);
	const conePipeline = runConePipeline(workspace.pipeline.preparedDataset, {
		...coneDefaults,
		...request,
		year: request.year ?? coneDefaults.year,
	});

	return {
		datasetName: workspace.datasetName,
		preparedDataset: workspace.pipeline.preparedDataset,
		boundaryRuns,
		conePipeline,
	};
}

/** Returns the GeoJSON feature collections already extracted by the workspace snapshot. */
export function listWorkspaceGeoJsonEntries(
	workspace: DatasetWorkspaceSnapshot,
): readonly GeoJSON.FeatureCollection[] {
	return workspace.geojsonEntries.map((entry) => entry.geojson);
}
