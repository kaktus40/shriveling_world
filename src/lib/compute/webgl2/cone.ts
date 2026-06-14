import type { DatasetDiagnostic } from '../../domain/data';
import type { ComputeOptions, ComputeResult, StageTiming } from '../core';
import type { ComputeStage } from '../core/types';
import type { WebGl2ComputeResources } from './types';
import { runWebGl2CityMatrixPass } from './passes/city-ned2ecef';
import { runWebGl2RawConeAlphaPass } from './passes/raw-cone-alphas';
import { runWebGl2CiseledConePass } from './passes/ciseled-cones';

/** Runs the WebGL2 passes that build and compare the cone pipeline. */
export async function runWebGl2ConeStages(
	gl: WebGL2RenderingContext,
	result: ComputeResult,
	resources: WebGl2ComputeResources,
	options: ComputeOptions = {},
): Promise<{
	extraTimings: StageTiming[];
	diagnostics: DatasetDiagnostic[];
	ciseledConeRimEcefBuffer: WebGLBuffer | null;
}> {
	const extraTimings: StageTiming[] = [];
	const diagnostics: DatasetDiagnostic[] = [];
	let ciseledConeRimEcefBuffer: WebGLBuffer | null = null;

	const shouldRun = (stage: ComputeStage) => !options.passFilter || options.passFilter.includes(stage);

	if (shouldRun('static-town-precompute') && result.staticTown) {
		const cityMatrixPass = await runWebGl2CityMatrixPass({
			gl,
			result,
			resources,
		});
		extraTimings.push(cityMatrixPass.timing);
		diagnostics.push(...cityMatrixPass.diagnostics);
	}

	if (shouldRun('raw-cones-precompute') && result.rawCones) {
		const rawConeAlphaPass = await runWebGl2RawConeAlphaPass({
			gl,
			result,
			resources,
		});
		extraTimings.push(rawConeAlphaPass.timing);
		diagnostics.push(...rawConeAlphaPass.diagnostics);
	}

	if (shouldRun('cone-intersections-precompute') && result.staticTown && result.rawCones && result.coneIntersections) {
		const ciseledConePass = await runWebGl2CiseledConePass({
			gl,
			result,
			resources,
			coneIntersection: options.coneIntersection,
		});
		extraTimings.push(ciseledConePass.timing);
		diagnostics.push(...ciseledConePass.diagnostics);
		ciseledConeRimEcefBuffer = ciseledConePass.ciseledConeRimEcefBuffer ?? null;
	}

	return {
		extraTimings,
		diagnostics,
		ciseledConeRimEcefBuffer,
	};
}
