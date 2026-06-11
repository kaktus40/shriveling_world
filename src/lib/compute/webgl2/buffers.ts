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
