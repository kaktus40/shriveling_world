import cityNed2EcefShaderSource from '../kernels/city-ned2ecef.wgsl?raw';
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
	StageTiming,
} from '../core';
import { measureAsyncStage } from '../core/timing';
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
		const staticTownPass = await this.runCityMatrixPass(context, result);
		return {
			...result,
			selection: delegatedSelection,
			benchmark: remapBenchmarkProfile(result.benchmark, staticTownPass.timing),
			diagnostics: [
				...result.diagnostics,
				{
					severity: 'warning',
					code: 'webgpu-skeleton-cpu-delegation',
					message: 'WebGPU backend is wired, dispatches a smoke pass and a city NED-to-ECEF pass, but still delegates the remaining compute stages to the CPU reference backend.',
				},
				{
					severity: 'warning',
					code: 'webgpu-city-matrix-pass-dispatched',
					message: 'WebGPU backend dispatches a real city NED-to-ECEF pass before CPU delegation so the first production-style WGSL kernel is exercised.',
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
		const smokeModule = device.createShaderModule({ code: smokeShaderSource });
		const cityMatrixModule = device.createShaderModule({ code: cityNed2EcefShaderSource });
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
					{
						name: 'city-ned2ecef',
						stage: 'static-town-precompute',
						profile: 'webgpu',
						inputs: [],
						outputs: [],
						workgroupSize: [1, 1, 1],
						notes: ['First real WGSL kernel: build city NED-to-ECEF matrices from lon/lat radians.'],
					},
				],
			},
			shaderModuleCache: new Map([
				['smoke', smokeModule],
				['city-ned2ecef', cityMatrixModule],
			]),
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

	private async runCityMatrixPass(context: WebGpuComputeContext, result: ComputeWorkflowResult): Promise<{ timing: StageTiming }> {
		if (result.preparedDataset.cityCount <= 0) {
			return {
				timing: {
					stage: 'static-town-precompute',
					scope: 'precompute',
					profile: 'webgpu',
					startedAtMs: 0,
					endedAtMs: 0,
					durationMs: 0,
				},
			};
		}

		const prepared = result.preparedDataset;
		const cityCount = prepared.cityCount;
		const lonLat = new Float32Array(prepared.cityLonLatRadians);
		const outputBytes = cityCount * 16 * Float32Array.BYTES_PER_ELEMENT;
		const usage = getGpuBufferUsage();
		const inputBuffer = context.device.createBuffer({
			size: lonLat.byteLength,
			usage: usage.STORAGE | usage.COPY_DST,
		});
		const outputBuffer = context.device.createBuffer({
			size: outputBytes,
			usage: usage.STORAGE | usage.COPY_SRC,
		});
		const uniformBuffer = context.device.createBuffer({
			size: 16,
			usage: usage.UNIFORM | usage.COPY_DST,
		});

		context.queue.writeBuffer(inputBuffer, 0, lonLat);
		const uniformData = new Float32Array([6_371_000, 0, 0, 0]);
		context.queue.writeBuffer(uniformBuffer, 0, uniformData);

		const resources = await this.ensureResources();
		const pipeline = await context.device.createComputePipelineAsync({
			layout: 'auto',
			compute: {
				module: resources.shaderModuleCache?.get('city-ned2ecef') ?? context.device.createShaderModule({ code: cityNed2EcefShaderSource }),
				entryPoint: 'main',
			},
		});
		const bindGroup = context.device.createBindGroup({
			layout: pipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: inputBuffer } },
				{ binding: 1, resource: { buffer: outputBuffer } },
				{ binding: 2, resource: { buffer: uniformBuffer } },
			],
		});

		const { timing } = await measureAsyncStage(
			'static-town-precompute',
			'precompute',
			'webgpu',
			async () => {
				const encoder = context.device.createCommandEncoder();
				const pass = encoder.beginComputePass();
				pass.setPipeline(pipeline);
				pass.setBindGroup(0, bindGroup);
				pass.dispatchWorkgroups(cityCount, 1, 1);
				pass.end();
				context.queue.submit([encoder.finish()]);
				return undefined;
			},
		);

		return { timing };
	}
}

/** Returns the WebGPU capability snapshot. */
export function webgpuCapabilities(available = false): ComputeCapabilities {
	return {
		webgpuAvailable: available,
		webgl2Available: false,
		cpuAvailable: true,
		notes: available ? ['WebGPU backend with smoke and city NED-to-ECEF passes'] : ['WebGPU unavailable'],
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

function remapBenchmarkProfile(benchmark: ComputeBenchmarkReport, extraTiming?: StageTiming): ComputeBenchmarkReport {
	const timings = extraTiming ? [...benchmark.timings, extraTiming] : [...benchmark.timings];
	return {
		...benchmark,
		profile: 'webgpu',
		timings: timings.map((timing) => ({
			...timing,
			profile: 'webgpu',
		})),
		totalDurationMs: benchmark.totalDurationMs + (extraTiming?.durationMs ?? 0),
		notes: [
			...benchmark.notes,
			'WebGPU backend dispatches a smoke pass and a first real city NED-to-ECEF pass before delegating the remaining compute stages to the CPU reference backend.',
		],
	};
}

async function defaultRequestWebGpuAdapter(): Promise<GPUAdapter | null> {
	if (typeof navigator === 'undefined' || !('gpu' in navigator) || !navigator.gpu) {
		return null;
	}
	return navigator.gpu.requestAdapter();
}

function getGpuBufferUsage(): {
	readonly STORAGE: number;
	readonly COPY_DST: number;
	readonly COPY_SRC: number;
	readonly UNIFORM: number;
} {
	const usage = (globalThis as typeof globalThis & {
		GPUBufferUsage?: {
			STORAGE: number;
			COPY_DST: number;
			COPY_SRC: number;
			UNIFORM: number;
		};
	}).GPUBufferUsage;
	return (
		usage ?? {
			STORAGE: 1 << 7,
			COPY_DST: 1 << 3,
			COPY_SRC: 1 << 1,
			UNIFORM: 1 << 6,
		}
	);
}
