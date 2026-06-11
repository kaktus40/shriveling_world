import type { ComputeGpuBufferContract } from '../gpu';

/** Minimal GPU buffer usage flags required by the WebGPU migration helpers. */
export interface GpuBufferUsageFlags {
	readonly STORAGE: number;
	readonly COPY_DST: number;
	readonly COPY_SRC: number;
	readonly UNIFORM: number;
}

/** Shared contract for a GPU buffer allocation used by the migration workflow. */
export interface GpuBufferAllocation {
	readonly buffer: GPUBuffer;
	readonly contract: ComputeGpuBufferContract;
}

/** WebGPU resources required by the city NED-to-ECEF pass. */
export interface CityNed2EcefDispatchResources {
	readonly input: GpuBufferAllocation;
	readonly output: GpuBufferAllocation;
	readonly uniform: GpuBufferAllocation;
}

/** Input bundle required by the GeoJSON boundary WGSL pass. */
export interface BoundaryAlgebreDispatchInput {
	readonly cityNed2EcefMatrices: Float32Array;
	readonly cityContourIndexes: Int32Array;
	readonly countryContourNVectorBuffer: Float32Array;
	readonly countryContourOffsets: Int32Array;
	readonly countryContourSizes: Int32Array;
	readonly azimuthIntervals: Float32Array;
	readonly cityCount: number;
	readonly azimuthIntervalCount: number;
	readonly contourCount: number;
	readonly earthRadiusMeters: number;
}

/** WebGPU resources required by the GeoJSON boundary WGSL pass. */
export interface BoundaryAlgebreDispatchResources {
	readonly cityMatrices: GpuBufferAllocation;
	readonly cityContourIndexes: GpuBufferAllocation;
	readonly contourNVectors: GpuBufferAllocation;
	readonly contourOffsets: GpuBufferAllocation;
	readonly contourSizes: GpuBufferAllocation;
	readonly azimuthIntervals: GpuBufferAllocation;
	readonly uniform: GpuBufferAllocation;
	readonly townBoundaryAngular: GpuBufferAllocation;
	readonly townBoundaryEcef: GpuBufferAllocation;
}

/** Creates the GPU allocations required by the city NED-to-ECEF pass. */
export function createCityNed2EcefDispatchResources(
	device: GPUDevice,
	usage: GpuBufferUsageFlags,
	cityLonLatRadians: Float32Array,
	cityCount: number,
	earthRadiusMeters: number,
): CityNed2EcefDispatchResources {
	const inputBuffer = device.createBuffer({
		size: cityLonLatRadians.byteLength,
		usage: usage.STORAGE | usage.COPY_DST,
	});
	const outputBuffer = device.createBuffer({
		size: cityCount * 16 * Float32Array.BYTES_PER_ELEMENT,
		usage: usage.STORAGE | usage.COPY_SRC,
	});
	const uniformBuffer = device.createBuffer({
		size: 16,
		usage: usage.UNIFORM | usage.COPY_DST,
	});

	device.queue.writeBuffer(inputBuffer, 0, cityLonLatRadians);
	device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([earthRadiusMeters, 0, 0, 0]));

	return {
		input: {
			buffer: inputBuffer,
			contract: {
				name: 'cityLonLatRadians',
				elementType: 'float32',
				strideBytes: 2 * Float32Array.BYTES_PER_ELEMENT,
				count: cityCount,
				angularUnit: 'radians',
				coordinateOrder: 'longitude-latitude',
				notes: ['PreparedDataset.cityLonLatRadians input for city NED-to-ECEF'],
			},
		},
		output: {
			buffer: outputBuffer,
			contract: {
				name: 'cityNed2EcefMatrices',
				elementType: 'float32',
				strideBytes: 16 * Float32Array.BYTES_PER_ELEMENT,
				count: cityCount,
				linearUnit: 'meters',
				coordinateOrder: 'ecef',
				notes: ['Column-major NED-to-ECEF matrices per city'],
			},
		},
		uniform: {
			buffer: uniformBuffer,
			contract: {
				name: 'earthRadiusMeters',
				elementType: 'float32',
				strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
				count: 1,
				linearUnit: 'meters',
				notes: ['Uniform scalar aligned to vec4<f32>'],
			},
		},
	};
}

