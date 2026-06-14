import assert from 'node:assert/strict';
import { expect, test } from 'vitest';

import {
	createWebGl2ComputeBackendDescriptor,
	createWebGl2ProbeCanvas,
	probeWebGl2Availability,
	type WebGl2ComputeBackendOptions,
} from '$lib/compute';

import type { SourceFile } from '$lib/domain/data';

function csv(name: string, text: string): SourceFile {
	return { name, text: text.trim() };
}

function buildMinimalDataset(): { sourceFiles: SourceFile[]; geojsonSources: { fileName: string; geojson: GeoJSON.FeatureCollection }[] } {
	return {
		sourceFiles: [
			csv(
				'cities.csv',
				`
cityCode,latitude,longitude,radius,cityName
1,0,0,1000,A
2,10,20,1000,B
`
			),
			csv(
				'population.csv',
				`
cityCode,pop1950,pop1960
1,1000,1200
2,2000,2400
`
			),
			csv(
				'transport_modes.csv',
				`
code,name,terrestrial
1,Road,1
2,Rail,1
`
			),
			csv(
				'transport_mode_speeds.csv',
				`
transportModeCode,year,speedKPH
1,2000,100
2,2000,200
`
			),
			csv(
				'transport_network.csv',
				`
cityCodeOri,cityCodeDes,transportModeCode,eYearBegin,eYearEnd
1,2,2,2000,2010
`
			),
			{
				name: 'boundaries.geojson',
				text: JSON.stringify({
					type: 'FeatureCollection',
					features: [
						{
							type: 'Feature',
							properties: { continent: 'test' },
							geometry: {
								type: 'Polygon',
								coordinates: [[
									[-60, -60],
									[60, -60],
									[60, 60],
									[-60, 60],
									[-60, -60],
								]],
							},
						},
					],
				}),
			},
		],
		geojsonSources: [
			{
				fileName: 'boundaries.geojson',
				geojson: {
					type: 'FeatureCollection',
					features: [
						{
							type: 'Feature',
							properties: { continent: 'test' },
							geometry: {
								type: 'Polygon',
								coordinates: [[
									[-60, -60],
									[60, -60],
									[60, 60],
									[-60, 60],
									[-60, -60],
								]],
							},
						},
					],
				},
			},
		],
	};
}

function createFakeCanvas(): NonNullable<WebGl2ComputeBackendOptions['canvas']> {
	const gl = createFakeGl();
	return {
		getContext: (kind: string) => (kind === 'webgl2' ? gl : null),
	} as unknown as NonNullable<WebGl2ComputeBackendOptions['canvas']>;
}

function createFakeGl(): WebGL2RenderingContext & { calls: { drawCalls: number; instancedDrawCalls: number; readbackCalls: number } } {
	const calls = { drawCalls: 0, instancedDrawCalls: 0, readbackCalls: 0 };
	const shader = {} as WebGLShader;
	const program = {} as WebGLProgram;
	const buffer = {} as WebGLBuffer;
	const vao = {} as WebGLVertexArrayObject;
	const transformFeedback = {} as WebGLTransformFeedback;
	const texture = {} as WebGLTexture;
	const uniformLocation = {} as WebGLUniformLocation;
	return {
		calls,
		VERTEX_SHADER: 0x8b31,
		FRAGMENT_SHADER: 0x8b30,
		COMPILE_STATUS: 0x8b81,
		LINK_STATUS: 0x8b82,
		INTERLEAVED_ATTRIBS: 0x8c8c,
		SEPARATE_ATTRIBS: 0x8c8d,
		ARRAY_BUFFER: 0x8892,
		TRANSFORM_FEEDBACK_BUFFER: 0x8c8e,
		STATIC_DRAW: 0x88e4,
		DYNAMIC_COPY: 0x88ea,
		POINTS: 0x0000,
		RASTERIZER_DISCARD: 0x8c89,
		TRANSFORM_FEEDBACK: 0x8e22,
		TEXTURE_2D: 0x0de1,
		TEXTURE0: 0x84c0,
		TEXTURE1: 0x84c1,
		TEXTURE2: 0x84c2,
		TEXTURE3: 0x84c3,
		TEXTURE4: 0x84c4,
		TEXTURE5: 0x84c5,
		NEAREST: 0x2600,
		CLAMP_TO_EDGE: 0x812f,
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
		bufferData: () => {},
		createVertexArray: () => vao,
		bindVertexArray: () => {},
		enableVertexAttribArray: () => {},
		vertexAttribPointer: () => {},
		createTransformFeedback: () => transformFeedback,
		bindTransformFeedback: () => {},
		bindBufferBase: () => {},
		createTexture: () => texture,
		bindTexture: () => {},
		texParameteri: () => {},
		texImage2D: () => {},
		activeTexture: () => {},
		pixelStorei: () => {},
		uniform1i: () => {},
		uniform4f: () => {},
		useProgram: () => {},
		uniform1f: () => {},
		getBufferSubData: (_target: number, _offset: number, output: ArrayBufferView) => {
			calls.readbackCalls += 1;
			if (output instanceof Float32Array) {
				output.fill(1234.5);
			}
		},
		enable: () => {},
		disable: () => {},
		beginTransformFeedback: () => {},
		drawArrays: () => {
			calls.drawCalls += 1;
		},
		drawArraysInstanced: () => {
			calls.instancedDrawCalls += 1;
		},
		endTransformFeedback: () => {},
		finish: () => {},
	} as unknown as WebGL2RenderingContext & { calls: { drawCalls: number; instancedDrawCalls: number; readbackCalls: number } };
}

