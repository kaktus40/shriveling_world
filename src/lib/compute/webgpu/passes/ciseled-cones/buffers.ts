import type {
	CiseledConesDispatchInput,
	CiseledConesDispatchResources,
	GpuBufferUsageFlags,
} from '../../buffers';

import { getOrCreateGpuDoubleBuffer } from '../../../phase-c/phase-c';

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
	const heuristicsBuffer = device.createBuffer({
		size: 16,
		usage: usage.UNIFORM | usage.COPY_DST,
	});
	const cityPairInvariantsBuffer = device.createBuffer({
		size: input.cityPairInvariants.byteLength,
		usage: usage.STORAGE | usage.COPY_DST,
	});
	const coneAlphaRadiansBuffer = device.createBuffer({
		size: input.coneAlphaRadians.byteLength,
		usage: usage.STORAGE | usage.COPY_DST,
	});
	const distanceSize = input.cityCount * input.azimuthSampleCount * Float32Array.BYTES_PER_ELEMENT;
	const distanceSet = getOrCreateGpuDoubleBuffer(device, 'ciseled-cones:distance', distanceSize, usage.STORAGE | usage.COPY_SRC);
	const distanceBuffer = distanceSet.back;
	const ciseledSize = input.cityCount * input.azimuthSampleCount * 4 * Float32Array.BYTES_PER_ELEMENT;
	const ciseledSet = getOrCreateGpuDoubleBuffer(device, 'ciseled-cones:rim', ciseledSize, usage.STORAGE | usage.COPY_SRC | usage.COPY_DST);
	const ciseledBuffer = ciseledSet.back;

	device.queue.writeBuffer(cityMatricesBuffer, 0, input.cityNed2EcefMatrices);
	device.queue.writeBuffer(overlapCandidatesBuffer, 0, input.overlapCandidates);
	device.queue.writeBuffer(overlapCandidateCountsBuffer, 0, input.overlapCandidateCounts);
	device.queue.writeBuffer(rawConeRimBuffer, 0, input.rawConeRimEcef);
	device.queue.writeBuffer(cityPairInvariantsBuffer, 0, input.cityPairInvariants);
	device.queue.writeBuffer(coneAlphaRadiansBuffer, 0, input.coneAlphaRadians);
	device.queue.writeBuffer(
		uniformBuffer,
		0,
		new Uint32Array([input.cityCount, input.azimuthSampleCount, input.neighborLimit, 0]),
	);
	device.queue.writeBuffer(
		heuristicsBuffer,
		0,
		new Float32Array([input.roadAlphaRadians, input.bilateralNeighborhoodFaceCount, input.alphaEpsilonRadians, 0]),
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
		heuristics: {
			buffer: heuristicsBuffer,
			contract: {
				name: 'ciseledConeHeuristics',
				elementType: 'float32',
				strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
				count: 1,
				angularUnit: 'radians',
				notes: ['[roadAlphaRadians, bilateralNeighborhoodFaceCount, alphaEpsilonRadians, unused]'],
			},
		},
		cityPairInvariants: {
			buffer: cityPairInvariantsBuffer,
			contract: {
				name: 'cityPairInvariants',
				elementType: 'float32',
				strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
				count: input.cityPairInvariants.length / 4,
				notes: ['Ordered city-pair invariants sampled as a RGBA32F texture'],
			},
		},
		coneAlphaRadians: {
			buffer: coneAlphaRadiansBuffer,
			contract: {
				name: 'coneAlphaRadians',
				elementType: 'float32',
				strideBytes: Float32Array.BYTES_PER_ELEMENT,
				count: input.coneAlphaRadians.length,
				angularUnit: 'radians',
				notes: ['Raw cone alpha samples sampled as a R32F texture'],
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