/** Creates the GPU allocations required by the boundary raycast WGSL pass. */
export function createBoundaryAlgebreDispatchResources(
	device: GPUDevice,
	usage: GpuBufferUsageFlags,
	input: BoundaryAlgebreDispatchInput,
): BoundaryAlgebreDispatchResources {
	const outputCount = input.cityCount * input.azimuthIntervalCount;
	const outputStrideBytes = 4 * Float32Array.BYTES_PER_ELEMENT;
	const cityMatricesBuffer = device.createBuffer({
		size: input.cityNed2EcefMatrices.byteLength,
		usage: usage.STORAGE | usage.COPY_DST,
	});
	const cityContourIndexesBuffer = device.createBuffer({
		size: input.cityContourIndexes.byteLength,
		usage: usage.STORAGE | usage.COPY_DST,
	});
	const contourNVectorBuffer = device.createBuffer({
		size: input.countryContourNVectorBuffer.byteLength,
		usage: usage.STORAGE | usage.COPY_DST,
	});
	const contourOffsetsBuffer = device.createBuffer({
		size: input.countryContourOffsets.byteLength,
		usage: usage.STORAGE | usage.COPY_DST,
	});
	const contourSizesBuffer = device.createBuffer({
		size: input.countryContourSizes.byteLength,
		usage: usage.STORAGE | usage.COPY_DST,
	});
	const azimuthBuffer = device.createBuffer({
		size: input.azimuthIntervals.byteLength,
		usage: usage.STORAGE | usage.COPY_DST,
	});
	const uniformBuffer = device.createBuffer({
		size: 16,
		usage: usage.UNIFORM | usage.COPY_DST,
	});
	const angularBuffer = device.createBuffer({
		size: outputCount * outputStrideBytes,
		usage: usage.STORAGE | usage.COPY_SRC | usage.COPY_DST,
	});
	const ecefBuffer = device.createBuffer({
		size: outputCount * outputStrideBytes,
		usage: usage.STORAGE | usage.COPY_SRC | usage.COPY_DST,
	});

	device.queue.writeBuffer(cityMatricesBuffer, 0, input.cityNed2EcefMatrices);
	device.queue.writeBuffer(cityContourIndexesBuffer, 0, input.cityContourIndexes);
	device.queue.writeBuffer(contourNVectorBuffer, 0, input.countryContourNVectorBuffer);
	device.queue.writeBuffer(contourOffsetsBuffer, 0, input.countryContourOffsets);
	device.queue.writeBuffer(contourSizesBuffer, 0, input.countryContourSizes);
	device.queue.writeBuffer(azimuthBuffer, 0, input.azimuthIntervals);
	device.queue.writeBuffer(
		uniformBuffer,
		0,
		new Float32Array([input.earthRadiusMeters, input.cityCount, input.azimuthIntervalCount, input.contourCount]),
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
		cityContourIndexes: {
			buffer: cityContourIndexesBuffer,
			contract: {
				name: 'cityContourIndexes',
				elementType: 'int32',
				strideBytes: Int32Array.BYTES_PER_ELEMENT,
				count: input.cityCount,
				notes: ['Dense city-to-contour association; -1 means no contour'],
			},
		},
		contourNVectors: {
			buffer: contourNVectorBuffer,
			contract: {
				name: 'countryContourNVectorBuffer',
				elementType: 'float32',
				strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
				count: input.countryContourNVectorBuffer.length / 4,
				linearUnit: 'unitless',
				coordinateOrder: 'ecef',
				notes: ['Contour vertices converted to unit n-vectors'],
			},
		},
		contourOffsets: {
			buffer: contourOffsetsBuffer,
			contract: {
				name: 'countryContourOffsets',
				elementType: 'int32',
				strideBytes: Int32Array.BYTES_PER_ELEMENT,
				count: input.countryContourOffsets.length,
				notes: ['Start offset of each contour in the packed contour buffers'],
			},
		},
		contourSizes: {
			buffer: contourSizesBuffer,
			contract: {
				name: 'countryContourSizes',
				elementType: 'int32',
				strideBytes: Int32Array.BYTES_PER_ELEMENT,
				count: input.countryContourSizes.length,
				notes: ['Number of points per retained contour'],
			},
		},
		azimuthIntervals: {
			buffer: azimuthBuffer,
			contract: {
				name: 'azimuthIntervals',
				elementType: 'float32',
				strideBytes: 2 * Float32Array.BYTES_PER_ELEMENT,
				count: input.azimuthIntervalCount,
				angularUnit: 'radians',
				notes: ['Packed as [minRadians, maxRadians]'],
			},
		},
		uniform: {
			buffer: uniformBuffer,
			contract: {
				name: 'boundaryUniforms',
				elementType: 'float32',
				strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
				count: 1,
				linearUnit: 'meters',
				notes: ['[earthRadiusMeters, cityCount, azimuthIntervalCount, contourCount]'],
			},
		},
		townBoundaryAngular: {
			buffer: angularBuffer,
			contract: {
				name: 'townBoundaryAngular',
				elementType: 'float32',
				strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
				count: outputCount,
				angularUnit: 'radians',
				notes: ['[longitudeRadians, latitudeRadians, angularDistanceRadians, validFlag]'],
			},
		},
		townBoundaryEcef: {
			buffer: ecefBuffer,
			contract: {
				name: 'townBoundaryEcef',
				elementType: 'float32',
				strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
				count: outputCount,
				linearUnit: 'meters',
				coordinateOrder: 'ecef',
				notes: ['[xMeters, yMeters, zMeters, validFlag]'],
			},
		},
	};
}
