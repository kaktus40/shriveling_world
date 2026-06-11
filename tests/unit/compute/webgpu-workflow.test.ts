import assert from 'node:assert/strict';
import { expect, test } from 'vitest';

import {
	createWebGpuWorkflowBackendDescriptor,
	probeWebGpuAvailability,
	type WebGpuWorkflowBackendOptions,
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

function createFakeDevice(): { device: WebGpuWorkflowBackendOptions['device']; calls: { dispatches: number } } {
	const calls = {
		dispatches: 0,
	};
	const queue = {
		submit: () => {},
		writeBuffer: () => {},
	} as unknown as GPUQueue;

	const pipeline = {
		getBindGroupLayout: () => ({} as GPUBindGroupLayout),
	} as unknown as GPUComputePipeline;

	const device = {
		queue,
		createBuffer: () => ({} as GPUBuffer),
		createShaderModule: () => ({} as GPUShaderModule),
		createComputePipelineAsync: async () => pipeline,
		createBindGroup: () => ({} as GPUBindGroup),
		createCommandEncoder: () =>
			({
				beginComputePass: () =>
					({
						setPipeline: () => {},
						setBindGroup: () => {},
						dispatchWorkgroups: () => {
							calls.dispatches += 1;
						},
						end: () => {},
					}) as unknown as GPUComputePassEncoder,
				finish: () => ({} as GPUCommandBuffer),
			}) as GPUCommandEncoder,
	} as unknown as WebGpuWorkflowBackendOptions['device'];

	return { device, calls };
}

test('webgpu probe stays false without a device or adapter', async () => {
	expect(await probeWebGpuAvailability(undefined, null)).toBe(false);
	await expect(createWebGpuWorkflowBackendDescriptor().isAvailable()).resolves.toBe(false);
});

test('webgpu probe becomes available with an injected device and the backend keeps the selected profile', async () => {
	const fake = createFakeDevice();
	const descriptor = createWebGpuWorkflowBackendDescriptor({ device: fake.device });
	assert.equal(await descriptor.isAvailable(), true);

	const backend = await descriptor.create();
	const result = await backend.run(
		buildMinimalDataset(),
		{
			benchmark: true,
			dynamicYear: 2000,
			rawCone: { shape: 'road', azimuthSampleCount: 8, coneLengthMeters: 100000 },
			coneIntersection: { enabled: true },
		},
		{
			requested: 'webgpu',
			forced: 'webgpu',
			selected: 'webgpu',
			fallbackUsed: false,
			capabilities: {
				webgpuAvailable: true,
				webgl2Available: false,
				cpuAvailable: true,
				notes: ['WebGPU skeleton backend'],
			},
		},
	);

	expect(result.selection.selected).toBe('webgpu');
	expect(result.benchmark.profile).toBe('webgpu');
	expect(
		result.benchmark.notes.some((note) => note.includes('city NED-to-ECEF, raw-cone alpha, cone-cone, boundary and final geometry passes')),
	).toBe(true);
	expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'webgpu-partial-cpu-delegation')).toBe(true);
	expect(fake.calls.dispatches).toBeGreaterThanOrEqual(4);
});
