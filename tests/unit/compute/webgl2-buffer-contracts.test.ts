import { expect, test } from 'vitest';

import { createBoundaryAlgebreDispatchResources } from '$lib/compute/webgl2/passes/boundary-algebre/buffers';
import { createCiseledConesDispatchResources } from '$lib/compute/webgl2/passes/ciseled-cones/buffers';
import { createCityNed2EcefDispatchResources } from '$lib/compute/webgl2/passes/city-ned2ecef/buffers';
import { createRawConeAlphasDispatchResources } from '$lib/compute/webgl2/passes/raw-cone-alphas/buffers';

type BufferDataCall = {
	target: number;
	byteLength: number;
	usage: number;
};

function createFakeGl(): WebGL2RenderingContext & { bufferDataCalls: BufferDataCall[] } {
	const bufferDataCalls: BufferDataCall[] = [];
	const shader = {} as WebGLShader;
	const program = {} as WebGLProgram;
	const buffer = {} as WebGLBuffer;
	const vao = {} as WebGLVertexArrayObject;
	const texture = {} as WebGLTexture;
	const uniformLocation = {} as WebGLUniformLocation;
	return {
		bufferDataCalls,
		VERTEX_SHADER: 0x8b31,
		FRAGMENT_SHADER: 0x8b30,
		COMPILE_STATUS: 0x8b81,
		LINK_STATUS: 0x8b82,
		ARRAY_BUFFER: 0x8892,
		TRANSFORM_FEEDBACK_BUFFER: 0x8c8e,
		STATIC_DRAW: 0x88e4,
		DYNAMIC_COPY: 0x88ea,
		TEXTURE_2D: 0x0de1,
		TEXTURE_MIN_FILTER: 0x2801,
		TEXTURE_MAG_FILTER: 0x2800,
		TEXTURE_WRAP_S: 0x2802,
		TEXTURE_WRAP_T: 0x2803,
		TEXTURE0: 0x84c0,
		RGBA32F: 0x8814,
		RG32F: 0x8230,
		R32UI: 0x8236,
		R32I: 0x8235,
		RGBA: 0x1908,
		RG: 0x8227,
		RED_INTEGER: 0x8d94,
		FLOAT: 0x1406,
		INT: 0x1404,
		UNSIGNED_INT: 0x1405,
		UNPACK_ALIGNMENT: 0x0cf5,
		NEAREST: 0x2600,
		CLAMP_TO_EDGE: 0x812f,
		createShader: () => shader,
		shaderSource: () => {},
		compileShader: () => {},
		getShaderParameter: () => true,
		getShaderInfoLog: () => '',
		deleteShader: () => {},
		createProgram: () => program,
		attachShader: () => {},
		transformFeedbackVaryings: () => {},
		linkProgram: () => {},
		getProgramParameter: () => true,
		getProgramInfoLog: () => '',
		deleteProgram: () => {},
		getUniformLocation: () => uniformLocation,
		createBuffer: () => buffer,
		bindBuffer: () => {},
		bufferData: (target: number, dataOrSize: BufferSource | number, usage: number) => {
			bufferDataCalls.push({
				target,
				byteLength: typeof dataOrSize === 'number' ? dataOrSize : dataOrSize.byteLength,
				usage,
			});
		},
		createVertexArray: () => vao,
		bindVertexArray: () => {},
		enableVertexAttribArray: () => {},
		vertexAttribPointer: () => {},
		createTexture: () => texture,
		bindTexture: () => {},
		pixelStorei: () => {},
		texParameteri: () => {},
		texImage2D: () => {},
		activeTexture: () => {},
		uniform1i: () => {},
		uniform1f: () => {},
		uniform4f: () => {},
	} as unknown as WebGL2RenderingContext & { bufferDataCalls: BufferDataCall[] };
}

test('webgl2 city NED-to-ECEF buffer contract keeps the canonical matrix layout', () => {
	const gl = createFakeGl();
	const resources = createCityNed2EcefDispatchResources(
		gl,
		{} as WebGLProgram,
		{
			cityLonLatRadians: new Float32Array([0, 0, 1, 2]),
			cityCount: 2,
			earthRadiusMeters: 6_371_000,
		},
	);

	expect(resources.inputContract.name).toBe('cityLonLatRadians');
	expect(resources.inputContract.angularUnit).toBe('radians');
	expect(resources.inputContract.coordinateOrder).toBe('longitude-latitude');
	expect(resources.outputContract.name).toBe('cityNed2EcefMatrices');
	expect(resources.outputContract.strideBytes).toBe(16 * Float32Array.BYTES_PER_ELEMENT);
	expect(resources.outputContract.linearUnit).toBe('meters');
	expect(gl.bufferDataCalls).toEqual([
		{
			target: gl.ARRAY_BUFFER,
			byteLength: 4 * Float32Array.BYTES_PER_ELEMENT,
			usage: gl.STATIC_DRAW,
		},
		{
			target: gl.TRANSFORM_FEEDBACK_BUFFER,
			byteLength: 2 * 16 * Float32Array.BYTES_PER_ELEMENT,
			usage: gl.DYNAMIC_COPY,
		},
	]);
});

