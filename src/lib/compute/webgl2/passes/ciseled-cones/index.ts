import sharedMathVertexShaderSource from '../../../kernels/shared/math/webgl2.glsl?raw';
import rayIntersectTriangleVertexShaderSource from '../../../kernels/shared/ray-intersect-triangle/webgl2.glsl?raw';
import ciseledConesVertexShaderSource from '../../../kernels/ciseled-cones/webgl2.vert?raw';
import type { DatasetDiagnostic } from '../../../../domain/data';
import type { ComputeOptions, ComputeResult, StageTiming } from '../../../core';
import { ALPHA_SUPPORT_EPSILON_RADIANS } from '../../../../domain/precompute/cpu/cone-intersection-constants';
import { measureAsyncStage } from '../../../core/timing';
import {
	compareFloat32Buffers,
	readBackFloat32Buffer,
} from '../../validation';
import {
	createCiseledConesProgram,
} from '../../buffers';
import { bindCiseledConesTextures } from '../../pass-bindings';
import type { WebGl2ComputeResources } from '../../types';
import { createCiseledConesDispatchResources } from './buffers';

export interface WebGl2CiseledConePassInput {
	readonly gl: WebGL2RenderingContext;
	readonly result: ComputeResult;
	readonly resources: WebGl2ComputeResources;
	readonly coneIntersection?: ComputeOptions['coneIntersection'];
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
	const dynamicTown = input.result.dynamicTown;
	if (!staticTown || !rawCones || !coneIntersections || !dynamicTown) {
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
	const alphaAwareOptions = input.coneIntersection?.alphaAware ?? {};
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

	const program =
		input.resources.programCache?.get('ciseled-cones') ??
		createCiseledConesProgram(
			input.gl,
			`${sharedMathVertexShaderSource}\n${rayIntersectTriangleVertexShaderSource}\n${ciseledConesVertexShaderSource}`,
		);
	const dispatchResources = createCiseledConesDispatchResources(
		input.gl,
		program,
		{
			cityNed2EcefMatrices: staticTown.cityNed2EcefMatrices,
			overlapCandidates: staticTown.overlapCandidates,
			overlapCandidateCounts: staticTown.overlapCandidateCounts,
			rawConeRimEcef: rawCones.rawConeRimEcef,
			cityPairInvariants: staticTown.cityPairInvariants,
			coneAlphaRadians: rawCones.coneAlphaRadians,
			cityCount,
			azimuthSampleCount,
			neighborLimit: staticTown.neighborLimit,
			roadAlphaRadians: dynamicTown.roadAlphaRadians,
			bilateralNeighborhoodFaceCount:
				alphaAwareOptions.bilateralNeighborhoodFaceCount ?? Math.min(Math.max(azimuthSampleCount, 1), 8),
			alphaEpsilonRadians: alphaAwareOptions.alphaEpsilonRadians ?? ALPHA_SUPPORT_EPSILON_RADIANS,
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
			input.gl.uniform4f(
				dispatchResources.heuristicUniformLocation,
				dynamicTown.roadAlphaRadians,
				alphaAwareOptions.bilateralNeighborhoodFaceCount ?? Math.min(Math.max(azimuthSampleCount, 1), 8),
				alphaAwareOptions.alphaEpsilonRadians ?? ALPHA_SUPPORT_EPSILON_RADIANS,
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
