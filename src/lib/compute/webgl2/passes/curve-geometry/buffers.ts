import type {
	WebGl2CurveGeometryDispatchInput,
	WebGl2CurveGeometryDispatchResources,
} from '../../buffers';
import {
	createFloatTexture2D,
	createIntTexture2D,
	packScalarsAsRgba,
	packScalarsAsUintRgba,
} from '../shared/resource-helpers';

/** Creates the GPU allocations required by the final curve WebGL2 pass. */
export function createCurveGeometryDispatchResources(
	gl: WebGL2RenderingContext,
	program: WebGLProgram,
	input: WebGl2CurveGeometryDispatchInput,
): WebGl2CurveGeometryDispatchResources {
	const vertexArray = gl.createVertexArray();
	const curveControlPointsEcefTexture = createFloatTexture2D(
		gl,
		gl.RGBA32F,
		gl.RGBA,
		4,
		input.curveCount,
		input.curveControlPointsEcef,
	);
	const curveThetaRadiansTexture = createFloatTexture2D(
		gl,
		gl.RGBA32F,
		gl.RGBA,
		input.curveCount,
		1,
		packScalarsAsRgba(input.curveThetaRadians),
	);
	const curveSpeedRatioTexture = createFloatTexture2D(
		gl,
		gl.RGBA32F,
		gl.RGBA,
		input.curveCount,
		1,
		packScalarsAsRgba(input.curveSpeedRatio),
	);
	const curveIdsTexture = createIntTexture2D(
		gl,
		gl.R32UI,
		gl.RED_INTEGER,
		gl.UNSIGNED_INT,
		input.curveCount,
		1,
		packScalarsAsUintRgba(input.curveIds),
	);
	const outputBuffer = gl.createBuffer();
	const uniformLocation = gl.getUniformLocation(program, 'u_uniforms');
	const projectionUniformLocation = gl.getUniformLocation(program, 'u_projection');
	const projectionSettingsALocation = gl.getUniformLocation(program, 'u_projection_settings_a');
	const projectionSettingsBLocation = gl.getUniformLocation(program, 'u_projection_settings_b');
	if (
		!vertexArray ||
		!outputBuffer ||
		!uniformLocation ||
		!projectionUniformLocation ||
		!projectionSettingsALocation ||
		!projectionSettingsBLocation
	) {
		throw new Error('WebGL2 curve geometry resource allocation failed');
	}

	const outputCount = Math.max(input.curveCount * (input.pointsPerCurve + 1), 1);

	gl.bindVertexArray(vertexArray);
	gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, outputBuffer);
	gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, outputCount * 4 * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_COPY);
	gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);
	gl.bindVertexArray(null);

	return {
		vertexArray,
		program,
		curveControlPointsEcefTexture,
		curveThetaRadiansTexture,
		curveSpeedRatioTexture,
		curveIdsTexture,
		outputBuffer,
		uniformLocation,
		projectionUniformLocation,
		projectionSettingsALocation,
		projectionSettingsBLocation,
		curveControlPointsEcefContract: {
			name: 'curveControlPointsEcef',
			elementType: 'float32',
			strideBytes: 16 * Float32Array.BYTES_PER_ELEMENT,
			count: input.curveCount,
			linearUnit: 'meters',
			coordinateOrder: 'ecef',
			notes: ['Packed [A, P, Q, B] control points per curve'],
		},
		curveThetaRadiansContract: {
			name: 'curveThetaRadians',
			elementType: 'float32',
			strideBytes: Float32Array.BYTES_PER_ELEMENT,
			count: input.curveCount,
			angularUnit: 'radians',
			notes: ['Great-circle angular distance per curve'],
		},
		curveSpeedRatioContract: {
			name: 'curveSpeedRatio',
			elementType: 'float32',
			strideBytes: Float32Array.BYTES_PER_ELEMENT,
			count: input.curveCount,
			notes: ['Yearly ratio maxSpeed / curveSpeed per curve'],
		},
		curveIdsContract: {
			name: 'curveIds',
			elementType: 'uint32',
			strideBytes: Uint32Array.BYTES_PER_ELEMENT,
			count: input.curveCount,
			notes: ['Stable curve ids for traceability'],
		},
		outputContract: {
			name: 'curveVertexPositions',
			elementType: 'float32',
			strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
			count: input.curveCount * (input.pointsPerCurve + 1),
			linearUnit: 'meters',
			coordinateOrder: 'ecef',
			notes: ['Final curve geometry in display projection space, ready to display'],
		},
	};
}
