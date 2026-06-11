import smokeShaderSource from '../kernels/smoke.wgsl?raw';
import {
	createCpuWorkflowBackend,
	type CpuComputeWorkflowBackend,
} from '../cpu';
import type {
	ComputeBenchmarkReport,
	ComputeCapabilities,
	ComputeProfileSelection,
	ComputeWorkflowBackend,
	ComputeWorkflowBackendDescriptor,
	ComputeWorkflowInput,
	ComputeWorkflowOptions,
	ComputeWorkflowResult,
} from '../core';
import type { WebGpuComputeContext, WebGpuComputeResources } from './types';

/** Options used to build the WebGPU skeleton backend. */
export interface WebGpuWorkflowBackendOptions {
	/** Optional pre-existing GPU device used by the backend. */
	readonly device?: GPUDevice | null;
	/** Optional adapter factory used when no device is injected. */
	readonly requestAdapter?: () => Promise<GPUAdapter | null>;
	/** Optional CPU backend used as a temporary orchestration delegate. */
	readonly cpuBackend?: CpuComputeWorkflowBackend;
}

/** Lightweight WebGPU backend skeleton for the migration. */
export class WebGpuComputeWorkflowBackend implements ComputeWorkflowBackend {
	readonly profile = 'webgpu' as const;
	readonly #cpuBackend: CpuComputeWorkflowBackend;
	#device: GPUDevice | null;
	#requestAdapter: (() => Promise<GPUAdapter | null>) | null;
	#resources: WebGpuComputeResources | null = null;

	constructor(options: WebGpuWorkflowBackendOptions = {}) {
		this.#device = options.device ?? null;
		this.#requestAdapter = options.requestAdapter ?? null;
		this.#cpuBackend = options.cpuBackend ?? createCpuWorkflowBackend();
	}

	async run(
		input: ComputeWorkflowInput,
		options: ComputeWorkflowOptions = {},
		selection?: ComputeProfileSelection,
	): Promise<ComputeWorkflowResult> {
		const context = await this.ensureContext();
		await this.runSmokePass(context);
		const delegatedSelection: ComputeProfileSelection =
			selection ?? {
				selected: 'webgpu',
				fallbackUsed: false,
				capabilities: webgpuCapabilities(true),
			};
		const result = await this.#cpuBackend.run(input, options, delegatedSelection);
		return {
			...result,
			selection: delegatedSelection,
			benchmark: remapBenchmarkProfile(result.benchmark),
			diagnostics: [
				...result.diagnostics,
				{
					severity: 'warning',
					code: 'webgpu-skeleton-cpu-delegation',
					message: 'WebGPU backend is wired and dispatches a smoke pass, but still delegates compute stages to the CPU reference backend.',
				},
			],
		};
	}

	async dispose(): Promise<void> {
		await this.#cpuBackend.dispose();
		this.#resources = null;
		this.#device = null;
	}

	async ensureAvailable(): Promise<boolean> {
		return probeWebGpuAvailability(this.#device, this.#requestAdapter);
	}

	async ensureContext(): Promise<WebGpuComputeContext> {
		const device = await this.ensureDevice();
		return {
			device,
			queue: device.queue,
			selection: {
				selected: 'webgpu',
				fallbackUsed: false,
				capabilities: webgpuCapabilities(true),
			},
		};
	}

	async ensureResources(): Promise<WebGpuComputeResources> {
		if (this.#resources) {
			return this.#resources;
		}
		const device = await this.ensureDevice();
		const shaderModule = device.createShaderModule({ code: smokeShaderSource });
		this.#resources = {
			buffers: [],
			pipeline: {
				passes: [
					{
						name: 'smoke',
						stage: 'prepared-dataset',
						profile: 'webgpu',
						inputs: [],
						outputs: [],
						workgroupSize: [1, 1, 1],
						notes: ['Smoke kernel used to prove the WebGPU path before real passes are wired.'],
					},
				],
			},
			shaderModuleCache: new Map([['smoke', shaderModule]]),
			pipelineCache: new Map(),
			bindGroupCache: new Map(),
		};
		return this.#resources;
	}

	private async ensureDevice(): Promise<GPUDevice> {
		if (this.#device) {
			return this.#device;
		}
		const requestAdapter = this.#requestAdapter ?? defaultRequestWebGpuAdapter;
		const adapter = await requestAdapter();
		if (!adapter) {
			throw new Error('WebGPU compute backend unavailable: no adapter could be created');
		}
		this.#device = await adapter.requestDevice();
		return this.#device;
	}

	private async runSmokePass(context: WebGpuComputeContext): Promise<void> {
		const resources = await this.ensureResources();
		const pipeline = await context.device.createComputePipelineAsync({
			layout: 'auto',
			compute: {
				module: resources.shaderModuleCache?.get('smoke') ?? context.device.createShaderModule({ code: smokeShaderSource }),
				entryPoint: 'main',
			},
		});
		const encoder = context.device.createCommandEncoder();
		const pass = encoder.beginComputePass();
		pass.setPipeline(pipeline);
		pass.dispatchWorkgroups(1, 1, 1);
		pass.end();
		context.queue.submit([encoder.finish()]);
	}
}

/** Returns the WebGPU capability snapshot. */
export function webgpuCapabilities(available = false): ComputeCapabilities {
	return {
		webgpuAvailable: available,
		webgl2Available: false,
		cpuAvailable: true,
		notes: available ? ['WebGPU skeleton backend'] : ['WebGPU unavailable'],
	};
}

/** Probes whether a WebGPU adapter or device is available. */
export async function probeWebGpuAvailability(
	device?: GPUDevice | null,
	requestAdapter: (() => Promise<GPUAdapter | null>) | null = null,
): Promise<boolean> {
	if (device) {
		return true;
	}
	const adapter = await (requestAdapter ?? defaultRequestWebGpuAdapter)();
	return adapter !== null;
}

/** Creates a WebGPU backend descriptor used by profile selection. */
export function createWebGpuWorkflowBackendDescriptor(
	options: WebGpuWorkflowBackendOptions = {},
): ComputeWorkflowBackendDescriptor {
	return {
		profile: 'webgpu',
		isAvailable: () => probeWebGpuAvailability(options.device ?? null, options.requestAdapter ?? null),
		create: async () => new WebGpuComputeWorkflowBackend(options),
	};
}

function remapBenchmarkProfile(benchmark: ComputeBenchmarkReport): ComputeBenchmarkReport {
	return {
		...benchmark,
		profile: 'webgpu',
		timings: benchmark.timings.map((timing) => ({
			...timing,
			profile: 'webgpu',
		})),
		notes: [...benchmark.notes, 'WebGPU skeleton currently dispatches a smoke pass and delegates compute stages to the CPU reference backend.'],
	};
}

async function defaultRequestWebGpuAdapter(): Promise<GPUAdapter | null> {
	if (typeof navigator === 'undefined' || !('gpu' in navigator) || !navigator.gpu) {
		return null;
	}
	return navigator.gpu.requestAdapter();
}

