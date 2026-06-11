import type { ComputeGpuBufferContract } from '../gpu';

/** WebGL2 resources required by the city NED-to-ECEF fallback pass. */
export interface WebGl2CityNed2EcefDispatchResources {
	readonly vertexArray: WebGLVertexArrayObject;
	readonly inputBuffer: WebGLBuffer;
	readonly outputBuffer: WebGLBuffer;
	readonly program: WebGLProgram;
	readonly uniformLocation: WebGLUniformLocation;
	readonly inputContract: ComputeGpuBufferContract;
	readonly outputContract: ComputeGpuBufferContract;
}

/** Input bundle required by the WebGL2 boundary raycast fallback pass. */
export interface WebGl2BoundaryAlgebreDispatchInput {
	readonly cityNed2EcefMatrices: Float32Array;
	readonly cityContourIndexes: Int32Array;
	readonly countryContourNVectorBuffer: Float32Array;
	readonly countryContourOffsets: Int32Array;
	readonly countryContourSizes: Int32Array;
	readonly azimuthIntervals: Float32Array;
	readonly cityCount: number;
	readonly azimuthIntervalCount: number;
	readonly contourCount: number;
	readonly earthRadiusMeters: number;
}

/** WebGL2 resources required by the boundary raycast fallback pass. */
export interface WebGl2BoundaryAlgebreDispatchResources {
	readonly vertexArray: WebGLVertexArrayObject;
	readonly program: WebGLProgram;
	readonly cityMatricesTexture: WebGLTexture;
	readonly cityContourIndexesTexture: WebGLTexture;
	readonly contourNVectorsTexture: WebGLTexture;
	readonly contourOffsetsTexture: WebGLTexture;
	readonly contourSizesTexture: WebGLTexture;
	readonly azimuthIntervalsTexture: WebGLTexture;
	readonly angularOutputBuffer: WebGLBuffer;
	readonly ecefOutputBuffer: WebGLBuffer;
	readonly uniformLocation: WebGLUniformLocation;
	readonly cityMatricesContract: ComputeGpuBufferContract;
	readonly cityContourIndexesContract: ComputeGpuBufferContract;
	readonly contourNVectorsContract: ComputeGpuBufferContract;
	readonly contourOffsetsContract: ComputeGpuBufferContract;
	readonly contourSizesContract: ComputeGpuBufferContract;
	readonly azimuthIntervalsContract: ComputeGpuBufferContract;
	readonly angularOutputContract: ComputeGpuBufferContract;
	readonly ecefOutputContract: ComputeGpuBufferContract;
}

/** Compiles the WebGL2 transform-feedback program for city NED-to-ECEF matrices. */
export function createCityNed2EcefProgram(
	gl: WebGL2RenderingContext,
	vertexShaderSource: string,
): WebGLProgram {
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
	const program = gl.createProgram();
	if (!program) {
		throw new Error('WebGL2 city NED-to-ECEF program creation failed');
	}
	gl.attachShader(program, vertexShader);
	gl.transformFeedbackVaryings(program, ['tf_col0', 'tf_col1', 'tf_col2', 'tf_col3'], gl.INTERLEAVED_ATTRIBS);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const message = gl.getProgramInfoLog(program) ?? 'unknown WebGL2 link error';
		gl.deleteProgram(program);
		throw new Error(`WebGL2 city NED-to-ECEF program link failed: ${message}`);
	}
	gl.deleteShader(vertexShader);
	return program;
}

/** Compiles the WebGL2 transform-feedback program for boundary raycasting. */
export function createBoundaryAlgebreProgram(
	gl: WebGL2RenderingContext,
	vertexShaderSource: string,
): WebGLProgram {
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
	const program = gl.createProgram();
	if (!program) {
		throw new Error('WebGL2 boundary raycast program creation failed');
	}
	gl.attachShader(program, vertexShader);
	gl.transformFeedbackVaryings(program, ['tf_boundaryAngular', 'tf_boundaryEcef'], gl.SEPARATE_ATTRIBS);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const message = gl.getProgramInfoLog(program) ?? 'unknown WebGL2 link error';
		gl.deleteProgram(program);
		throw new Error(`WebGL2 boundary raycast program link failed: ${message}`);
	}
	gl.deleteShader(vertexShader);
	return program;
}