test('webgl2 raw-cone alpha buffer contract stores the canonical uniform layout', () => {
	const gl = createFakeGl();
	const resources = createRawConeAlphasDispatchResources(
		gl,
		{} as WebGLProgram,
		{
			cityLinkOffsets: new Uint32Array([0, 1]),
			cityLinkCounts: new Uint32Array([1, 1]),
			cityLinkAzimuthRadians: new Float32Array([0.1, 0.2]),
			cityLinkAlphaRadians: new Float32Array([0.3, 0.4]),
			cityFastestTerrestrialAlphaRadians: new Float32Array([0.5, 0.6]),
			cityCount: 2,
			azimuthSampleCount: 4,
			roadAlphaRadians: 0.7,
			attenuationRadians: 0.8,
			shape: 'complex',
		},
	);

	expect(resources.cityLinkOffsetsContract.name).toBe('cityLinkOffsets');
	expect(resources.cityLinkAzimuthContract.angularUnit).toBe('radians');
	expect(resources.cityFastestTerrestrialAlphaContract.count).toBe(2);
	expect(resources.outputContract.name).toBe('coneAlphaRadians');
	expect(resources.outputContract.count).toBe(8);
	expect(gl.bufferDataCalls).toHaveLength(1);
	expect(gl.bufferDataCalls[0]).toEqual({
		target: gl.TRANSFORM_FEEDBACK_BUFFER,
		byteLength: 8 * Float32Array.BYTES_PER_ELEMENT,
		usage: gl.DYNAMIC_COPY,
	});
});

test('webgl2 boundary raycast buffer contract stores the canonical uniform layout', () => {
	const gl = createFakeGl();
	const resources = createBoundaryAlgebreDispatchResources(
		gl,
		{} as WebGLProgram,
		{
			cityNed2EcefMatrices: new Float32Array(32),
			cityContourIndexes: new Int32Array([0, -1]),
			countryContourNVectorBuffer: new Float32Array(8),
			countryContourOffsets: new Int32Array([0, 4]),
			countryContourSizes: new Int32Array([4, 4]),
			azimuthIntervals: new Float32Array([0, 1, 1, 2]),
			cityCount: 2,
			azimuthIntervalCount: 2,
			contourCount: 2,
			earthRadiusMeters: 6_371_000,
		},
	);

	expect(resources.cityMatricesContract.name).toBe('cityNed2EcefMatrices');
	expect(resources.cityMatricesContract.coordinateOrder).toBe('ecef');
	expect(resources.azimuthIntervalsContract.angularUnit).toBe('radians');
	expect(resources.angularOutputContract.name).toBe('townBoundaryAngular');
	expect(resources.ecefOutputContract.name).toBe('townBoundaryEcef');
	expect(gl.bufferDataCalls).toEqual([
		{
			target: gl.TRANSFORM_FEEDBACK_BUFFER,
			byteLength: 4 * 4 * Float32Array.BYTES_PER_ELEMENT,
			usage: gl.DYNAMIC_COPY,
		},
		{
			target: gl.TRANSFORM_FEEDBACK_BUFFER,
			byteLength: 4 * 4 * Float32Array.BYTES_PER_ELEMENT,
			usage: gl.DYNAMIC_COPY,
		},
	]);
});

test('webgl2 ciseled cone buffer contract stores the alpha-aware heuristic uniforms', () => {
	const gl = createFakeGl();
	const resources = createCiseledConesDispatchResources(
		gl,
		{} as WebGLProgram,
		{
			cityNed2EcefMatrices: new Float32Array(32),
			overlapCandidates: new Uint32Array([0]),
			overlapCandidateCounts: new Uint32Array([1]),
			rawConeRimEcef: new Float32Array([1, 2, 3, 1]),
			cityPairInvariants: new Float32Array([0.1, 0.2, 0.3, 0]),
			coneAlphaRadians: new Float32Array([0.4]),
			cityCount: 1,
			azimuthSampleCount: 1,
			neighborLimit: 1,
			roadAlphaRadians: 0.5,
			bilateralNeighborhoodFaceCount: 2,
			alphaEpsilonRadians: 1e-6,
		},
	);

	expect(resources.uniformLocation).toBeDefined();
	expect(resources.heuristicUniformLocation).toBeDefined();
	expect(resources.cityPairInvariantsContract.name).toBe('cityPairInvariants');
	expect(resources.coneAlphaRadiansContract.name).toBe('coneAlphaRadians');
	expect(gl.bufferDataCalls).toEqual([
		{
			target: gl.TRANSFORM_FEEDBACK_BUFFER,
			byteLength: 1 * Float32Array.BYTES_PER_ELEMENT,
			usage: gl.DYNAMIC_COPY,
		},
		{
			target: gl.TRANSFORM_FEEDBACK_BUFFER,
			byteLength: 1 * 4 * Float32Array.BYTES_PER_ELEMENT,
			usage: gl.DYNAMIC_COPY,
		},
	]);
});
