import { expect, test } from 'vitest';

import { runWebGpuBoundaryRaycastPass } from '$lib/compute/webgpu/passes/boundary-algebre';
import type { ComputeResult } from '$lib/compute/core';
import type { WebGpuComputeContext, WebGpuComputeResources } from '$lib/compute/webgpu/types';

type FakeGpuBuffer = {
	data: ArrayBuffer;
	mapAsync: () => Promise<void>;
	getMappedRange: () => ArrayBuffer;
	unmap: () => void;
	destroy: () => void;
};

function createFakeDevice(): { device: GPUDevice; queue: { submit: () => void; writeBuffer: (buffer: FakeGpuBuffer, offset: number, data: ArrayBufferView) => void } } {
	const queue = {
		submit: () => {},
		writeBuffer: (buffer: FakeGpuBuffer, offset: number, data: ArrayBufferView) => {
			const bytes = new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
			new Uint8Array(buffer.data).set(bytes, offset);
		},
	};
	const device = {
		queue,
		createBuffer: (init: { size: number; usage: number }) => {
			const buffer: FakeGpuBuffer = {
				data: new ArrayBuffer(init.size),
				mapAsync: async () => {},
				getMappedRange: () => buffer.data,
				unmap: () => {},
				destroy: () => {},
			};
			return buffer as unknown as GPUBuffer;
		},
		createShaderModule: () => ({} as GPUShaderModule),
		createComputePipelineAsync: async () => ({
			getBindGroupLayout: () => ({} as GPUBindGroupLayout),
		}),
		createBindGroup: () => ({} as GPUBindGroup),
		createCommandEncoder: () =>
			({
				copyBufferToBuffer: (source: FakeGpuBuffer, sourceOffset: number, destination: FakeGpuBuffer, destinationOffset: number, size: number) => {
					const sourceBytes = new Uint8Array(source.data, sourceOffset, size);
					new Uint8Array(destination.data).set(sourceBytes, destinationOffset);
				},
				finish: () => ({} as GPUCommandBuffer),
				beginComputePass: () =>
					({
						setPipeline: () => {},
						setBindGroup: () => {},
						dispatchWorkgroups: () => {},
						end: () => {},
					}) as unknown as GPUComputePassEncoder,
			}) as unknown as GPUCommandEncoder,
	} as unknown as GPUDevice;

	return { device, queue };
}

function buildMinimalResult(): ComputeResult {
	return {
		selection: {
			selected: 'webgpu',
			fallbackUsed: false,
			capabilities: {
				webgpuAvailable: true,
				webgl2Available: false,
				cpuAvailable: true,
				notes: ['webgpu'],
			},
		},
		inspectedFiles: [],
		baseNetwork: {} as ComputeResult['baseNetwork'],
		preparedDataset: {
			cityCount: 1,
			cityLonLatRadians: new Float32Array([0, 0]),
			speedTimeline: { span: { beginYear: 2000 } },
		} as ComputeResult['preparedDataset'],
		geojsonRuns: [
			{
				fileName: 'boundaries.geojson',
				geojson: { type: 'FeatureCollection', features: [] },
				boundaryPrecompute: {
					contours: [],
					countryGeometries: [],
					countryContourBuffer: new Float32Array([0, 0]),
					countryContourNVectorBuffer: new Float32Array([1, 0, 0, 1]),
					countryContourOffsets: new Int32Array([0]),
					countryContourSizes: new Int32Array([4]),
					cityContourIndexes: new Int32Array([0]),
					townCountryIndexes: new Int32Array([0]),
					townCountryAssociations: [],
					azimuthSampleCount: 1,
					diagnostics: [],
				},
				boundaryRaycast: {
					townBoundaryAngular: new Float32Array([0, 0, 0, 1]),
					townBoundaryEcef: new Float32Array([0, 0, 0, 1]),
					azimuthIntervalCount: 1,
					diagnostics: [],
				},
			},
		] as ComputeResult['geojsonRuns'],
		staticTown: {
			cityCount: 1,
			cityNed2EcefMatrices: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1]),
		} as ComputeResult['staticTown'],
		dynamicTown: undefined,
		rawCones: undefined,
		coneIntersections: undefined,
		curveGeometry: undefined,
		diagnostics: [],
		benchmark: {
			profile: 'webgpu',
			timings: [],
			totalDurationMs: 0,
			notes: [],
		},
	};
}

test('webgpu boundary readback comparison reports mismatches when the buffer diverges', async () => {
	const { device } = createFakeDevice();
	const context = {
		device,
		queue: device.queue,
		selection: {
			selected: 'webgpu',
			fallbackUsed: false,
			capabilities: {
				webgpuAvailable: true,
				webgl2Available: false,
				cpuAvailable: true,
				notes: ['webgpu'],
			},
		},
	} as unknown as WebGpuComputeContext;
	const resources = {
		shaderModuleCache: new Map([['boundary-algebre', {} as GPUShaderModule]]),
		pipelineCache: new Map(),
		bindGroupCache: new Map(),
	} as unknown as WebGpuComputeResources;
	const geojsonRun = buildMinimalResult().geojsonRuns[0];

	const output = await runWebGpuBoundaryRaycastPass({
		context,
		result: buildMinimalResult(),
		geojsonRun,
		resources,
	});

	expect(output.diagnostics.some((diagnostic) => diagnostic.code === 'webgpu-boundary-angular-mismatch')).toBe(true);
});
