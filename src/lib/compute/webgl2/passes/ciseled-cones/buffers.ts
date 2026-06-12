import {
	createFloatTexture2D,
	createIntTexture2D,
} from '../shared/resource-helpers';
import type {
	WebGl2CiseledConesDispatchInput,
	WebGl2CiseledConesDispatchResources,
} from '../../buffers';

/** Creates the GPU allocations required by the ciseled-cones WebGL2 pass. */
export function createCiseledConesDispatchResources(
	gl: WebGL2RenderingContext,
	program: WebGLProgram,
	input: WebGl2CiseledConesDispatchInput,
): WebGl2CiseledConesDispatchResources {
	const vertexArray = gl.createVertexArray();
	const coneIntersectionDistanceMetersBuffer = gl.createBuffer();
	const ciseledConeRimEcefBuffer = gl.createBuffer();
	const uniformLocation = gl.getUniformLocation(program, 'u_uniforms');
	if (!vertexArray || !coneIntersectionDistanceMetersBuffer || !ciseledConeRimEcefBuffer || !uniformLocation) {
		throw new Error('WebGL2 ciseled cones resource allocation failed');
	}

	const outputCount = Math.max(input.cityCount * input.azimuthSampleCount, 1);
	const matrixCount = Math.max(input.cityCount, 1);
	const candidateTextureWidth = Math.max(input.neighborLimit, 1);
	const candidateTextureHeight = matrixCount;
	const rimTextureWidth = outputCount;

	const cityMatricesTexture = createFloatTexture2D(
		gl,
		gl.RGBA32F,
		gl.RGBA,
		4,
		matrixCount,
		input.cityNed2EcefMatrices.length > 0
			? input.cityNed2EcefMatrices
			: new Float32Array(matrixCount * 16),
	);
	const overlapCandidatesTexture = createIntTexture2D(
		gl,
		gl.R32UI,
		gl.RED_INTEGER,
		gl.UNSIGNED_INT,
		candidateTextureWidth,
		candidateTextureHeight,
		input.overlapCandidates.length > 0
			? input.overlapCandidates
			: new Uint32Array(candidateTextureWidth * candidateTextureHeight),
	);
	const overlapCandidateCountsTexture = createIntTexture2D(
		gl,
		gl.R32UI,
		gl.RED_INTEGER,
		gl.UNSIGNED_INT,
		matrixCount,
		1,
		input.overlapCandidateCounts.length > 0
			? input.overlapCandidateCounts
			: new Uint32Array(matrixCount),
	);
	const rawConeRimEcefTexture = createFloatTexture2D(
		gl,
		gl.RGBA32F,
		gl.RGBA,
		rimTextureWidth,
		1,
		input.rawConeRimEcef.length > 0
			? input.rawConeRimEcef
			: new Float32Array(rimTextureWidth * 4),
	);

	gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, coneIntersectionDistanceMetersBuffer);
	gl.bufferData(
		gl.TRANSFORM_FEEDBACK_BUFFER,
		outputCount * Float32Array.BYTES_PER_ELEMENT,
		gl.DYNAMIC_COPY,
	);
	gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, ciseledConeRimEcefBuffer);
	gl.bufferData(
		gl.TRANSFORM_FEEDBACK_BUFFER,
		outputCount * 4 * Float32Array.BYTES_PER_ELEMENT,
		gl.DYNAMIC_COPY,
	);
	gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);
	gl.bindVertexArray(vertexArray);
	gl.bindVertexArray(null);

	return {
		vertexArray,
		program,
		cityMatricesTexture,
		overlapCandidatesTexture,
		overlapCandidateCountsTexture,
		rawConeRimEcefTexture,
		coneIntersectionDistanceMetersBuffer,
		ciseledConeRimEcefBuffer,
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
		overlapCandidatesContract: {
			name: 'overlapCandidates',
			elementType: 'uint32',
			strideBytes: Uint32Array.BYTES_PER_ELEMENT,
			count: input.overlapCandidates.length,
			notes: ['Dense overlap candidates sampled as a R32UI texture'],
		},
		overlapCandidateCountsContract: {
			name: 'overlapCandidateCounts',
			elementType: 'uint32',
			strideBytes: Uint32Array.BYTES_PER_ELEMENT,
			count: input.overlapCandidateCounts.length,
			notes: ['Number of valid overlap candidates retained for every city'],
		},
		rawConeRimEcefContract: {
			name: 'rawConeRimEcef',
			elementType: 'float32',
			strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
			count: input.rawConeRimEcef.length / 4,
			linearUnit: 'meters',
			coordinateOrder: 'ecef',
			notes: ['Raw cone rims sampled as a RGBA32F texture'],
		},
		coneIntersectionDistanceMetersContract: {
			name: 'coneIntersectionDistanceMeters',
			elementType: 'float32',
			strideBytes: Float32Array.BYTES_PER_ELEMENT,
			count: outputCount,
			linearUnit: 'meters',
			notes: ['Minimum ciseled intersection distance per ray'],
		},
		ciseledConeRimEcefContract: {
			name: 'ciseledConeRimEcef',
			elementType: 'float32',
			strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
			count: outputCount,
			linearUnit: 'meters',
			coordinateOrder: 'ecef',
			notes: ['Ciseled rim positions retained after cone/cone clipping'],
		},
	};
}
