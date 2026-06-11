import assert from 'node:assert/strict';
import { expect, test } from 'vitest';

import {
	createWebGl2WorkflowBackendDescriptor,
	probeWebGl2Availability,
	type WebGl2WorkflowBackendOptions,
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
					features: [],
				}),
			},
		],
		geojsonSources: [
			{
				fileName: 'boundaries.geojson',
				geojson: { type: 'FeatureCollection', features: [] },
			},
		],
	};
}

function createFakeCanvas(): WebGl2WorkflowBackendOptions['canvas'] {
	const gl = createFakeGl();
	return {
		getContext: (kind: string) => (kind === 'webgl2' ? gl : null),
	} as unknown as WebGl2WorkflowBackendOptions['canvas'];
}

function createFakeGl(): WebGL2RenderingContext & { calls: { drawCalls: number } } {
	const calls = { drawCalls: 0 };
	const shader = {} as WebGLShader;
	const program = {} as WebGLProgram;
	const buffer = {} as WebGLBuffer;
	const vao = {} as WebGLVertexArrayObject;
	const transformFeedback = {} as WebGLTransformFeedback;
	return {
		calls,
		VERTEX_SHADER: 0x8b31,
		FRAGMENT_SHADER: 0x8b30,
		COMPILE_STATUS: 0x8b81,
		LINK_STATUS: 0x8b82,
		INTERLEAVED_ATTRIBS: 0x8c8c,
		ARRAY_BUFFER: 0x8892,
		TRANSFORM_FEEDBACK_BUFFER: 0x8c8e,
		STATIC_DRAW: 0x88e4,
		DYNAMIC_COPY: 0x88ea,
		POINTS: 0x0000,
		RASTERIZER_DISCARD: 0x8c89,
		TRANSFORM_FEEDBACK: 0x8e22,
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
		getUniformLocation: () => ({} as WebGLUniformLocation),
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
		useProgram: () => {},
		uniform1f: () => {},
		enable: () => {},
		disable: () => {},
		beginTransformFeedback: () => {},
		drawArrays: () => {
			calls.drawCalls += 1;
		},
		endTransformFeedback: () => {},
		finish: () => {},
	} as unknown as WebGL2RenderingContext & { calls: { drawCalls: number } };
}

test('webgl2 probe stays false without a canvas', () => {
	expect(probeWebGl2Availability(undefined)).toBe(false);
	expect(createWebGl2WorkflowBackendDescriptor().isAvailable()).toBe(false);
});

test('webgl2 probe becomes available with a webgl2-capable canvas and the backend keeps the selected profile', async () => {
	const fakeCanvas = createFakeCanvas();
	const descriptor = createWebGl2WorkflowBackendDescriptor({ canvas: fakeCanvas });
	assert.equal(await descriptor.isAvailable(), true);

	const backend = await descriptor.create();
	const result = await backend.run(
		buildMinimalDataset(),
		{ benchmark: true },
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
	expect(result.benchmark.notes.some((note) => note.includes('transform-feedback pass'))).toBe(true);
	expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'webgl2-city-matrix-pass-dispatched')).toBe(true);
	const gl = fakeCanvas.getContext('webgl2') as ReturnType<typeof createFakeGl>;
	expect(gl.calls.drawCalls).toBeGreaterThanOrEqual(1);
});
