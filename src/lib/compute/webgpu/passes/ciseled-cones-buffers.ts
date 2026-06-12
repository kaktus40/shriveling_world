import type {
	CiseledConesDispatchInput,
	CiseledConesDispatchResources,
	GpuBufferUsageFlags,
} from '../buffers';

/** Creates the GPU allocations required by the ciseled-cones oracle WGSL pass. */
export function createCiseledConesDispatchResources(
	device: GPUDevice,
	usage: GpuBufferUsageFlags,
	input: CiseledConesDispatchInput,
): CiseledConesDispatchResources {
	const cityMatricesBuffer = device.createBuffer({
		size: input.cityNed2EcefMatrices.byteLength,
		usage: usage.STORAGE | usage.COPY_DST,
	});
	const overlapCandidatesBuffer = device.createBuffer({
		size: input.overlapCandidates.byteLength,
		usage: usage.STORAGE | usage.COPY_DST,
	});
	const overlapCandidateCountsBuffer = device.createBuffer({
		size: input.overlapCandidateCounts.byteLength,
		usage: usage.STORAGE | usage.COPY_DST,
	});
	const rawConeRimBuffer = device.createBuffer({
		size: input.rawConeRimEcef.byteLength,
		usage: usage.STORAGE | usage.COPY_DST,
	});
	const uniformBuffer = device.createBuffer({
		size: 16,
		usage: usage.UNIFORM | usage.COPY_DST,
	});
	const distanceBuffer = device.createBuffer({
		size: input.cityCount * input.azimuthSampleCount * Float32Array.BYTES_PER_ELEMENT,
		usage: usage.STORAGE | usage.COPY_SRC,
	});
	const ciseledBuffer = device.createBuffer({
		size: input.cityCount * input.azimuthSampleCount * 4 * Float32Array.BYTES_PER_ELEMENT,
		usage: usage.STORAGE | usage.COPY_SRC | usage.COPY_DST,
	});

	device.queue.writeBuffer(cityMatricesBuffer, 0, input.cityNed2EcefMatrices);
	device.queue.writeBuffer(overlapCandidatesBuffer, 0, input.overlapCandidates);
	device.queue.writeBuffer(overlapCandidateCountsBuffer, 0, input.overlapCandidateCounts);
	device.queue.writeBuffer(rawConeRimBuffer, 0, input.rawConeRimEcef);
	device.queue.writeBuffer(
		uniformBuffer,
		0,
		new Uint32Array([input.cityCount, input.azimuthSampleCount, input.neighborLimit, 0]),
	);

	return {
		cityMatrices: {
			buffer: cityMatricesBuffer,
			contract: {
				name: 'cityNed2EcefMatrices',
				elementType: 'float32',
				strideBytes: 16 * Float32Array.BYTES_PER_ELEMENT,
				count: input.cityCount,
				linearUnit: 'meters',
				coordinateOrder: 'ecef',
				notes: ['Column-major NED-to-ECEF matrices per city'],
			},
		},
		overlapCandidates: {
			buffer: overlapCandidatesBuffer,
			contract: {
				name: 'overlapCandidates',
				elementType: 'uint32',
				strideBytes: Uint32Array.BYTES_PER_ELEMENT,
				count: input.overlapCandidates.length,
				notes: ['Dense overlap candidate indexes for every city'],
			},
		},
		overlapCandidateCounts: {
			buffer: overlapCandidateCountsBuffer,
			contract: {
				name: 'overlapCandidateCounts',
				elementType: 'uint32',
				strideBytes: Uint32Array.BYTES_PER_ELEMENT,
				count: input.overlapCandidateCounts.length,
				notes: ['Number of valid candidate neighbors for every city'],
			},
		},
		rawConeRimEcef: {
			buffer: rawConeRimBuffer,
			contract: {
				name: 'rawConeRimEcef',
				elementType: 'float32',
				strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
				count: input.cityCount * input.azimuthSampleCount,
				linearUnit: 'meters',
				coordinateOrder: 'ecef',
				notes: ['Raw cone rim positions in ECEF meters'],
			},
		},
		uniform: {
			buffer: uniformBuffer,
			contract: {
				name: 'ciseledConeUniforms',
				elementType: 'uint32',
				strideBytes: 4 * Uint32Array.BYTES_PER_ELEMENT,
				count: 1,
				notes: ['[cityCount, azimuthSampleCount, neighborLimit, unused]'],
			},
		},
		coneIntersectionDistanceMeters: {
			buffer: distanceBuffer,
			contract: {
				name: 'coneIntersectionDistanceMeters',
				elementType: 'float32',
				strideBytes: Float32Array.BYTES_PER_ELEMENT,
				count: input.cityCount * input.azimuthSampleCount,
				linearUnit: 'meters',
				notes: ['Minimum intersection distance per city and azimuth sample'],
			},
		},
		ciseledConeRimEcef: {
			buffer: ciseledBuffer,
			contract: {
				name: 'ciseledConeRimEcef',
				elementType: 'float32',
				strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
				count: input.cityCount * input.azimuthSampleCount,
				linearUnit: 'meters',
				coordinateOrder: 'ecef',
				notes: ['Ciseled cone rim positions in ECEF meters'],
			},
		},
	};
}
