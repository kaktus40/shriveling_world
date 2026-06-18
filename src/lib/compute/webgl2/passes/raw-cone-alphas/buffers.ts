import {
	createFloatTexture2D,
	createIntTexture2D,
} from '../shared/resource-helpers';
import type {
	WebGl2RawConeAlphaDispatchInput,
	WebGl2RawConeAlphaDispatchResources,
} from '../../buffers';

import { getOrCreateGlDoubleBuffer } from '../../../phase-c/phase-c';

/** Creates the GPU allocations required by the raw-cone alpha WebGL2 pass. */
export function createRawConeAlphasDispatchResources(
	gl: WebGL2RenderingContext,
	program: WebGLProgram,
	input: WebGl2RawConeAlphaDispatchInput,
): WebGl2RawConeAlphaDispatchResources {
	const vertexArray = gl.createVertexArray();
	const uniformLocation = gl.getUniformLocation(program, 'u_uniforms');
	if (!vertexArray || !uniformLocation) {
		throw new Error('WebGL2 raw-cone alpha resource allocation failed');
	}

	const cityLinkOffsetsTexture = createIntTexture2D(
		gl,
		gl.R32UI,
		gl.RED_INTEGER,
		gl.UNSIGNED_INT,
		Math.max(input.cityCount, 1),
		1,
		input.cityLinkOffsets.length > 0 ? input.cityLinkOffsets : new Uint32Array(Math.max(input.cityCount, 1)),
	);
	const cityLinkCountsTexture = createIntTexture2D(
		gl,
		gl.R32UI,
		gl.RED_INTEGER,
		gl.UNSIGNED_INT,
		Math.max(input.cityCount, 1),
		1,
		input.cityLinkCounts.length > 0 ? input.cityLinkCounts : new Uint32Array(Math.max(input.cityCount, 1)),
	);
	const cityLinkAzimuthTexture = createFloatTexture2D(
		gl,
		gl.R32F,
		gl.RED,
		Math.max(input.cityLinkAzimuthRadians.length, 1),
		1,
		input.cityLinkAzimuthRadians.length > 0
			? input.cityLinkAzimuthRadians
			: new Float32Array(Math.max(input.cityLinkAzimuthRadians.length, 1)),
	);
	const cityLinkAlphaTexture = createFloatTexture2D(
		gl,
		gl.R32F,
		gl.RED,
		Math.max(input.cityLinkAlphaRadians.length, 1),
		1,
		input.cityLinkAlphaRadians.length > 0
			? input.cityLinkAlphaRadians
			: new Float32Array(Math.max(input.cityLinkAlphaRadians.length, 1)),
	);
	const cityFastestTerrestrialAlphaTexture = createFloatTexture2D(
		gl,
		gl.R32F,
		gl.RED,
		Math.max(input.cityFastestTerrestrialAlphaRadians.length, 1),
		1,
		input.cityFastestTerrestrialAlphaRadians.length > 0
			? input.cityFastestTerrestrialAlphaRadians
			: new Float32Array(Math.max(input.cityFastestTerrestrialAlphaRadians.length, 1)),
	);

	const outputCount = Math.max(input.cityCount * input.azimuthSampleCount, 1);
	const outputSet = getOrCreateGlDoubleBuffer(gl, 'webgl2-raw-cone-alphas:coneAlphaRadians', gl.TRANSFORM_FEEDBACK_BUFFER, outputCount * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_COPY);
	const outputBuffer = outputSet.back;
	gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, outputBuffer);
	gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, outputCount * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_COPY);
	gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);
	gl.bindVertexArray(vertexArray);
	gl.bindVertexArray(null);

	return {
		vertexArray,
		program,
		cityLinkOffsetsTexture,
		cityLinkCountsTexture,
		cityLinkAzimuthTexture,
		cityLinkAlphaTexture,
		cityFastestTerrestrialAlphaTexture,
		outputBuffer,
		uniformLocation,
		cityLinkOffsetsContract: {
			name: 'cityLinkOffsets',
			elementType: 'uint32',
			strideBytes: Uint32Array.BYTES_PER_ELEMENT,
			count: input.cityCount,
			notes: ['First compact link offset for every city, sampled as a R32UI texture'],
		},
		cityLinkCountsContract: {
			name: 'cityLinkCounts',
			elementType: 'uint32',
			strideBytes: Uint32Array.BYTES_PER_ELEMENT,
			count: input.cityCount,
			notes: ['Number of compact links retained for every city, sampled as a R32UI texture'],
		},
		cityLinkAzimuthContract: {
			name: 'cityLinkAzimuthRadians',
			elementType: 'float32',
			strideBytes: Float32Array.BYTES_PER_ELEMENT,
			count: input.cityLinkAzimuthRadians.length,
			angularUnit: 'radians',
			notes: ['Forward azimuth of each compact link, sampled as a R32F texture'],
		},
		cityLinkAlphaContract: {
			name: 'cityLinkAlphaRadians',
			elementType: 'float32',
			strideBytes: Float32Array.BYTES_PER_ELEMENT,
			count: input.cityLinkAlphaRadians.length,
			angularUnit: 'radians',
			notes: ['Selected terrestrial alpha of each compact link, sampled as a R32F texture'],
		},
		cityFastestTerrestrialAlphaContract: {
			name: 'cityFastestTerrestrialAlphaRadians',
			elementType: 'float32',
			strideBytes: Float32Array.BYTES_PER_ELEMENT,
			count: input.cityCount,
			angularUnit: 'radians',
			notes: ['Minimum terrestrial alpha per city, sampled as a R32F texture'],
		},
		outputContract: {
			name: 'coneAlphaRadians',
			elementType: 'float32',
			strideBytes: Float32Array.BYTES_PER_ELEMENT,
			count: input.cityCount * input.azimuthSampleCount,
			angularUnit: 'radians',
			notes: ['Selected alpha per city and azimuth sample captured with transform feedback'],
		},
	};
}
