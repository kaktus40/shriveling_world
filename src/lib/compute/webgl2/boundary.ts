import type { DatasetDiagnostic } from '../../domain/data';
import type { ComputeResult, StageTiming } from '../core';
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
): Promise<{
	timing: StageTiming;
	extraTimings?: StageTiming[];
	diagnostics: DatasetDiagnostic[];
}> {
	const boundaryPass = await runWebGl2BoundaryRaycastPass({
		gl,
		result,
		geojsonRun,
		resources,
	});

	if (ciseledConeRimEcefBuffer && geojsonRun.finalCones) {
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
		});
		return {
			timing: boundaryPass.timing,
			extraTimings: [finalPass.timing],
			diagnostics: [...boundaryPass.diagnostics, ...finalPass.diagnostics],
		};
	}

	return boundaryPass;
}
