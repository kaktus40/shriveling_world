import type { DatasetDiagnostic } from '../../domain/data';
import type { ComputeResult, StageTiming } from '../core';
import type { ComputeStage, ComputeOptions } from '../core/types';
import type { WebGpuComputeContext, WebGpuComputeResources } from './types';
import { runWebGpuBoundaryRaycastPass } from './passes/boundary-algebre';

/** Runs the WebGPU boundary comparison stage for every GeoJSON result. */
export async function runWebGpuBoundaryStages(
	context: WebGpuComputeContext,
	result: ComputeResult,
	geojsonRun: ComputeResult['geojsonRuns'][number],
	resources: WebGpuComputeResources,
	options: ComputeOptions = {},
): Promise<{
	timing: StageTiming;
	extraTimings?: StageTiming[];
	diagnostics: DatasetDiagnostic[];
}> {
	const shouldRun = (stage: ComputeStage) => !options.passFilter || options.passFilter.includes(stage);
	if (!shouldRun('geojson-boundary-raycast')) {
		return {
			timing: {
				stage: 'geojson-boundary-raycast',
				scope: 'precompute',
				profile: 'webgpu',
				startedAtMs: 0,
				endedAtMs: 0,
				durationMs: 0,
			},
			diagnostics: [],
		};
	}

	const boundaryPass = await runWebGpuBoundaryRaycastPass({
		context,
		result,
		geojsonRun,
		resources,
	});

	return boundaryPass;
}
