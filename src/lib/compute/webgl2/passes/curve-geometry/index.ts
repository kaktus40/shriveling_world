import curveGeometryVertexShaderSource from '../../../kernels/curve-geometry/webgl2.vert?raw';
import { EARTH_RADIUS_METERS } from '../../../../shared';
import type { DatasetDiagnostic } from '../../../../domain/data';
import { prepareCurveGeometryInput, prepareCurvePrecompute } from '../../../../domain/precompute';
import type { ComputeOptions, ComputeResult, StageTiming } from '../../../core';
import { measureAsyncStage } from '../../../core/timing';
import {
	compareFloat32Buffers,
	readBackFloat32Buffer,
} from '../../validation';
import {
	createCurveGeometryProgram,
	type WebGl2CurveGeometryDispatchResources,
} from '../../buffers';
import { createCurveGeometryDispatchResources } from './buffers';
import type { WebGl2ComputeResources } from '../../types';

export interface WebGl2CurveGeometryPassInput {
	readonly gl: WebGL2RenderingContext;
	readonly result: ComputeResult;
	readonly options: ComputeOptions;
	readonly resources: WebGl2ComputeResources;
}

export interface WebGl2CurveGeometryPassResult {
	readonly timing: StageTiming;
	readonly diagnostics: DatasetDiagnostic[];
}

export async function runWebGl2CurveGeometryPass(
	input: WebGl2CurveGeometryPassInput,
): Promise<WebGl2CurveGeometryPassResult> {
	const staticTown = input.result.staticTown;
	const curveGeometry = input.result.curveGeometry;
	if (!staticTown || !curveGeometry) {
		return {
			timing: {
				stage: 'curve-geometry-precompute',
				scope: 'precompute',
				profile: 'webgl2',
				startedAtMs: 0,
				endedAtMs: 0,
				durationMs: 0,
			},
			diagnostics: [],
		};
	}

	const curvePrecompute = prepareCurvePrecompute(input.result.preparedDataset, staticTown);
	const curveInput = prepareCurveGeometryInput(curvePrecompute, {
		year: input.options.curve?.year ?? input.result.dynamicTown?.year ?? input.result.preparedDataset.speedTimeline.span.beginYear,
		pointsPerCurve: input.options.curve?.pointsPerCurve ?? curveGeometry.pointsPerCurve,
		curvePosition: input.options.curve?.curvePosition ?? 'above',
		coefficient: input.options.curve?.coefficient ?? 1,
	});
	if (curveInput.curveCount <= 0) {
		return {
			timing: {
				stage: 'curve-geometry-precompute',
				scope: 'precompute',
				profile: 'webgl2',
				startedAtMs: 0,
				endedAtMs: 0,
				durationMs: 0,
			},
			diagnostics: tagDiagnostics(curvePrecompute.diagnostics, 'webgl2'),
		};
	}

	const gl = input.gl;
	const resources = input.resources;
	const program = resources.programCache?.get('curve-geometry') ?? createCurveGeometryProgram(gl, curveGeometryVertexShaderSource);
	const dispatchResources = createCurveGeometryDispatchResources(gl, program, {
		...curveInput,
		earthRadiusMeters: EARTH_RADIUS_METERS,
	});
	const transformFeedback = gl.createTransformFeedback();
	if (!transformFeedback) {
		throw new Error('WebGL2 transform feedback allocation failed');
	}

	const { timing } = await measureAsyncStage(
		'curve-geometry-precompute',
		'precompute',
		'webgl2',
		async () => {
			gl.useProgram(program);
			gl.uniform4f(
				dispatchResources.uniformLocation,
				EARTH_RADIUS_METERS,
				curveInput.pointsPerCurve,
				curvePositionToCode(curveInput.curvePosition),
				curveInput.coefficient ?? 1,
			);
			bindCurveGeometryTextures(gl, dispatchResources);
			gl.bindVertexArray(dispatchResources.vertexArray);
			gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, dispatchResources.outputBuffer);
			gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback);
			gl.enable(gl.RASTERIZER_DISCARD);
			gl.beginTransformFeedback(gl.POINTS);
			gl.drawArraysInstanced(gl.POINTS, 0, curveInput.pointsPerCurve + 1, curveInput.curveCount);
			gl.endTransformFeedback();
			gl.disable(gl.RASTERIZER_DISCARD);
			gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
			gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
			gl.bindVertexArray(null);
			gl.finish();
			return undefined;
		},
	);

	const diagnostics: DatasetDiagnostic[] = [];
	const readback = readBackFloat32Buffer(
		gl,
		gl.TRANSFORM_FEEDBACK_BUFFER,
		dispatchResources.outputBuffer,
		curveInput.curveCount * (curveInput.pointsPerCurve + 1) * 4,
	);
	if (readback) {
		diagnostics.push(
			...compareFloat32Buffers(
				'webgl2-curve-geometry',
				curveGeometry.positions,
				readback,
			),
		);
	}

	diagnostics.push(...tagDiagnostics(curvePrecompute.diagnostics, 'webgl2'));
	return { timing, diagnostics };
}

function bindCurveGeometryTextures(
	gl: WebGL2RenderingContext,
	resources: WebGl2CurveGeometryDispatchResources,
): void {
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, resources.curveControlPointsEcefTexture);
	const controlPointsLocation = gl.getUniformLocation(resources.program, 'u_curveControlPointsEcef');
	const thetaLocation = gl.getUniformLocation(resources.program, 'u_curveThetaRadians');
	const speedRatioLocation = gl.getUniformLocation(resources.program, 'u_curveSpeedRatio');
	const idsLocation = gl.getUniformLocation(resources.program, 'u_curveIds');
	if (!controlPointsLocation || !thetaLocation || !speedRatioLocation || !idsLocation) {
		throw new Error('WebGL2 curve geometry uniform lookup failed');
	}
	gl.uniform1i(controlPointsLocation, 0);

	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, resources.curveThetaRadiansTexture);
	gl.uniform1i(thetaLocation, 1);

	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, resources.curveSpeedRatioTexture);
	gl.uniform1i(speedRatioLocation, 2);

	gl.activeTexture(gl.TEXTURE3);
	gl.bindTexture(gl.TEXTURE_2D, resources.curveIdsTexture);
	gl.uniform1i(idsLocation, 3);
}

function curvePositionToCode(position: 'above' | 'below' | 'below-when-possible' | 'stick-to-cone'): number {
	switch (position) {
		case 'above':
			return 0;
		case 'below':
			return 1;
		case 'below-when-possible':
			return 2;
		case 'stick-to-cone':
			return 3;
	}
}

function tagDiagnostics<T extends { severity: 'warning' | 'error'; code: string; profile?: string }>(
	diagnostics: readonly T[],
	profile: string,
): T[] {
	return diagnostics.map((diagnostic) =>
		diagnostic.profile === profile ? diagnostic : { ...diagnostic, profile },
	);
}