/** Creates the GPU allocations required by the city NED-to-ECEF pass. */
export function createCityNed2EcefDispatchResources(
	gl: WebGL2RenderingContext,
	program: WebGLProgram,
	cityLonLatRadians: Float32Array,
	cityCount: number,
	earthRadiusMeters: number,
): WebGl2CityNed2EcefDispatchResources {
	const inputBuffer = gl.createBuffer();
	const outputBuffer = gl.createBuffer();
	const vertexArray = gl.createVertexArray();
	const uniformLocation = gl.getUniformLocation(program, 'u_earthRadiusMeters');
	if (!inputBuffer || !outputBuffer || !vertexArray || !uniformLocation) {
		throw new Error('WebGL2 city NED-to-ECEF resource allocation failed');
	}

	gl.bindVertexArray(vertexArray);

	gl.bindBuffer(gl.ARRAY_BUFFER, inputBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, cityLonLatRadians, gl.STATIC_DRAW);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

	gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, outputBuffer);
	gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, cityCount * 16 * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_COPY);

	gl.bindVertexArray(null);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);

	return {
		vertexArray,
		inputBuffer,
		outputBuffer,
		program,
		uniformLocation,
		inputContract: {
			name: 'cityLonLatRadians',
			elementType: 'float32',
			strideBytes: 2 * Float32Array.BYTES_PER_ELEMENT,
			count: cityCount,
			angularUnit: 'radians',
			coordinateOrder: 'longitude-latitude',
			notes: ['PreparedDataset.cityLonLatRadians input for WebGL2 city NED-to-ECEF'],
		},
		outputContract: {
			name: 'cityNed2EcefMatrices',
			elementType: 'float32',
			strideBytes: 16 * Float32Array.BYTES_PER_ELEMENT,
			count: cityCount,
			linearUnit: 'meters',
			coordinateOrder: 'ecef',
			notes: ['Column-major NED-to-ECEF matrices per city captured with transform feedback'],
		},
	};
}

