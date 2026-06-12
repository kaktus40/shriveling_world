import assert from 'node:assert/strict';

import { expect, test } from 'vitest';

import { compareFloat32Buffers } from '$lib/compute/shared/validation';
import { readBackFloat32Buffer as readBackWebGl2Float32Buffer } from '$lib/compute/webgl2/validation';
import { readBackFloat32Buffer as readBackWebGpuFloat32Buffer } from '$lib/compute/webgpu/validation';

test('compareFloat32Buffers reports no diagnostics for matching buffers', () => {
	const diagnostics = compareFloat32Buffers('shared-buffer', new Float32Array([1, 2, 3]), new Float32Array([1, 2, 3]));
	expect(diagnostics).toEqual([]);
});

test('compareFloat32Buffers reports a length mismatch', () => {
	const diagnostics = compareFloat32Buffers('shared-buffer', new Float32Array([1, 2]), new Float32Array([1, 2, 3]));
	assert.equal(diagnostics.length, 1);
	assert.equal(diagnostics[0]?.severity, 'warning');
	assert.equal(diagnostics[0]?.code, 'shared-buffer-length-mismatch');
});

test('compareFloat32Buffers reports an out-of-tolerance delta', () => {
	const diagnostics = compareFloat32Buffers('shared-buffer', new Float32Array([1, 2, 3]), new Float32Array([1, 2.001, 3]), 1e-4);
	assert.equal(diagnostics.length, 1);
	assert.equal(diagnostics[0]?.severity, 'warning');
	assert.equal(diagnostics[0]?.code, 'shared-buffer-mismatch');
});

test('webgl2 readback returns null when the API is unavailable', () => {
	const result = readBackWebGl2Float32Buffer(
		{
			bindBuffer: () => {},
		} as unknown as WebGL2RenderingContext,
		0,
		{} as WebGLBuffer,
		4,
	);
	expect(result).toBeNull();
});

test('webgl2 readback copies float data when the API is available', () => {
	const output = new Float32Array([10, 20, 30, 40]);
	const gl = {
		getBufferSubData: (_target: number, _offset: number, target: Float32Array) => {
			target.set(output);
		},
		bindBuffer: () => {},
	} as unknown as WebGL2RenderingContext;

	const result = readBackWebGl2Float32Buffer(gl, 0, {} as WebGLBuffer, output.length);
	expect(result).not.toBeNull();
	expect(Array.from(result ?? [])).toEqual(Array.from(output));
});

test('webgpu readback returns null when the source buffer is not mappable', async () => {
	const result = await readBackWebGpuFloat32Buffer(
		{
			queue: { submit: () => {} },
			createBuffer: () => ({} as GPUBuffer),
			createCommandEncoder: () => ({} as GPUCommandEncoder),
		} as unknown as GPUDevice,
		{} as GPUBuffer,
		4,
	);
	expect(result).toBeNull();
});

test('webgpu readback copies float data when the source buffer supports mapping', async () => {
	const expected = new Float32Array([5, 6, 7, 8]);
	const mapped = expected.buffer.slice(0);
	const sourceBuffer = {
		mapAsync: async () => undefined,
		getMappedRange: () => mapped,
	} as unknown as GPUBuffer;
	const readbackBuffer = {
		mapAsync: async () => undefined,
		getMappedRange: () => expected.buffer.slice(0),
		unmap: () => {},
		destroy: () => {},
	} as unknown as GPUBuffer;
	const device = {
		queue: { submit: () => {} },
		createBuffer: () => readbackBuffer,
		createCommandEncoder: () =>
			({
				copyBufferToBuffer: () => {},
				finish: () => ({} as GPUCommandBuffer),
			}) as unknown as GPUCommandEncoder,
	} as unknown as GPUDevice;

	const result = await readBackWebGpuFloat32Buffer(device, sourceBuffer, expected.length);
	expect(result).not.toBeNull();
	expect(Array.from(result ?? [])).toEqual(Array.from(expected));
});
