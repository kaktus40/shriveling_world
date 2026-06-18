import { expect, test } from 'vitest';
import { probeWebGpuAvailability } from '$lib/compute';

function makeMockModule(messages: { type: string; message: string }[] | null) {
	return {
		getCompilationInfo: messages
			? async () => ({ messages })
			: undefined,
	};
}

function makeMockDevice(modules: (ReturnType<typeof makeMockModule> | null)[]) {
	return {
		createShaderModule: () => {
			// Return modules in sequence; tests don't rely on which module maps to which
			return modules.shift() ?? ({} as unknown);
		},
	} as any as GPUDevice;
}

test('probe returns false when shader compilation reports error messages', async () => {
	const moduleWithError = makeMockModule([{ type: 'error', message: 'syntax' }]);
	const device = makeMockDevice([moduleWithError, moduleWithError, moduleWithError, moduleWithError, moduleWithError, moduleWithError]);

	const mockAdapter = {
		requestDevice: async () => device,
	};
	const requestAdapter = async () => mockAdapter as any;

	const available = await probeWebGpuAvailability(undefined, requestAdapter);
	expect(available).toBe(false);
});

test('probe returns true when shader compilation reports no errors', async () => {
	const moduleOk = makeMockModule([]);
	const device = makeMockDevice([moduleOk, moduleOk, moduleOk, moduleOk, moduleOk, moduleOk]);
	const mockAdapter = {
		requestDevice: async () => device,
	};
	const requestAdapter = async () => mockAdapter as any;

	const available = await probeWebGpuAvailability(undefined, requestAdapter);
	expect(available).toBe(true);
});

test('probe returns true when getCompilationInfo is not available on modules', async () => {
	const moduleNoInfo = makeMockModule(null);
	const device = makeMockDevice([moduleNoInfo, moduleNoInfo, moduleNoInfo, moduleNoInfo, moduleNoInfo, moduleNoInfo]);
	const mockAdapter = {
		requestDevice: async () => device,
	};
	const requestAdapter = async () => mockAdapter as any;

	const available = await probeWebGpuAvailability(undefined, requestAdapter);
	expect(available).toBe(true);
});
