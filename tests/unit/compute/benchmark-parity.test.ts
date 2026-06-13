import { expect, test } from 'vitest';

import {
	createCpuComputeBackend,
	createWebGl2ComputeBackendDescriptor,
	createWebGpuComputeBackendDescriptor,
} from '$lib/compute';

import type { SourceFile } from '$lib/domain/data';

function csv(name: string, text: string): SourceFile {
	return { name, text: text.trim() };
}

function buildDataset(): { sourceFiles: SourceFile[]; geojsonSources: { fileName: string; geojson: GeoJSON.FeatureCollection }[] } {
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

function createFakeGl(): WebGL2RenderingContext {
	const shader = {} as WebGLShader;
	const program = {} as WebGLProgram;
	const buffer = {} as WebGLBuffer;
	const vao = {} as WebGLVertexArrayObject;
	const transformFeedback = {} as WebGLTransformFeedback;
	const texture = {} as WebGLTexture;
	const uniformLocation = {} as WebGLUniformLocation;
	return {
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
			if (output instanceof Float32Array) {
				output.fill(0);
			}
		},
		enable: () => {},
		disable: () => {},
		beginTransformFeedback: () => {},
		drawArrays: () => {},
		drawArraysInstanced: () => {},
		endTransformFeedback: () => {},
		finish: () => {},
	} as unknown as WebGL2RenderingContext;
}

function createFakeDevice(): GPUDevice {
	const queue = {
		submit: () => {},
		writeBuffer: () => {},
	} as unknown as GPUQueue;
	const pipeline = {
		getBindGroupLayout: () => ({} as GPUBindGroupLayout),
	} as unknown as GPUComputePipeline;
	return {
		queue,
		createBuffer: () => ({
			mapAsync: async () => {},
			getMappedRange: () => new ArrayBuffer(4),
			unmap: () => {},
			destroy: () => {},
		} as unknown as GPUBuffer),
		createShaderModule: () => ({} as GPUShaderModule),
		createComputePipelineAsync: async () => pipeline,
		createBindGroup: () => ({} as GPUBindGroup),
		createCommandEncoder: () =>
			({
				copyBufferToBuffer: () => {},
				beginComputePass: () =>
					({
						setPipeline: () => {},
						setBindGroup: () => {},
						dispatchWorkgroups: () => {},
						end: () => {},
					}) as unknown as GPUComputePassEncoder,
				finish: () => ({} as GPUCommandBuffer),
			}) as unknown as GPUCommandEncoder,
	} as unknown as GPUDevice;
}

test('benchmark reports remain comparable across cpu, webgl2 and webgpu', async () => {
	const input = buildDataset();
	const cpuBackend = createCpuComputeBackend();
	const cpuResult = await cpuBackend.computeFrame(
		input,
		{
			profileRequest: { forced: 'cpu' },
			boundaryRaycast: { azimuthSampleCount: 8 },
			staticTown: { sectorCount: 8, neighborLimit: 1 },
			dynamicYear: 2000,
			rawCone: { shape: 'road', azimuthSampleCount: 8, coneLengthMeters: 100000 },
			coneIntersection: { enabled: true, strategy: 'oracle' },
		},
	);

	const webgl2Backend = await createWebGl2ComputeBackendDescriptor({ canvas: { getContext: (kind: string) => (kind === 'webgl2' ? createFakeGl() : null) } as HTMLCanvasElement }).create();
	const webgl2Result = await webgl2Backend.computeFrame(
		input,
		{
			profileRequest: { forced: 'webgl2' },
			boundaryRaycast: { azimuthSampleCount: 8 },
			staticTown: { sectorCount: 8, neighborLimit: 1 },
			dynamicYear: 2000,
			rawCone: { shape: 'road', azimuthSampleCount: 8, coneLengthMeters: 100000 },
			coneIntersection: { enabled: true },
		},
	);

	const webgpuBackend = await createWebGpuComputeBackendDescriptor({ device: createFakeDevice() }).create();
	const webgpuResult = await webgpuBackend.computeFrame(
		input,
		{
			profileRequest: { forced: 'webgpu' },
			boundaryRaycast: { azimuthSampleCount: 8 },
			staticTown: { sectorCount: 8, neighborLimit: 1 },
			dynamicYear: 2000,
			rawCone: { shape: 'road', azimuthSampleCount: 8, coneLengthMeters: 100000 },
			coneIntersection: { enabled: true },
		},
	);

	for (const result of [cpuResult, webgl2Result, webgpuResult]) {
		expect(result.benchmark.totalDurationMs).toBeGreaterThanOrEqual(0);
		expect(result.benchmark.timings.some((timing) => timing.stage === 'csv-ingestion')).toBe(true);
		expect(result.benchmark.timings.some((timing) => timing.stage === 'prepared-dataset')).toBe(true);
		expect(result.benchmark.timings.some((timing) => timing.stage === 'static-town-precompute')).toBe(true);
		expect(result.benchmark.timings.some((timing) => timing.stage === 'raw-cones-precompute')).toBe(true);
		expect(result.benchmark.timings.some((timing) => timing.stage === 'cone-intersections-precompute')).toBe(true);
	}

	expect(cpuResult.benchmark.timings.map((timing) => timing.stage)).toContain('geojson-boundary-precompute');
	expect(webgl2Result.benchmark.timings.map((timing) => timing.stage)).toContain('geojson-boundary-precompute');
	expect(webgpuResult.benchmark.timings.map((timing) => timing.stage)).toContain('geojson-boundary-precompute');
});
