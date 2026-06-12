import {
	createFloatTexture2D,
	createIntTexture2D,
} from './resource-helpers';
import type {
	WebGl2BoundaryAlgebreDispatchInput,
	WebGl2BoundaryAlgebreDispatchResources,
} from '../buffers';

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