test('webgl2 probe stays false without a canvas', () => {
	expect(probeWebGl2Availability(undefined)).toBe(false);
	expect(createWebGl2ComputeBackendDescriptor().isAvailable()).toBe(false);
});

test('webgl2 probe prefers a DOM canvas over OffscreenCanvas when both exist', () => {
	const globalAny = globalThis as any;
	const originalDocument = globalAny.document;
	const originalOffscreenCanvas = globalAny.OffscreenCanvas;
	const domCanvas = createFakeCanvas();

	try {
		globalAny.document = {
			createElement: () => domCanvas,
		};
		globalAny.OffscreenCanvas = class {
			getContext(): null {
				return null;
			}
		};

		expect(createWebGl2ProbeCanvas()).toBe(domCanvas);
	} finally {
		globalAny.document = originalDocument;
		globalAny.OffscreenCanvas = originalOffscreenCanvas;
	}
});

test('webgl2 probe becomes available with a webgl2-capable canvas and the backend keeps the selected profile', async () => {
	const fakeCanvas = createFakeCanvas();
	const descriptor = createWebGl2ComputeBackendDescriptor({ canvas: fakeCanvas });
	assert.equal(await descriptor.isAvailable(), true);

	const backend = await descriptor.create();
	const result = await backend.computeFrame(
		buildMinimalDataset(),
		{
			benchmark: true,
			dynamicYear: 2000,
			rawCone: {
				shape: 'road',
				azimuthSampleCount: 8,
				coneLengthMeters: 100000,
			},
			coneIntersection: {
				enabled: true,
			},
		},
		{
			requested: 'webgl2',
			forced: 'webgl2',
			selected: 'webgl2',
			fallbackUsed: false,
			capabilities: {
				webgpuAvailable: false,
				webgl2Available: true,
				cpuAvailable: true,
				notes: ['WebGL2 fallback backend'],
			},
		},
	);

	expect(result.selection.selected).toBe('webgl2');
	expect(result.benchmark.profile).toBe('webgl2');
	expect(result.benchmark.notes.some((note) => note.includes('GeoJSON boundary'))).toBe(true);
	expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'webgl2-city-matrix-pass-dispatched')).toBe(true);
	expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'webgl2-ciseled-cones-pass-dispatched')).toBe(true);
	expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'webgl2-boundary-raycast-pass-dispatched')).toBe(true);
	expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'webgl2-final-cones-pass-dispatched')).toBe(true);
	const gl = fakeCanvas.getContext('webgl2') as ReturnType<typeof createFakeGl>;
	expect(gl.calls.drawCalls).toBeGreaterThanOrEqual(1);
	expect(gl.calls.instancedDrawCalls).toBeGreaterThanOrEqual(4);
	expect(gl.calls.readbackCalls).toBeGreaterThanOrEqual(1);
});
