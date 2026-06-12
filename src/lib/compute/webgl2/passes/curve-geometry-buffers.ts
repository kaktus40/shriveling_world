import type {
	WebGl2CurveGeometryDispatchInput,
	WebGl2CurveGeometryDispatchResources,
} from '../buffers';

/** Creates the GPU allocations required by the curve-geometry WebGL2 pass. */
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
	if (!vertexArray || !outputBuffer || !uniformLocation) {
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
			notes: ['Render-ready curve vertices in ECEF meters'],
		},
	};
}

function createFloatTexture2D(
	gl: WebGL2RenderingContext,
	internalFormat: number,
	format: number,
	width: number,
	height: number,
	data: Float32Array,
): WebGLTexture {
	const texture = gl.createTexture();
	if (!texture) {
		throw new Error('WebGL2 texture creation failed');
	}
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, gl.FLOAT, data);
	gl.bindTexture(gl.TEXTURE_2D, null);
	return texture;
}

function createIntTexture2D(
	gl: WebGL2RenderingContext,
	internalFormat: number,
	format: number,
	type: number,
	width: number,
	height: number,
	data: ArrayBufferView,
): WebGLTexture {
	const texture = gl.createTexture();
	if (!texture) {
		throw new Error('WebGL2 texture creation failed');
	}
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, data);
	gl.bindTexture(gl.TEXTURE_2D, null);
	return texture;
}

function packScalarsAsRgba(values: Float32Array): Float32Array {
	const packed = new Float32Array(values.length * 4);
	for (let index = 0; index < values.length; index += 1) {
		packed[index * 4] = values[index];
	}
	return packed;
}

function packScalarsAsUintRgba(values: Uint32Array): Uint32Array {
	const packed = new Uint32Array(values.length * 4);
	for (let index = 0; index < values.length; index += 1) {
		packed[index * 4] = values[index];
	}
	return packed;
}
