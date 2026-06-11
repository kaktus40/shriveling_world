import type { DatasetDiagnostic } from '../../domain/data';

/** Reads back a float buffer from WebGPU when the runtime supports mapping. */
export async function readBackFloat32Buffer(
	device: GPUDevice,
	buffer: GPUBuffer,
	length: number,
): Promise<Float32Array | null> {
	if (typeof buffer.mapAsync !== 'function' || typeof buffer.getMappedRange !== 'function') {
		return null;
	}

	const readback = device.createBuffer({
		size: length * Float32Array.BYTES_PER_ELEMENT,
		usage: getMapReadUsage(device) | getCopyDstUsage(device),
	});
	const encoder = device.createCommandEncoder();
	encoder.copyBufferToBuffer(buffer, 0, readback, 0, length * Float32Array.BYTES_PER_ELEMENT);
	device.queue.submit([encoder.finish()]);

	await readback.mapAsync(GPUMapMode.READ);
	const mapped = readback.getMappedRange();
	const output = new Float32Array(mapped.slice(0));
	readback.unmap();
	readback.destroy();
	return output;
}

/** Compares two float32 buffers and returns diagnostics only when they differ. */
export function compareFloat32Buffers(
	label: string,
	expected: Float32Array,
	actual: Float32Array,
	tolerance = 1e-5,
): DatasetDiagnostic[] {
	if (expected.length !== actual.length) {
		return [
			{
				severity: 'warning',
				code: `${label}-length-mismatch`,
				expectedLength: expected.length,
				actualLength: actual.length,
			},
		];
	}

	let maxDelta = 0;
	let maxIndex = -1;
	for (let index = 0; index < expected.length; index += 1) {
		const delta = Math.abs(expected[index] - actual[index]);
		if (delta > maxDelta) {
			maxDelta = delta;
			maxIndex = index;
		}
	}

	if (maxDelta > tolerance) {
		return [
			{
				severity: 'warning',
				code: `${label}-mismatch`,
				maxDelta,
				maxIndex,
				tolerance,
			},
		];
	}

	return [];
}

function getMapReadUsage(device: GPUDevice): number {
	return (globalThis as typeof globalThis & {
		GPUBufferUsage?: {
			MAP_READ: number;
		};
	}).GPUBufferUsage?.MAP_READ ?? 1 << 0;
}

function getCopyDstUsage(device: GPUDevice): number {
	return (globalThis as typeof globalThis & {
		GPUBufferUsage?: {
			COPY_DST: number;
		};
	}).GPUBufferUsage?.COPY_DST ?? 1 << 3;
}