/** Creates the GPU allocations required by the boundary raycast pass. */
export function createBoundaryAlgebreDispatchResources(
	gl: WebGL2RenderingContext,
	program: WebGLProgram,
	input: WebGl2BoundaryAlgebreDispatchInput,
): WebGl2BoundaryAlgebreDispatchResources {
	const outputCount = input.cityCount * input.azimuthIntervalCount;
	const vertexArray = gl.createVertexArray();
	const angularOutputBuffer = gl.createBuffer();
	const ecefOutputBuffer = gl.createBuffer();
	const uniformLocation = gl.getUniformLocation(program, 'u_uniforms');
	if (!vertexArray || !angularOutputBuffer || !ecefOutputBuffer || !uniformLocation) {
		throw new Error('WebGL2 boundary raycast resource allocation failed');
	}

	const cityMatricesTexture = createFloatTexture2D(
		gl,
		gl.RGBA32F,
		gl.RGBA,
		4,
		Math.max(input.cityCount, 1),
		input.cityNed2EcefMatrices.length > 0
			? input.cityNed2EcefMatrices
			: new Float32Array(Math.max(input.cityCount, 1) * 16),
	);
	const cityContourIndexesTexture = createIntTexture2D(
		gl,
		gl.R32I,
		gl.RED_INTEGER,
		gl.INT,
		Math.max(input.cityCount, 1),
		1,
		input.cityContourIndexes.length > 0 ? input.cityContourIndexes : new Int32Array(Math.max(input.cityCount, 1)),
	);
	const contourNVectorsTexture = createFloatTexture2D(
		gl,
		gl.RGBA32F,
		gl.RGBA,
		Math.max(input.countryContourNVectorBuffer.length / 4, 1),
		1,
		input.countryContourNVectorBuffer.length > 0
			? input.countryContourNVectorBuffer
			: new Float32Array(Math.max(input.countryContourNVectorBuffer.length / 4, 1) * 4),
	);
	const contourOffsetsTexture = createIntTexture2D(
		gl,
		gl.R32I,
		gl.RED_INTEGER,
		gl.INT,
		Math.max(input.countryContourOffsets.length, 1),
		1,
		input.countryContourOffsets.length > 0
			? input.countryContourOffsets
			: new Int32Array(Math.max(input.countryContourOffsets.length, 1)),
	);
	const contourSizesTexture = createIntTexture2D(
		gl,
		gl.R32I,
		gl.RED_INTEGER,
		gl.INT,
		Math.max(input.countryContourSizes.length, 1),
		1,
		input.countryContourSizes.length > 0
			? input.countryContourSizes
			: new Int32Array(Math.max(input.countryContourSizes.length, 1)),
	);
	const azimuthIntervalsTexture = createFloatTexture2D(
		gl,
		gl.RG32F,
		gl.RG,
		Math.max(input.azimuthIntervals.length / 2, 1),
		1,
		input.azimuthIntervals.length > 0
			? input.azimuthIntervals
			: new Float32Array(Math.max(input.azimuthIntervalCount, 1) * 2),
	);

	gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, angularOutputBuffer);
	gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, Math.max(outputCount, 1) * 4 * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_COPY);
	gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, ecefOutputBuffer);
	gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, Math.max(outputCount, 1) * 4 * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_COPY);
	gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);

	gl.bindVertexArray(vertexArray);
	gl.bindVertexArray(null);

	return {
		vertexArray,
		program,
		cityMatricesTexture,
		cityContourIndexesTexture,
		contourNVectorsTexture,
		contourOffsetsTexture,
		contourSizesTexture,
		azimuthIntervalsTexture,
		angularOutputBuffer,
		ecefOutputBuffer,
		uniformLocation,
		cityMatricesContract: {
			name: 'cityNed2EcefMatrices',
			elementType: 'float32',
			strideBytes: 16 * Float32Array.BYTES_PER_ELEMENT,
			count: input.cityCount,
			linearUnit: 'meters',
			coordinateOrder: 'ecef',
			notes: ['Column-major NED-to-ECEF matrices per city sampled as a RGBA32F texture'],
		},
		cityContourIndexesContract: {
			name: 'cityContourIndexes',
			elementType: 'int32',
			strideBytes: Int32Array.BYTES_PER_ELEMENT,
			count: input.cityCount,
			notes: ['Dense city-to-contour association; -1 means no contour'],
		},
		contourNVectorsContract: {
			name: 'countryContourNVectorBuffer',
			elementType: 'float32',
			strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
			count: input.countryContourNVectorBuffer.length / 4,
			linearUnit: 'unitless',
			coordinateOrder: 'ecef',
			notes: ['Contour vertices converted to unit n-vectors sampled as a RGBA32F texture'],
		},
		contourOffsetsContract: {
			name: 'countryContourOffsets',
			elementType: 'int32',
			strideBytes: Int32Array.BYTES_PER_ELEMENT,
			count: input.countryContourOffsets.length,
			notes: ['Start offset of each contour in the packed contour buffers'],
		},
		contourSizesContract: {
			name: 'countryContourSizes',
			elementType: 'int32',
			strideBytes: Int32Array.BYTES_PER_ELEMENT,
			count: input.countryContourSizes.length,
			notes: ['Number of points per retained contour'],
		},
		azimuthIntervalsContract: {
			name: 'azimuthIntervals',
			elementType: 'float32',
			strideBytes: 2 * Float32Array.BYTES_PER_ELEMENT,
			count: input.azimuthIntervalCount,
			angularUnit: 'radians',
			notes: ['Packed as [minRadians, maxRadians] in an RG32F texture'],
		},
		angularOutputContract: {
			name: 'townBoundaryAngular',
			elementType: 'float32',
			strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
			count: outputCount,
			angularUnit: 'radians',
			notes: ['[longitudeRadians, latitudeRadians, angularDistanceRadians, validFlag]'],
		},
		ecefOutputContract: {
			name: 'townBoundaryEcef',
			elementType: 'float32',
			strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
			count: outputCount,
			linearUnit: 'meters',
			coordinateOrder: 'ecef',
			notes: ['[xMeters, yMeters, zMeters, validFlag]'],
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
	return createTexture2D(gl, internalFormat, width, height, format, gl.FLOAT, data);
}

function createIntTexture2D(
	gl: WebGL2RenderingContext,
	internalFormat: number,
	format: number,
	type: number,
	width: number,
	height: number,
	data: Int32Array,
): WebGLTexture {
	return createTexture2D(gl, internalFormat, width, height, format, type, data);
}

function createTexture2D(
	gl: WebGL2RenderingContext,
	internalFormat: number,
	width: number,
	height: number,
	format: number,
	type: number,
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

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) {
		throw new Error('WebGL2 shader creation failed');
	}
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const message = gl.getShaderInfoLog(shader) ?? 'unknown WebGL2 compile error';
		gl.deleteShader(shader);
		throw new Error(`WebGL2 shader compile failed: ${message}`);
	}
	return shader;
}
