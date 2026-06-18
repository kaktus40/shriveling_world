import type {
	GpuBufferUsageFlags,
	RawConeAlphaDispatchInput,
	RawConeAlphaDispatchResources,
} from '../../buffers';
import { getOrCreateGpuDoubleBuffer } from '../../../phase-c/phase-c';

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
	// allocate double-buffered output for coneAlphaRadians
	const coneAlphaSize = input.cityCount * input.azimuthSampleCount * Float32Array.BYTES_PER_ELEMENT;
	const coneAlphaSet = getOrCreateGpuDoubleBuffer(device, 'raw-cone-alphas:coneAlphaRadians', coneAlphaSize, usage.STORAGE | usage.COPY_SRC | usage.COPY_DST);
	const outputBuffer = coneAlphaSet.back;

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

function shapeToCode(shape: RawConeAlphaDispatchInput['shape']): number {
	if (shape === 'road') {
		return 0;
	}
	if (shape === 'fastest-terrestrial') {
		return 1;
	}
	return 2;
}
