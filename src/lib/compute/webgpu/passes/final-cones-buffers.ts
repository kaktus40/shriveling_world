import type { GpuBufferAllocation, GpuBufferUsageFlags, FinalConesDispatchInput, FinalConesDispatchResources } from '../buffers';

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
