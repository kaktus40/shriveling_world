import type { DatasetDiagnostic } from '../../domain/data';
import type { ComputeResult, StageTiming } from '../core';
import type { WebGpuComputeContext, WebGpuComputeResources } from './types';
import { runWebGpuBoundaryRaycastPass } from './passes/boundary-algebre';

/** Runs the WebGPU boundary comparison stage for every GeoJSON result. */
export async function runWebGpuBoundaryStages(
	context: WebGpuComputeContext,
	result: ComputeResult,
	geojsonRun: ComputeResult['geojsonRuns'][number],
	resources: WebGpuComputeResources,
): Promise<{
	timing: StageTiming;
	extraTimings?: StageTiming[];
	diagnostics: DatasetDiagnostic[];
}> {
	const boundaryPass = await runWebGpuBoundaryRaycastPass({
		context,
		result,
		geojsonRun,
		resources,
	});

	return boundaryPass;
}
