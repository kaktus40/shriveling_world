import boundaryAlgebreVertexShaderSource from '../../kernels/boundary-algebre/webgl2.vert?raw';
import { EARTH_RADIUS_METERS } from '../../../shared';
import type { DatasetDiagnostic } from '../../../domain/data';
import { buildAzimuthIntervals, packAzimuthIntervals } from '../../../domain/geojson';
import type { ComputeWorkflowResult, StageTiming } from '../../core';
import { measureAsyncStage } from '../../core/timing';
import {
	compareFloat32Buffers,
	readBackFloat32Buffer,
} from '../validation';
import {
	createBoundaryAlgebreDispatchResources,
	createBoundaryAlgebreProgram,
	type WebGl2BoundaryAlgebreDispatchResources,
} from '../buffers';
import { bindBoundaryTextures } from '../pass-bindings';
import type { WebGl2ComputeResources } from '../types';

export interface WebGl2BoundaryRaycastPassInput {
	readonly gl: WebGL2RenderingContext;
	readonly result: ComputeWorkflowResult;
	readonly geojsonRun: ComputeWorkflowResult['geojsonRuns'][number];
	readonly resources: WebGl2ComputeResources;
}

export interface WebGl2BoundaryRaycastPassResult {
	readonly timing: StageTiming;
	readonly extraTimings?: StageTiming[];
	readonly diagnostics: DatasetDiagnostic[];
}

export async function runWebGl2BoundaryRaycastPass(
	input: WebGl2BoundaryRaycastPassInput,
): Promise<WebGl2BoundaryRaycastPassResult> {
	const staticTown = input.result.staticTown;
	if (!staticTown) {
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

	const boundary = input.geojsonRun.boundaryPrecompute;
	const cityCount = staticTown.cityCount;
	const azimuthSampleCount = boundary.azimuthSampleCount;
	const contourCount = boundary.countryContourSizes.length;
	if (cityCount <= 0 || azimuthSampleCount <= 0) {
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

	const program = input.resources.programCache?.get('boundary-algebre') ?? createBoundaryAlgebreProgram(input.gl, boundaryAlgebreVertexShaderSource);
	const dispatchResources = createBoundaryAlgebreDispatchResources(
		input.gl,
		program,
		{
			cityNed2EcefMatrices: staticTown.cityNed2EcefMatrices,
			cityContourIndexes: boundary.cityContourIndexes,
			countryContourNVectorBuffer: boundary.countryContourNVectorBuffer,
			countryContourOffsets: boundary.countryContourOffsets,
			countryContourSizes: boundary.countryContourSizes,
			azimuthIntervals: packAzimuthIntervals(buildAzimuthIntervals(azimuthSampleCount)),
			cityCount,
			azimuthIntervalCount: azimuthSampleCount,
			contourCount,
			earthRadiusMeters: EARTH_RADIUS_METERS,
		},
	);

	const { timing } = await measureAsyncStage(
		'geojson-boundary-raycast',
		'precompute',
		'webgl2',
		async () => {
			input.gl.useProgram(program);
			input.gl.uniform4f(
				dispatchResources.uniformLocation,
				EARTH_RADIUS_METERS,
				cityCount,
				azimuthSampleCount,
				contourCount,
			);
			bindBoundaryTextures(input.gl, dispatchResources);
			input.gl.bindVertexArray(dispatchResources.vertexArray);
			input.gl.bindBufferBase(input.gl.TRANSFORM_FEEDBACK_BUFFER, 0, dispatchResources.angularOutputBuffer);
			input.gl.bindBufferBase(input.gl.TRANSFORM_FEEDBACK_BUFFER, 1, dispatchResources.ecefOutputBuffer);
			const transformFeedback = input.gl.createTransformFeedback();
			if (!transformFeedback) {
				throw new Error('WebGL2 transform feedback allocation failed');
			}
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
	const angularReadback = readBackFloat32Buffer(
		input.gl,
		input.gl.TRANSFORM_FEEDBACK_BUFFER,
		dispatchResources.angularOutputBuffer,
		cityCount * azimuthSampleCount * 4,
	);
	const ecefReadback = readBackFloat32Buffer(
		input.gl,
		input.gl.TRANSFORM_FEEDBACK_BUFFER,
		dispatchResources.ecefOutputBuffer,
		cityCount * azimuthSampleCount * 4,
	);
	if (angularReadback && ecefReadback) {
		diagnostics.push(
			...compareFloat32Buffers(
				'webgl2-boundary-angular',
				input.geojsonRun.boundaryRaycast.townBoundaryAngular,
				angularReadback,
			),
			...compareFloat32Buffers(
				'webgl2-boundary-ecef',
				input.geojsonRun.boundaryRaycast.townBoundaryEcef,
				ecefReadback,
			),
		);
	}

	return { timing, diagnostics };
}
