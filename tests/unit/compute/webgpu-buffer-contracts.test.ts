import { expect, test } from 'vitest';

import { createBoundaryAlgebreDispatchResources } from '$lib/compute/webgpu/passes/boundary-algebre/buffers';
import { createCiseledConesDispatchResources } from '$lib/compute/webgpu/passes/ciseled-cones/buffers';
import { createCityNed2EcefDispatchResources } from '$lib/compute/webgpu/passes/city-ned2ecef/buffers';
import { createRawConeAlphaDispatchResources } from '$lib/compute/webgpu/passes/raw-cone-alphas/buffers';
import type { GpuBufferUsageFlags } from '$lib/compute/webgpu/buffers';

type BufferRecord = {
	size: number;
	usage: number;
};

function createFakeDevice() {
	const buffers: BufferRecord[] = [];
	const writes: Array<{ buffer: BufferRecord; data: number[] }> = [];
	const queue = {
		submit: () => {},
		writeBuffer: (buffer: BufferRecord, _offset: number, data: ArrayBufferView) => {
			writes.push({
				buffer,
				data: Array.from(new Float32Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))),
			});
		},
	};
	const device = {
		queue,
		createBuffer: (init: { size: number; usage: number }) => {
			const buffer = { size: init.size, usage: init.usage };
			buffers.push(buffer);
			return buffer as unknown as GPUBuffer;
		},
	} as unknown as GPUDevice;

	return { device, buffers, writes };
}

function fakeUsage(): GpuBufferUsageFlags {
	return {
		STORAGE: 1 << 7,
		COPY_DST: 1 << 3,
		COPY_SRC: 1 << 1,
		UNIFORM: 1 << 6,
		MAP_READ: 1 << 0,
	};
}

test('city NED-to-ECEF buffer contract stores a 4-float uniform struct', () => {
	const fake = createFakeDevice();
	const resources = createCityNed2EcefDispatchResources(fake.device, fakeUsage(), {
		cityLonLatRadians: new Float32Array([0, 0, 1, 2]),
		cityCount: 2,
		earthRadiusMeters: 6_371_000,
	});

	expect(resources.input.contract.name).toBe('cityLonLatRadians');
	expect(resources.input.contract.coordinateOrder).toBe('longitude-latitude');
	expect(resources.output.contract.name).toBe('cityNed2EcefMatrices');
	expect(resources.uniform.contract.name).toBe('earthRadiusMeters');
	expect(resources.uniform.contract.count).toBe(1);
	expect(fake.writes).toHaveLength(2);
	expect(fake.writes[1]?.data).toEqual([6_371_000, 0, 0, 0]);
});

test('raw-cone alpha buffer contract stores the canonical uniform layout', () => {
	const fake = createFakeDevice();
	const resources = createRawConeAlphaDispatchResources(fake.device, fakeUsage(), {
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
	});

	expect(resources.uniform.contract.name).toBe('rawConeAlphaUniforms');
	expect(resources.uniform.contract.notes).toContain('[roadAlphaRadians, attenuationRadians, shapeCode, azimuthSampleCount]');
	expect(fake.writes).toHaveLength(6);
	expect(fake.writes[5]?.data[0]).toBeCloseTo(0.7);
	expect(fake.writes[5]?.data[1]).toBeCloseTo(0.8);
	expect(fake.writes[5]?.data[2]).toBe(2);
	expect(fake.writes[5]?.data[3]).toBe(4);
});

test('boundary raycast buffer contract stores the canonical uniform layout', () => {
	const fake = createFakeDevice();
	const resources = createBoundaryAlgebreDispatchResources(fake.device, fakeUsage(), {
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
	});

	expect(resources.uniform.contract.name).toBe('boundaryUniforms');
	expect(resources.uniform.contract.notes).toContain('[earthRadiusMeters, cityCount, azimuthIntervalCount, contourCount]');
	expect(fake.writes).toHaveLength(7);
	expect(fake.writes[6]?.data).toEqual([6_371_000, 2, 2, 2]);
});

test('ciseled cone buffer contract stores the alpha-aware heuristics layout', () => {
	const fake = createFakeDevice();
	const resources = createCiseledConesDispatchResources(fake.device, fakeUsage(), {
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
	});

	expect(resources.uniform.contract.name).toBe('ciseledConeUniforms');
	expect(resources.heuristics.contract.name).toBe('ciseledConeHeuristics');
	expect(resources.cityPairInvariants.contract.name).toBe('cityPairInvariants');
	expect(resources.coneAlphaRadians.contract.name).toBe('coneAlphaRadians');
	expect(fake.writes).toHaveLength(8);
	expect(fake.writes[4]?.data[0]).toBeCloseTo(0.1);
	expect(fake.writes[4]?.data[1]).toBeCloseTo(0.2);
	expect(fake.writes[4]?.data[2]).toBeCloseTo(0.3);
	expect(fake.writes[4]?.data[3]).toBe(0);
	expect(fake.writes[5]?.data[0]).toBeCloseTo(0.4);
	expect(fake.writes[6]?.data).toHaveLength(4);
	expect(fake.writes[7]?.data).toHaveLength(4);
});
