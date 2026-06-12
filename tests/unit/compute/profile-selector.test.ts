import { expect, test } from 'vitest';
import { getComputeFallbackChain, selectComputeProfile, type ComputeBackendDescriptor } from '$lib/compute';

function descriptor(profile: 'webgpu' | 'webgl2' | 'cpu', available: boolean): ComputeBackendDescriptor {
	return {
		profile,
		isAvailable: () => available,
		create: async () => ({
			profile,
			computeFrame: async () => {
				throw new Error('not implemented');
			},
			dispose: async () => {},
		}),
	};
}

test('compute fallback chain remains webgpu then webgl2 then cpu', () => {
	expect(getComputeFallbackChain()).toEqual(['webgpu', 'webgl2', 'cpu']);
	expect(getComputeFallbackChain('webgl2')).toEqual(['webgl2', 'cpu']);
	expect(getComputeFallbackChain('cpu')).toEqual(['cpu']);
});

test('compute selector can force webgl2 when it is available', async () => {
	const selection = await selectComputeProfile(
		{ forced: 'webgl2' },
		{
			webgpu: descriptor('webgpu', false),
			webgl2: descriptor('webgl2', true),
			cpu: descriptor('cpu', true),
		},
	);

	expect(selection.selected).toBe('webgl2');
	expect(selection.fallbackUsed).toBe(false);
});

test('compute selector can force webgpu when it is available', async () => {
	const selection = await selectComputeProfile(
		{ forced: 'webgpu' },
		{
			webgpu: descriptor('webgpu', true),
			webgl2: descriptor('webgl2', true),
			cpu: descriptor('cpu', true),
		},
	);

	expect(selection.selected).toBe('webgpu');
	expect(selection.fallbackUsed).toBe(false);
});

test('compute selector can force cpu even when accelerators are available', async () => {
	const selection = await selectComputeProfile(
		{ forced: 'cpu' },
		{
			webgpu: descriptor('webgpu', true),
			webgl2: descriptor('webgl2', true),
			cpu: descriptor('cpu', true),
		},
	);

	expect(selection.selected).toBe('cpu');
	expect(selection.fallbackUsed).toBe(false);
});

test('compute selector falls back from webgpu to webgl2 then cpu', async () => {
	const selection = await selectComputeProfile(
		{ preferred: 'webgpu' },
		{
			webgpu: descriptor('webgpu', false),
			webgl2: descriptor('webgl2', true),
			cpu: descriptor('cpu', true),
		},
	);

	expect(selection.selected).toBe('webgl2');
	expect(selection.fallbackUsed).toBe(true);
	expect(selection.fallbackFrom).toBe('webgpu');
});
