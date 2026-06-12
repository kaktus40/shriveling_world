import ciseledConesVertexShaderSource from '../../kernels/ciseled-cones/webgl2.vert?raw';
import type { DatasetDiagnostic } from '../../../domain/data';
import type { ComputeWorkflowResult, StageTiming } from '../../core';
import { measureAsyncStage } from '../../core/timing';
import {
	compareFloat32Buffers,
	readBackFloat32Buffer,
} from '../validation';
import {
	createCiseledConesProgram,
} from '../buffers';
import { bindCiseledConesTextures } from '../pass-bindings';
import type { WebGl2ComputeResources } from '../types';
import { createCiseledConesDispatchResources } from './ciseled-cones-buffers';

export interface WebGl2CiseledConePassInput {
	readonly gl: WebGL2RenderingContext;
	readonly result: ComputeWorkflowResult;
	readonly resources: WebGl2ComputeResources;
}

export interface WebGl2CiseledConePassResult {
	readonly timing: StageTiming;
	readonly diagnostics: DatasetDiagnostic[];
	readonly ciseledConeRimEcefBuffer?: WebGLBuffer;
}

export async function runWebGl2CiseledConePass(
	input: WebGl2CiseledConePassInput,
): Promise<WebGl2CiseledConePassResult> {
	const staticTown = input.result.staticTown;
	const rawCones = input.result.rawCones;
	const coneIntersections = input.result.coneIntersections;
	if (!staticTown || !rawCones || !coneIntersections) {
		return {
			timing: {
				stage: 'cone-intersections-precompute',
				scope: 'interactive',
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
				stage: 'cone-intersections-precompute',
				scope: 'interactive',
				profile: 'webgl2',
				startedAtMs: 0,
				endedAtMs: 0,
				durationMs: 0,
			},
			diagnostics: [],
		};
	}

	const program = input.resources.programCache?.get('ciseled-cones') ?? createCiseledConesProgram(input.gl, ciseledConesVertexShaderSource);
	const dispatchResources = createCiseledConesDispatchResources(
		input.gl,
		program,
		{
			cityNed2EcefMatrices: staticTown.cityNed2EcefMatrices,
			overlapCandidates: staticTown.overlapCandidates,
			overlapCandidateCounts: staticTown.overlapCandidateCounts,
			rawConeRimEcef: rawCones.rawConeRimEcef,
			cityCount,
			azimuthSampleCount,
			neighborLimit: staticTown.neighborLimit,
		},
	);
	const transformFeedback = input.gl.createTransformFeedback();
	if (!transformFeedback) {
		throw new Error('WebGL2 transform feedback allocation failed');
	}

	const { timing } = await measureAsyncStage(
		'cone-intersections-precompute',
		'interactive',
		'webgl2',
		async () => {
			input.gl.useProgram(program);
			input.gl.uniform4f(
				dispatchResources.uniformLocation,
				cityCount,
				azimuthSampleCount,
				staticTown.neighborLimit,
				0,
			);
			bindCiseledConesTextures(input.gl, dispatchResources);
			input.gl.bindVertexArray(dispatchResources.vertexArray);
			input.gl.bindBufferBase(input.gl.TRANSFORM_FEEDBACK_BUFFER, 0, dispatchResources.coneIntersectionDistanceMetersBuffer);
			input.gl.bindBufferBase(input.gl.TRANSFORM_FEEDBACK_BUFFER, 1, dispatchResources.ciseledConeRimEcefBuffer);
			input.gl.bindTransformFeedback(input.gl.TRANSFORM_FEEDBACK, transformFeedback);
			input.gl.enable(input.gl.RASTERIZER_DISCARD);
			input.gl.beginTransformFeedback(input.gl.POINTS);
			input.gl.drawArraysInstanced(input.gl.POINTS, 0, 1, cityCount * azimuthSampleCount);
			input.gl.endTransformFeedback();
			input.gl.disable(input.gl.RASTERIZER_DISCARD);
			input.gl.bindTransformFeedback(input.gl.TRANSFORM_FEEDBACK, null);
			input.gl.bindBufferBase(input.gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
			input.gl.bindBufferBase(input.gl.TRANSFORM_FEEDBACK_BUFFER, 1, null);
			input.gl.bindVertexArray(null);
			input.gl.finish();
			return undefined;
		},
	);

	const diagnostics: DatasetDiagnostic[] = [];
	const distanceReadback = readBackFloat32Buffer(
		input.gl,
		input.gl.TRANSFORM_FEEDBACK_BUFFER,
		dispatchResources.coneIntersectionDistanceMetersBuffer,
		cityCount * azimuthSampleCount,
	);
	const rimReadback = readBackFloat32Buffer(
		input.gl,
		input.gl.TRANSFORM_FEEDBACK_BUFFER,
		dispatchResources.ciseledConeRimEcefBuffer,
		cityCount * azimuthSampleCount * 4,
	);
	if (distanceReadback && rimReadback) {
		diagnostics.push(
			...compareFloat32Buffers(
				'webgl2-cone-intersection-distance',
				coneIntersections.coneIntersectionDistanceMeters,
				distanceReadback,
			),
			...compareFloat32Buffers(
				'webgl2-ciseled-cone-rim',
				coneIntersections.ciseledConeRimEcef,
				rimReadback,
			),
		);
	}

	return { timing, diagnostics, ciseledConeRimEcefBuffer: dispatchResources.ciseledConeRimEcefBuffer };
}
