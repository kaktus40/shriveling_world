import cityNed2EcefVertexShaderSource from '../../kernels/city-ned2ecef/webgl2.vert?raw';
import { EARTH_RADIUS_METERS } from '../../../shared';
import type { DatasetDiagnostic } from '../../../domain/data';
import type { ComputeWorkflowResult, StageTiming } from '../../core';
import { measureAsyncStage } from '../../core/timing';
import {
	compareFloat32Buffers,
	readBackFloat32Buffer,
} from '../validation';
import {
	createCityNed2EcefDispatchResources,
	createCityNed2EcefProgram,
} from '../buffers';
import type { WebGl2ComputeResources } from '../types';

export interface WebGl2CityMatrixPassInput {
	readonly gl: WebGL2RenderingContext;
	readonly result: ComputeWorkflowResult;
	readonly resources: WebGl2ComputeResources;
}

export interface WebGl2CityMatrixPassResult {
	readonly timing: StageTiming;
	readonly diagnostics: DatasetDiagnostic[];
}

export async function runWebGl2CityMatrixPass(
	input: WebGl2CityMatrixPassInput,
): Promise<WebGl2CityMatrixPassResult> {
	const prepared = input.result.preparedDataset;
	const cityCount = prepared.cityCount;
	if (cityCount <= 0) {
		return {
			timing: {
				stage: 'static-town-precompute',
				scope: 'precompute',
				profile: 'webgl2',
				startedAtMs: 0,
				endedAtMs: 0,
				durationMs: 0,
			},
			diagnostics: [],
		};
	}

	const program = input.resources.programCache?.get('city-ned2ecef') ?? createCityNed2EcefProgram(input.gl, cityNed2EcefVertexShaderSource);
	const dispatchResources = createCityNed2EcefDispatchResources(
		input.gl,
		program,
		new Float32Array(prepared.cityLonLatRadians),
		cityCount,
		EARTH_RADIUS_METERS,
	);
	const transformFeedback = input.gl.createTransformFeedback();
	if (!transformFeedback) {
		throw new Error('WebGL2 transform feedback allocation failed');
	}

	const { timing } = await measureAsyncStage(
		'static-town-precompute',
		'precompute',
		'webgl2',
		async () => {
			input.gl.useProgram(program);
			input.gl.uniform1f(dispatchResources.uniformLocation, EARTH_RADIUS_METERS);
			input.gl.bindVertexArray(dispatchResources.vertexArray);
			input.gl.bindBufferBase(input.gl.TRANSFORM_FEEDBACK_BUFFER, 0, dispatchResources.outputBuffer);
			input.gl.bindTransformFeedback(input.gl.TRANSFORM_FEEDBACK, transformFeedback);
			input.gl.enable(input.gl.RASTERIZER_DISCARD);
			input.gl.beginTransformFeedback(input.gl.POINTS);
			input.gl.drawArrays(input.gl.POINTS, 0, cityCount);
			input.gl.endTransformFeedback();
			input.gl.disable(input.gl.RASTERIZER_DISCARD);
			input.gl.bindTransformFeedback(input.gl.TRANSFORM_FEEDBACK, null);
			input.gl.bindBufferBase(input.gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
			input.gl.bindVertexArray(null);
			input.gl.finish();
			return undefined;
		},
	);

	const diagnostics: DatasetDiagnostic[] = [];
	const cityMatricesReadback = readBackFloat32Buffer(
		input.gl,
		input.gl.TRANSFORM_FEEDBACK_BUFFER,
		dispatchResources.outputBuffer,
		cityCount * 16,
	);
	if (cityMatricesReadback) {
		diagnostics.push(
			...compareFloat32Buffers(
				'webgl2-city-matrices',
				input.result.staticTown?.cityNed2EcefMatrices ?? new Float32Array(cityCount * 16),
				cityMatricesReadback,
			),
		);
	}

	return { timing, diagnostics };
}
