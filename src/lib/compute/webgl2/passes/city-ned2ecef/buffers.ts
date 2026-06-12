import type { WebGl2CityNed2EcefDispatchResources } from '../../buffers';

/** Input bundle required by the city NED-to-ECEF WebGL2 pass. */
export interface WebGl2CityNed2EcefDispatchInput {
	readonly cityLonLatRadians: Float32Array;
	readonly cityCount: number;
	readonly earthRadiusMeters: number;
}

/** Creates the GPU allocations required by the city NED-to-ECEF pass. */
export function createCityNed2EcefDispatchResources(
	gl: WebGL2RenderingContext,
	program: WebGLProgram,
	input: WebGl2CityNed2EcefDispatchInput,
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
	gl.bufferData(gl.ARRAY_BUFFER, input.cityLonLatRadians, gl.STATIC_DRAW);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
	gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, outputBuffer);
	gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, input.cityCount * 16 * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_COPY);
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
			count: input.cityCount,
			angularUnit: 'radians',
			coordinateOrder: 'longitude-latitude',
			notes: ['PreparedDataset.cityLonLatRadians input for WebGL2 city NED-to-ECEF'],
		},
		outputContract: {
			name: 'cityNed2EcefMatrices',
			elementType: 'float32',
			strideBytes: 16 * Float32Array.BYTES_PER_ELEMENT,
			count: input.cityCount,
			linearUnit: 'meters',
			coordinateOrder: 'ecef',
			notes: ['Column-major NED-to-ECEF matrices per city captured with transform feedback'],
		},
	};
}
