import { expect, test } from 'vitest';

import { runWebGpuCityMatrixPass } from '$lib/compute/webgpu/passes/city-ned2ecef';
import type { ComputeResult } from '$lib/compute/core';
import type { WebGpuComputeContext, WebGpuComputeResources } from '$lib/compute/webgpu/types';

type FakeGpuBuffer = {
	data: ArrayBuffer;
	mapped: boolean;
	mapAsync: (mode: number) => Promise<void>;
	getMappedRange: () => ArrayBuffer;
	unmap: () => void;
	destroy: () => void;
};

function createFakeDevice(): { device: GPUDevice; queue: { submit: () => void; writeBuffer: (buffer: FakeGpuBuffer, offset: number, data: ArrayBufferView) => void }; buffers: FakeGpuBuffer[] } {
	const buffers: FakeGpuBuffer[] = [];
	const queue = {
		submit: () => {},
		writeBuffer: (buffer: FakeGpuBuffer, offset: number, data: ArrayBufferView) => {
			const view = new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
			const target = new Uint8Array(buffer.data);
			target.set(view, offset);
		},
	};
	const device = {
		queue,
		createBuffer: (init: { size: number; usage: number }) => {
			const buffer: FakeGpuBuffer = {
				data: new ArrayBuffer(init.size),
				mapped: false,
				mapAsync: async () => {
					buffer.mapped = true;
				},
				getMappedRange: () => buffer.data,
				unmap: () => {
					buffer.mapped = false;
				},
				destroy: () => {},
			};
			buffers.push(buffer);
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
					const sourceView = new Uint8Array(source.data, sourceOffset, size);
					new Uint8Array(destination.data).set(sourceView, destinationOffset);
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

	return { device, queue, buffers };
}

function createMinimalResult(): ComputeResult {
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
		geojsonRuns: [],
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

test('webgpu city matrix readback comparison reports mismatches when the buffer diverges', async () => {
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
		shaderModuleCache: new Map([['city-ned2ecef', {} as GPUShaderModule]]),
		pipelineCache: new Map(),
		bindGroupCache: new Map(),
	} as unknown as WebGpuComputeResources;

	const output = await runWebGpuCityMatrixPass({
		context,
		result: createMinimalResult(),
		resources,
		usage: {
			STORAGE: 1 << 7,
			COPY_DST: 1 << 3,
			COPY_SRC: 1 << 1,
			UNIFORM: 1 << 6,
			MAP_READ: 1 << 0,
		},
	});

	expect(output.diagnostics.some((diagnostic) => diagnostic.code === 'webgpu-city-matrices-mismatch')).toBe(true);
});
