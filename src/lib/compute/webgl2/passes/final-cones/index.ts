import finalConesVertexShaderSource from '../../../kernels/final-cones/webgl2.vert?raw';
import { EARTH_RADIUS_METERS } from '../../../../shared';
import type { DatasetDiagnostic } from '../../../../domain/data';
import type { ComputeWorkflowResult, StageTiming } from '../../../core';
import { measureAsyncStage } from '../../../core/timing';
import {
	compareFloat32Buffers,
	readBackFloat32Buffer,
} from '../../validation';
import {
	createFinalConesProgram,
	type WebGl2FinalConesDispatchResources,
} from '../../buffers';
import { createFinalConesDispatchResources } from './buffers';
import type { WebGl2ComputeResources } from '../../types';

export interface WebGl2FinalConesPassInput {
	readonly gl: WebGL2RenderingContext;
	readonly result: ComputeWorkflowResult;
	readonly geojsonRun: ComputeWorkflowResult['geojsonRuns'][number];
	readonly ciseledConeRimEcefBuffer: WebGLBuffer;
	readonly townBoundaryAngularBuffer: WebGLBuffer;
	readonly townBoundaryEcefBuffer: WebGLBuffer;
	readonly resources: WebGl2ComputeResources;
}

export interface WebGl2FinalConesPassResult {
	readonly timing: StageTiming;
	readonly diagnostics: DatasetDiagnostic[];
}

export async function runWebGl2FinalConePass(
	input: WebGl2FinalConesPassInput,
): Promise<WebGl2FinalConesPassResult> {
	const staticTown = input.result.staticTown;
	if (!staticTown) {
		return {
			timing: {
				stage: 'final-cones-precompute',
				scope: 'precompute',
				profile: 'webgl2',
				startedAtMs: 0,
				endedAtMs: 0,
				durationMs: 0,
			},
			diagnostics: [],
		};
	}

	const finalCones = input.geojsonRun.finalCones;
	if (!finalCones) {
		return {
			timing: {
				stage: 'final-cones-precompute',
				scope: 'precompute',
				profile: 'webgl2',
				startedAtMs: 0,
				endedAtMs: 0,
				durationMs: 0,
			},
			diagnostics: [],
		};
	}

	const cityCount = staticTown.cityCount;
	const azimuthSampleCount = input.geojsonRun.boundaryRaycast.azimuthIntervalCount;
	if (cityCount <= 0 || azimuthSampleCount <= 0) {
		return {
			timing: {
				stage: 'final-cones-precompute',
				scope: 'precompute',
				profile: 'webgl2',
				startedAtMs: 0,
				endedAtMs: 0,
				durationMs: 0,
			},
			diagnostics: [],
		};
	}

	const program = input.resources.programCache?.get('final-cones') ?? createFinalConesProgram(input.gl, finalConesVertexShaderSource);
	const dispatchResources = createFinalConesDispatchResources(input.gl, program, {
		ciseledConeRimEcef: input.ciseledConeRimEcefBuffer,
		townBoundaryAngular: input.townBoundaryAngularBuffer,
		townBoundaryEcef: input.townBoundaryEcefBuffer,
		cityCount,
		azimuthSampleCount,
		earthRadiusMeters: EARTH_RADIUS_METERS,
	});
	const transformFeedback = input.gl.createTransformFeedback();
	if (!transformFeedback) {
		throw new Error('WebGL2 transform feedback allocation failed');
	}

	const { timing } = await measureAsyncStage(
		'final-cones-precompute',
		'precompute',
		'webgl2',
		async () => {
			input.gl.useProgram(program);
			input.gl.uniform4f(
				dispatchResources.uniformLocation,
				EARTH_RADIUS_METERS,
				cityCount,
				azimuthSampleCount,
				0,
			);
			bindFinalConesInputs(input.gl, dispatchResources);
			input.gl.bindVertexArray(dispatchResources.vertexArray);
			input.gl.bindBufferBase(input.gl.TRANSFORM_FEEDBACK_BUFFER, 0, dispatchResources.finalConeGeometryEcefBuffer);
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
	const finalReadback = readBackFloat32Buffer(
		input.gl,
		input.gl.TRANSFORM_FEEDBACK_BUFFER,
		dispatchResources.finalConeGeometryEcefBuffer,
		cityCount * azimuthSampleCount * 4,
	);
	if (finalReadback) {
		diagnostics.push(
			...compareFloat32Buffers(
				'webgl2-final-cone-geometry',
				finalCones.finalConeGeometryEcef,
				finalReadback,
			),
		);
	}
	return { timing, diagnostics };
}

function bindFinalConesInputs(
	gl: WebGL2RenderingContext,
	resources: WebGl2FinalConesDispatchResources,
): void {
	gl.bindVertexArray(resources.vertexArray);

	gl.bindBuffer(gl.ARRAY_BUFFER, resources.ciseledConeRimEcefBuffer);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
	gl.vertexAttribDivisor?.(0, 1);

	gl.bindBuffer(gl.ARRAY_BUFFER, resources.townBoundaryAngularBuffer);
	gl.enableVertexAttribArray(1);
	gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
	gl.vertexAttribDivisor?.(1, 1);

	gl.bindBuffer(gl.ARRAY_BUFFER, resources.townBoundaryEcefBuffer);
	gl.enableVertexAttribArray(2);
	gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);
	gl.vertexAttribDivisor?.(2, 1);

	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	gl.bindVertexArray(null);
}
