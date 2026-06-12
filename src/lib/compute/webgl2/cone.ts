import type { DatasetDiagnostic } from '../../domain/data';
import type { ComputeResult, StageTiming } from '../core';
import type { WebGl2ComputeResources } from './types';
import { runWebGl2CityMatrixPass } from './passes/city-ned2ecef';
import { runWebGl2RawConeAlphaPass } from './passes/raw-cone-alphas';
import { runWebGl2CiseledConePass } from './passes/ciseled-cones';

/** Runs the WebGL2 passes that build and compare the cone pipeline. */
export async function runWebGl2ConeStages(
	gl: WebGL2RenderingContext,
	result: ComputeResult,
	resources: WebGl2ComputeResources,
): Promise<{
	extraTimings: StageTiming[];
	diagnostics: DatasetDiagnostic[];
	ciseledConeRimEcefBuffer: WebGLBuffer | null;
}> {
	const extraTimings: StageTiming[] = [];
	const diagnostics: DatasetDiagnostic[] = [];
	let ciseledConeRimEcefBuffer: WebGLBuffer | null = null;

	if (result.staticTown) {
		const cityMatrixPass = await runWebGl2CityMatrixPass({
			gl,
			result,
			resources,
		});
		extraTimings.push(cityMatrixPass.timing);
		diagnostics.push(...cityMatrixPass.diagnostics);
	}

	if (result.rawCones) {
		const rawConeAlphaPass = await runWebGl2RawConeAlphaPass({
			gl,
			result,
			resources,
		});
		extraTimings.push(rawConeAlphaPass.timing);
		diagnostics.push(...rawConeAlphaPass.diagnostics);
	}

	if (result.staticTown && result.rawCones && result.coneIntersections) {
		const ciseledConePass = await runWebGl2CiseledConePass({
			gl,
			result,
			resources,
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
