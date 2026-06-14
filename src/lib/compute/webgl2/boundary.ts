import type { DatasetDiagnostic } from '../../domain/data';
import type { ComputeResult, StageTiming } from '../core';
import type { ComputeProjectionOptions, ComputeOptions, ComputeStage } from '../core/types';
import type { WebGl2ComputeResources } from './types';
import { runWebGl2BoundaryRaycastPass } from './passes/boundary-algebre';
import { runWebGl2FinalConePass } from './passes/final-cones';

/** Runs the WebGL2 boundary and final-cone comparison stages for every GeoJSON result. */
export async function runWebGl2BoundaryStages(
	gl: WebGL2RenderingContext,
	result: ComputeResult,
	geojsonRun: ComputeResult['geojsonRuns'][number],
	resources: WebGl2ComputeResources,
	ciseledConeRimEcefBuffer: WebGLBuffer | null,
	projection?: ComputeProjectionOptions,
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
				profile: 'webgl2',
				startedAtMs: 0,
				endedAtMs: 0,
				durationMs: 0,
			},
			diagnostics: [],
		};
	}

	const boundaryPass = await runWebGl2BoundaryRaycastPass({
		gl,
		result,
		geojsonRun,
		resources,
	});

	if (ciseledConeRimEcefBuffer && geojsonRun.finalCones && shouldRun('final-cones-precompute')) {
		const finalPass = await runWebGl2FinalConePass({
			gl,
			result,
			geojsonRun,
			ciseledConeRimEcefBuffer,
			townBoundaryAngularBuffer: boundaryPass.townBoundaryAngularBuffer ?? (() => {
				throw new Error('WebGL2 boundary angular buffer unavailable');
			})(),
			townBoundaryEcefBuffer: boundaryPass.townBoundaryEcefBuffer ?? (() => {
				throw new Error('WebGL2 boundary ecef buffer unavailable');
			})(),
			resources,
			projectionStart: projection?.start,
			projectionEnd: projection?.end,
			projectionPercent: projection?.percent,
			projectionSettings: projection?.settings,
		});
		return {
			timing: boundaryPass.timing,
			extraTimings: [finalPass.timing],
			diagnostics: [...boundaryPass.diagnostics, ...finalPass.diagnostics],
		};
	}

	return boundaryPass;
}
