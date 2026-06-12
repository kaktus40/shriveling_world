import type { CityNed2EcefDispatchResources, GpuBufferUsageFlags } from '../buffers';

/** Input bundle required by the city NED-to-ECEF WGSL pass. */
export interface CityNed2EcefDispatchInput {
	readonly cityLonLatRadians: Float32Array;
	readonly cityCount: number;
	readonly earthRadiusMeters: number;
}

/** Creates the GPU allocations required by the city NED-to-ECEF pass. */
export function createCityNed2EcefDispatchResources(
	device: GPUDevice,
	usage: GpuBufferUsageFlags,
	input: CityNed2EcefDispatchInput,
): CityNed2EcefDispatchResources {
	const inputBuffer = device.createBuffer({
		size: input.cityLonLatRadians.byteLength,
		usage: usage.STORAGE | usage.COPY_DST,
	});
	const outputBuffer = device.createBuffer({
		size: input.cityCount * 16 * Float32Array.BYTES_PER_ELEMENT,
		usage: usage.STORAGE | usage.COPY_SRC,
	});
	const uniformBuffer = device.createBuffer({
		size: 16,
		usage: usage.UNIFORM | usage.COPY_DST,
	});

	device.queue.writeBuffer(inputBuffer, 0, input.cityLonLatRadians);
	device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([input.earthRadiusMeters, 0, 0, 0]));

	return {
		input: {
			buffer: inputBuffer,
			contract: {
				name: 'cityLonLatRadians',
				elementType: 'float32',
				strideBytes: 2 * Float32Array.BYTES_PER_ELEMENT,
				count: input.cityCount,
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
				count: input.cityCount,
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
