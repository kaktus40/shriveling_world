import { expect, test } from 'vitest';

import { runWebGpuCiseledConePass } from '$lib/compute/webgpu/passes/ciseled-cones';
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
		geojsonRuns: [],
		staticTown: {
			cityCount: 1,
			cityNed2EcefMatrices: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1]),
			overlapCandidates: new Uint32Array([0]),
			overlapCandidateCounts: new Uint32Array([1]),
			neighborLimit: 1,
			cityPairInvariants: new Float32Array([0.1, 0.2, 0.3, 0]),
		} as ComputeResult['staticTown'],
		dynamicTown: {
			year: 2000,
			roadAlphaRadians: 0.5,
			cityFastestTerrestrialAlphaRadians: new Float32Array([0.4]),
			cityLinkOffsets: new Uint32Array([0]),
			cityLinkCounts: new Uint32Array([0]),
			cityLinkAzimuthRadians: new Float32Array([0]),
			cityLinkAlphaRadians: new Float32Array([0]),
		} as ComputeResult['dynamicTown'],
		rawCones: {
			cityCount: 1,
			azimuthSampleCount: 1,
			shape: 'road',
			coneLengthMeters: 1000,
			coneAlphaRadians: new Float32Array([0.2]),
			rawConeRimEcef: new Float32Array([1, 2, 3, 1]),
		} as ComputeResult['rawCones'],
		coneIntersections: {
			cityCount: 1,
			azimuthSampleCount: 1,
			coneIntersectionDistanceMeters: new Float32Array([500]),
			ciseledConeRimEcef: new Float32Array([1, 2, 3, 1]),
			winningNeighborCityIndexes: new Uint32Array([0]),
			winningFaceIndexes: new Uint32Array([0]),
			testedFaceCounts: new Uint32Array([1]),
		} as ComputeResult['coneIntersections'],
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

test('webgpu ciseled readback comparison reports mismatches when the buffer diverges', async () => {
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
		shaderModuleCache: new Map([['ciseled-cones', {} as GPUShaderModule]]),
		pipelineCache: new Map(),
		bindGroupCache: new Map(),
	} as unknown as WebGpuComputeResources;
	const result = buildMinimalResult();

	const output = await runWebGpuCiseledConePass({
		context,
		result,
		resources,
		usage: {
			STORAGE: 1 << 7,
			COPY_DST: 1 << 3,
			COPY_SRC: 1 << 1,
			UNIFORM: 1 << 6,
			MAP_READ: 1 << 0,
		},
	});

	expect(output.diagnostics.some((diagnostic) => diagnostic.code === 'webgpu-cone-intersection-distance-mismatch')).toBe(true);
});
