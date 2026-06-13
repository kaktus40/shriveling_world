import type { GpuBufferAllocation, GpuBufferUsageFlags, FinalConesDispatchInput, FinalConesDispatchResources } from '../../buffers';

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
	const projectionBuffer = device.createBuffer({
		size: 16,
		usage: usage.UNIFORM | usage.COPY_DST,
	});
	const projectionSettingsBuffer = device.createBuffer({
		size: 32,
		usage: usage.UNIFORM | usage.COPY_DST,
	});

	device.queue.writeBuffer(
		uniformBuffer,
		0,
		new Float32Array([input.earthRadiusMeters, input.cityCount, input.azimuthSampleCount, input.globeRadius]),
	);
	device.queue.writeBuffer(
		projectionBuffer,
		0,
		new Float32Array([input.projectionInit, input.projectionEnd, input.projectionPercent, 0]),
	);
	device.queue.writeBuffer(
		projectionSettingsBuffer,
		0,
		new Float32Array([
			input.projectionReferenceLongitudeRadians,
			input.projectionReferenceLatitudeRadians,
			input.projectionReferenceHeightMeters,
			input.projectionStandardParallel1Radians,
			input.projectionStandardParallel2Radians,
			input.projectionZCoefficient,
			0,
			0,
		]),
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
					notes: ['[earthRadiusMeters, cityCount, azimuthSampleCount, globeRadius] for final cone geometry emission'],
				},
			},
		projection: {
			buffer: projectionBuffer,
				contract: {
					name: 'finalConeProjection',
					elementType: 'float32',
					strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
					count: 1,
					notes: ['[projectionInit, projectionEnd, projectionPercent, unused] for final cone geometry emission'],
				},
			},
		projectionSettings: {
			buffer: projectionSettingsBuffer,
			contract: {
				name: 'finalConeProjectionSettings',
				elementType: 'float32',
				strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
				count: 2,
				notes: ['[referenceLongitude, referenceLatitude, referenceHeight, standardParallel1, standardParallel2, zCoefficient, unused, unused] for final cone geometry emission'],
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
					notes: ['Final cone geometry in display projection space, ready to display'],
				},
			},
		};
}
