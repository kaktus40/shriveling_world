export { compareFloat32Buffers } from '../shared/validation';

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

	const mapReadUsage = getMapReadUsage(device);
	await readback.mapAsync(mapReadUsage);
	const mapped = readback.getMappedRange();
	const output = new Float32Array(mapped.slice(0));
	readback.unmap();
	readback.destroy();
	return output;
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
