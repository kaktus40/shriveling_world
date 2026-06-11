import type { ComputeGpuBufferContract } from '../gpu';
import type { ConeShape, CurveGeometryInput, CurvePosition } from '../../domain/precompute';

/** Minimal GPU buffer usage flags required by the WebGPU migration helpers. */
export interface GpuBufferUsageFlags {
	readonly STORAGE: number;
	readonly COPY_DST: number;
	readonly COPY_SRC: number;
	readonly UNIFORM: number;
	readonly MAP_READ: number;
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

/** Input bundle required by the raw-cone alpha WGSL pass. */
export interface RawConeAlphaDispatchInput {
	readonly cityLinkOffsets: Uint32Array;
	readonly cityLinkCounts: Uint32Array;
	readonly cityLinkAzimuthRadians: Float32Array;
	readonly cityLinkAlphaRadians: Float32Array;
	readonly cityFastestTerrestrialAlphaRadians: Float32Array;
	readonly cityCount: number;
	readonly azimuthSampleCount: number;
	readonly roadAlphaRadians: number;
	readonly attenuationRadians: number;
	readonly shape: ConeShape;
}

/** WebGPU resources required by the raw-cone alpha WGSL pass. */
export interface RawConeAlphaDispatchResources {
	readonly cityLinkOffsets: GpuBufferAllocation;
	readonly cityLinkCounts: GpuBufferAllocation;
	readonly cityLinkAzimuthRadians: GpuBufferAllocation;
	readonly cityLinkAlphaRadians: GpuBufferAllocation;
	readonly cityFastestTerrestrialAlphaRadians: GpuBufferAllocation;
	readonly uniform: GpuBufferAllocation;
	readonly coneAlphaRadians: GpuBufferAllocation;
}

/** Input bundle required by the ciseled-cones oracle WGSL pass. */
export interface CiseledConesDispatchInput {
	readonly cityNed2EcefMatrices: Float32Array;
	readonly overlapCandidates: Uint32Array;
	readonly overlapCandidateCounts: Uint32Array;
	readonly rawConeRimEcef: Float32Array;
	readonly cityCount: number;
	readonly azimuthSampleCount: number;
	readonly neighborLimit: number;
}

/** WebGPU resources required by the ciseled-cones oracle WGSL pass. */
export interface CiseledConesDispatchResources {
	readonly cityMatrices: GpuBufferAllocation;
	readonly overlapCandidates: GpuBufferAllocation;
	readonly overlapCandidateCounts: GpuBufferAllocation;
	readonly rawConeRimEcef: GpuBufferAllocation;
	readonly uniform: GpuBufferAllocation;
	readonly coneIntersectionDistanceMeters: GpuBufferAllocation;
	readonly ciseledConeRimEcef: GpuBufferAllocation;
}

/** Input bundle required by the final-cones WGSL pass. */
export interface FinalConesDispatchInput {
	readonly ciseledConeRimEcef: GpuBufferAllocation;
	readonly townBoundaryAngular: GpuBufferAllocation;
	readonly townBoundaryEcef: GpuBufferAllocation;
	readonly cityCount: number;
	readonly azimuthSampleCount: number;
	readonly earthRadiusMeters: number;
}

/** WebGPU resources required by the final-cones WGSL pass. */
export interface FinalConesDispatchResources {
	readonly ciseledConeRimEcef: GpuBufferAllocation;
	readonly townBoundaryAngular: GpuBufferAllocation;
	readonly townBoundaryEcef: GpuBufferAllocation;
	readonly uniform: GpuBufferAllocation;
	readonly finalConeGeometryEcef: GpuBufferAllocation;
}

/** Input bundle required by the curve-geometry WGSL pass. */
export interface CurveGeometryDispatchInput extends CurveGeometryInput {
	readonly earthRadiusMeters: number;
}

/** WebGPU resources required by the curve-geometry WGSL pass. */
export interface CurveGeometryDispatchResources {
	readonly curveControlPointsEcef: GpuBufferAllocation;
	readonly curveThetaRadians: GpuBufferAllocation;
	readonly curveSpeedRatio: GpuBufferAllocation;
	readonly curveIds: GpuBufferAllocation;
	readonly uniform: GpuBufferAllocation;
	readonly curveVertexPositions: GpuBufferAllocation;
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

function shapeToCode(shape: ConeShape): number {
	if (shape === 'road') {
		return 0;
	}
	if (shape === 'fastest-terrestrial') {
		return 1;
	}
	return 2;
}

/** Creates the GPU allocations required by the raw-cone alpha WGSL pass. */
export function createRawConeAlphaDispatchResources(
	device: GPUDevice,
	usage: GpuBufferUsageFlags,
	input: RawConeAlphaDispatchInput,
): RawConeAlphaDispatchResources {
	const cityLinkOffsetsBuffer = device.createBuffer({
		size: input.cityLinkOffsets.byteLength,
		usage: usage.STORAGE | usage.COPY_DST,
	});
	const cityLinkCountsBuffer = device.createBuffer({
		size: input.cityLinkCounts.byteLength,
		usage: usage.STORAGE | usage.COPY_DST,
	});
	const cityLinkAzimuthBuffer = device.createBuffer({
		size: input.cityLinkAzimuthRadians.byteLength,
		usage: usage.STORAGE | usage.COPY_DST,
	});
	const cityLinkAlphaBuffer = device.createBuffer({
		size: input.cityLinkAlphaRadians.byteLength,
		usage: usage.STORAGE | usage.COPY_DST,
	});
	const cityFastestTerrestrialAlphaBuffer = device.createBuffer({
		size: input.cityFastestTerrestrialAlphaRadians.byteLength,
		usage: usage.STORAGE | usage.COPY_DST,
	});
	const uniformBuffer = device.createBuffer({
		size: 16,
		usage: usage.UNIFORM | usage.COPY_DST,
	});
	const outputBuffer = device.createBuffer({
		size: input.cityCount * input.azimuthSampleCount * Float32Array.BYTES_PER_ELEMENT,
		usage: usage.STORAGE | usage.COPY_SRC,
	});

	device.queue.writeBuffer(cityLinkOffsetsBuffer, 0, input.cityLinkOffsets);
	device.queue.writeBuffer(cityLinkCountsBuffer, 0, input.cityLinkCounts);
	device.queue.writeBuffer(cityLinkAzimuthBuffer, 0, input.cityLinkAzimuthRadians);
	device.queue.writeBuffer(cityLinkAlphaBuffer, 0, input.cityLinkAlphaRadians);
	device.queue.writeBuffer(cityFastestTerrestrialAlphaBuffer, 0, input.cityFastestTerrestrialAlphaRadians);
	device.queue.writeBuffer(
		uniformBuffer,
		0,
		new Float32Array([
			input.roadAlphaRadians,
			input.attenuationRadians,
			shapeToCode(input.shape),
			input.azimuthSampleCount,
		]),
	);

	return {
		cityLinkOffsets: {
			buffer: cityLinkOffsetsBuffer,
			contract: {
				name: 'cityLinkOffsets',
				elementType: 'uint32',
				strideBytes: Uint32Array.BYTES_PER_ELEMENT,
				count: input.cityCount,
				notes: ['First compact link offset for every city'],
			},
		},
		cityLinkCounts: {
			buffer: cityLinkCountsBuffer,
			contract: {
				name: 'cityLinkCounts',
				elementType: 'uint32',
				strideBytes: Uint32Array.BYTES_PER_ELEMENT,
				count: input.cityCount,
				notes: ['Number of compact links retained for every city'],
			},
		},
		cityLinkAzimuthRadians: {
			buffer: cityLinkAzimuthBuffer,
			contract: {
				name: 'cityLinkAzimuthRadians',
				elementType: 'float32',
				strideBytes: Float32Array.BYTES_PER_ELEMENT,
				count: input.cityLinkAzimuthRadians.length,
				angularUnit: 'radians',
				notes: ['Forward azimuth of each compact link'],
			},
		},
		cityLinkAlphaRadians: {
			buffer: cityLinkAlphaBuffer,
			contract: {
				name: 'cityLinkAlphaRadians',
				elementType: 'float32',
				strideBytes: Float32Array.BYTES_PER_ELEMENT,
				count: input.cityLinkAlphaRadians.length,
				angularUnit: 'radians',
				notes: ['Selected terrestrial alpha of each compact link'],
			},
		},
		cityFastestTerrestrialAlphaRadians: {
			buffer: cityFastestTerrestrialAlphaBuffer,
			contract: {
				name: 'cityFastestTerrestrialAlphaRadians',
				elementType: 'float32',
				strideBytes: Float32Array.BYTES_PER_ELEMENT,
				count: input.cityCount,
				angularUnit: 'radians',
				notes: ['Minimum terrestrial alpha per city'],
			},
		},
		uniform: {
			buffer: uniformBuffer,
			contract: {
				name: 'rawConeAlphaUniforms',
				elementType: 'float32',
				strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
				count: 1,
				angularUnit: 'radians',
				linearUnit: 'meters',
				notes: ['[roadAlphaRadians, attenuationRadians, shapeCode, azimuthSampleCount]'],
			},
		},
		coneAlphaRadians: {
			buffer: outputBuffer,
			contract: {
				name: 'coneAlphaRadians',
				elementType: 'float32',
				strideBytes: Float32Array.BYTES_PER_ELEMENT,
				count: input.cityCount * input.azimuthSampleCount,
				angularUnit: 'radians',
				notes: ['Selected alpha per city and azimuth sample'],
			},
		},
	};
}

/** Creates the GPU allocations required by the ciseled-cones oracle pass. */
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
				count: input.cityCount,
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

/** Creates the GPU allocations required by the final-cones WGSL pass. */
export function createFinalConesDispatchResources(
	device: GPUDevice,
	usage: GpuBufferUsageFlags,
	input: FinalConesDispatchInput,
): FinalConesDispatchResources {
	const rayCount = input.cityCount * input.azimuthSampleCount;
	const outputBuffer = device.createBuffer({
		size: Math.max(rayCount, 1) * 4 * Float32Array.BYTES_PER_ELEMENT,
		usage: usage.STORAGE | usage.COPY_SRC,
	});
	const uniformBuffer = device.createBuffer({
		size: 16,
		usage: usage.UNIFORM | usage.COPY_DST,
	});

	device.queue.writeBuffer(
		uniformBuffer,
		0,
		new Float32Array([input.earthRadiusMeters, input.cityCount, input.azimuthSampleCount, 0]),
	);

	return {
		ciseledConeRimEcef: input.ciseledConeRimEcef,
		townBoundaryAngular: input.townBoundaryAngular,
		townBoundaryEcef: input.townBoundaryEcef,
		uniform: {
			buffer: uniformBuffer,
			contract: {
				name: 'finalConeUniforms',
				elementType: 'float32',
				strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
				count: 1,
				linearUnit: 'meters',
				notes: ['[earthRadiusMeters, cityCount, azimuthSampleCount, unused] for final cone geometry emission'],
			},
		},
		finalConeGeometryEcef: {
			buffer: outputBuffer,
			contract: {
				name: 'finalConeGeometryEcef',
				elementType: 'float32',
				strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
				count: rayCount,
				linearUnit: 'meters',
				coordinateOrder: 'ecef',
				notes: ['Final cone geometry in ECEF meters, ready to display'],
			},
		},
	};
}

/** Creates the GPU allocations required by the curve-geometry WGSL pass. */
export function createCurveGeometryDispatchResources(
	device: GPUDevice,
	usage: GpuBufferUsageFlags,
	input: CurveGeometryDispatchInput,
): CurveGeometryDispatchResources {
	const controlPointsBuffer = device.createBuffer({
		size: input.curveControlPointsEcef.byteLength,
		usage: usage.STORAGE | usage.COPY_DST,
	});
	const thetaBuffer = device.createBuffer({
		size: input.curveThetaRadians.byteLength,
		usage: usage.STORAGE | usage.COPY_DST,
	});
	const speedRatioBuffer = device.createBuffer({
		size: input.curveSpeedRatio.byteLength,
		usage: usage.STORAGE | usage.COPY_DST,
	});
	const curveIdsBuffer = device.createBuffer({
		size: input.curveIds.byteLength,
		usage: usage.STORAGE | usage.COPY_DST,
	});
	const uniformBuffer = device.createBuffer({
		size: 16,
		usage: usage.UNIFORM | usage.COPY_DST,
	});
	const outputBuffer = device.createBuffer({
		size: Math.max(input.curveCount * (input.pointsPerCurve + 1), 1) * 4 * Float32Array.BYTES_PER_ELEMENT,
		usage: usage.STORAGE | usage.COPY_SRC,
	});

	device.queue.writeBuffer(controlPointsBuffer, 0, input.curveControlPointsEcef);
	device.queue.writeBuffer(thetaBuffer, 0, input.curveThetaRadians);
	device.queue.writeBuffer(speedRatioBuffer, 0, input.curveSpeedRatio);
	device.queue.writeBuffer(curveIdsBuffer, 0, input.curveIds);
	device.queue.writeBuffer(
		uniformBuffer,
		0,
		new Float32Array([
			input.earthRadiusMeters,
			input.pointsPerCurve,
			curvePositionToCode(input.curvePosition),
			input.coefficient ?? 1,
		]),
	);

	return {
		curveControlPointsEcef: {
			buffer: controlPointsBuffer,
			contract: {
				name: 'curveControlPointsEcef',
				elementType: 'float32',
				strideBytes: 16 * Float32Array.BYTES_PER_ELEMENT,
				count: input.curveCount,
				linearUnit: 'meters',
				coordinateOrder: 'ecef',
				notes: ['Packed [A, P, Q, B] control points per curve'],
			},
		},
		curveThetaRadians: {
			buffer: thetaBuffer,
			contract: {
				name: 'curveThetaRadians',
				elementType: 'float32',
				strideBytes: Float32Array.BYTES_PER_ELEMENT,
				count: input.curveCount,
				angularUnit: 'radians',
				notes: ['Great-circle angular distance per curve'],
			},
		},
		curveSpeedRatio: {
			buffer: speedRatioBuffer,
			contract: {
				name: 'curveSpeedRatio',
				elementType: 'float32',
				strideBytes: Float32Array.BYTES_PER_ELEMENT,
				count: input.curveCount,
				notes: ['Yearly ratio maxSpeed / curveSpeed per curve'],
			},
		},
		curveIds: {
			buffer: curveIdsBuffer,
			contract: {
				name: 'curveIds',
				elementType: 'uint32',
				strideBytes: Uint32Array.BYTES_PER_ELEMENT,
				count: input.curveCount,
				notes: ['Stable curve ids for traceability'],
			},
		},
		uniform: {
			buffer: uniformBuffer,
			contract: {
				name: 'curveGeometryUniforms',
				elementType: 'float32',
				strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
				count: 1,
				linearUnit: 'meters',
				angularUnit: 'radians',
				notes: ['[earthRadiusMeters, pointsPerCurve, curvePositionCode, coefficient]'],
			},
		},
		curveVertexPositions: {
			buffer: outputBuffer,
			contract: {
				name: 'curveVertexPositions',
				elementType: 'float32',
				strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
				count: input.curveCount * (input.pointsPerCurve + 1),
				linearUnit: 'meters',
				coordinateOrder: 'ecef',
				notes: ['Render-ready curve vertices in ECEF meters'],
			},
		},
	};
}

function curvePositionToCode(position: CurvePosition): number {
	switch (position) {
		case 'above':
			return 0;
		case 'below':
			return 1;
		case 'below-when-possible':
			return 2;
		case 'stick-to-cone':
			return 3;
	}
}
