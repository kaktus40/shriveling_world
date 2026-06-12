import rawConeAlphasMathSource from '../../../kernels/shared/math/webgl2.glsl?raw';
import rawConeAlphasKernelSource from '../../../kernels/raw-cone-alphas/webgl2.vert?raw';
import type { DatasetDiagnostic } from '../../../../domain/data';
import type { ComputeResult, StageTiming } from '../../../core';
import { measureAsyncStage } from '../../../core/timing';
import {
	compareFloat32Buffers,
	readBackFloat32Buffer,
} from '../../validation';
import {
	createRawConeAlphasProgram,
} from '../../buffers';
import type { WebGl2ComputeResources } from '../../types';
import { bindRawConeAlphaTextures, shapeToCode } from '../../pass-utils';
import { createRawConeAlphasDispatchResources } from './buffers';

const rawConeAlphasVertexShaderSource = `${rawConeAlphasMathSource}\n${rawConeAlphasKernelSource}`;

export interface WebGl2RawConeAlphaPassInput {
	readonly gl: WebGL2RenderingContext;
	readonly result: ComputeResult;
	readonly resources: WebGl2ComputeResources;
}

export interface WebGl2RawConeAlphaPassResult {
	readonly timing: StageTiming;
	readonly diagnostics: DatasetDiagnostic[];
}

export async function runWebGl2RawConeAlphaPass(
	input: WebGl2RawConeAlphaPassInput,
): Promise<WebGl2RawConeAlphaPassResult> {
	const rawCones = input.result.rawCones;
	const dynamicTown = input.result.dynamicTown;
	if (!rawCones || !dynamicTown) {
		return {
			timing: {
				stage: 'raw-cones-precompute',
				scope: 'precompute',
				profile: 'webgl2',
				startedAtMs: 0,
				endedAtMs: 0,
				durationMs: 0,
			},
			diagnostics: [],
		};
	}

	const cityCount = rawCones.cityCount;
	const azimuthSampleCount = rawCones.azimuthSampleCount;
	if (cityCount <= 0 || azimuthSampleCount <= 0) {
		return {
			timing: {
				stage: 'raw-cones-precompute',
				scope: 'precompute',
				profile: 'webgl2',
				startedAtMs: 0,
				endedAtMs: 0,
				durationMs: 0,
			},
			diagnostics: [],
		};
	}

	const program = input.resources.programCache?.get('raw-cone-alphas') ?? createRawConeAlphasProgram(input.gl, rawConeAlphasVertexShaderSource);
	const dispatchResources = createRawConeAlphasDispatchResources(
		input.gl,
		program,
		{
			cityLinkOffsets: dynamicTown.cityLinkOffsets,
			cityLinkCounts: dynamicTown.cityLinkCounts,
			cityLinkAzimuthRadians: dynamicTown.cityLinkAzimuthRadians,
			cityLinkAlphaRadians: dynamicTown.cityLinkAlphaRadians,
			cityFastestTerrestrialAlphaRadians: dynamicTown.cityFastestTerrestrialAlphaRadians,
			cityCount,
			azimuthSampleCount,
			roadAlphaRadians: dynamicTown.roadAlphaRadians,
			attenuationRadians: rawCones.attenuationRadians ?? 0,
			shape: rawCones.shape,
		},
	);
	const transformFeedback = input.gl.createTransformFeedback();
	if (!transformFeedback) {
		throw new Error('WebGL2 transform feedback allocation failed');
	}

	const { timing } = await measureAsyncStage(
		'raw-cones-precompute',
		'precompute',
		'webgl2',
		async () => {
			input.gl.useProgram(program);
			input.gl.uniform4f(
				dispatchResources.uniformLocation,
				dynamicTown.roadAlphaRadians,
				rawCones.attenuationRadians ?? 0,
				shapeToCode(rawCones.shape),
				azimuthSampleCount,
			);
			bindRawConeAlphaTextures(input.gl, dispatchResources);
			input.gl.bindVertexArray(dispatchResources.vertexArray);
			input.gl.bindBufferBase(input.gl.TRANSFORM_FEEDBACK_BUFFER, 0, dispatchResources.outputBuffer);
			input.gl.bindTransformFeedback(input.gl.TRANSFORM_FEEDBACK, transformFeedback);
			input.gl.enable(input.gl.RASTERIZER_DISCARD);
			input.gl.beginTransformFeedback(input.gl.POINTS);
			input.gl.drawArraysInstanced(input.gl.POINTS, 0, 1, cityCount * azimuthSampleCount);
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
	const alphaReadback = readBackFloat32Buffer(
		input.gl,
		input.gl.TRANSFORM_FEEDBACK_BUFFER,
		dispatchResources.outputBuffer,
		cityCount * azimuthSampleCount,
	);
	if (alphaReadback) {
		diagnostics.push(
			...compareFloat32Buffers(
				'webgl2-raw-cone-alpha',
				rawCones.coneAlphaRadians,
				alphaReadback,
			),
		);
	}

	return { timing, diagnostics };
}
