import boundaryAlgebreShaderSource from '../kernels/boundary-algebre.wgsl?raw';
import cityNed2EcefShaderSource from '../kernels/city-ned2ecef.wgsl?raw';
import {
	createCpuWorkflowBackend,
	type CpuComputeWorkflowBackend,
} from '../cpu';
import {
	createBoundaryAlgebreDispatchResources,
	createCityNed2EcefDispatchResources,
} from './buffers';
import {
	compareFloat32Buffers,
	readBackFloat32Buffer,
} from './validation';
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
import { EARTH_RADIUS_METERS } from '../../shared';
import { buildAzimuthIntervals, packAzimuthIntervals } from '../../domain/geojson';
import type { DatasetDiagnostic } from '../../domain/data';
import type { WebGpuComputeContext, WebGpuComputeResources } from './types';

/** Options used to build the WebGPU backend. */
export interface WebGpuWorkflowBackendOptions {
	/** Optional pre-existing GPU device used by the backend. */
	readonly device?: GPUDevice | null;
	/** Optional adapter factory used when no device is injected. */
	readonly requestAdapter?: () => Promise<GPUAdapter | null>;
	/** Optional CPU backend used as a temporary orchestration delegate. */
	readonly cpuBackend?: CpuComputeWorkflowBackend;
}

/** Lightweight WebGPU backend for the migration. */
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
		const delegatedSelection: ComputeProfileSelection =
			selection ?? {
				selected: 'webgpu',
				fallbackUsed: false,
				capabilities: webgpuCapabilities(true),
			};
		const result = await this.#cpuBackend.run(input, options, delegatedSelection);
		const extraTimings: StageTiming[] = [];
		const compareDiagnostics: DatasetDiagnostic[] = [];

		if (result.staticTown) {
			const cityMatrixPass = await this.runCityMatrixPass(context, result);
			extraTimings.push(cityMatrixPass.timing);
			compareDiagnostics.push(...cityMatrixPass.diagnostics);
		}

		for (const geojsonRun of result.geojsonRuns) {
			const boundaryPass = await this.runBoundaryRaycastPass(context, result, geojsonRun);
			extraTimings.push(boundaryPass.timing);
			compareDiagnostics.push(...boundaryPass.diagnostics);
		}

		return {
			...result,
			selection: delegatedSelection,
			benchmark: remapBenchmarkProfile(result.benchmark, extraTimings),
			diagnostics: [
				...result.diagnostics,
				...tagDiagnostics(compareDiagnostics, this.profile),
				{
					severity: 'warning',
					code: 'webgpu-skeleton-cpu-delegation',
					profile: this.profile,
					message: 'WebGPU backend is wired, dispatches real city and GeoJSON boundary WGSL passes, but still delegates the remaining compute stages to the CPU reference backend.',
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
		const cityMatrixModule = device.createShaderModule({ code: cityNed2EcefShaderSource });
		const boundaryModule = device.createShaderModule({ code: boundaryAlgebreShaderSource });
		this.#resources = {
			buffers: [],
			pipeline: {
				passes: [
					{
						name: 'city-ned2ecef',
						stage: 'static-town-precompute',
						profile: 'webgpu',
						inputs: [],
						outputs: [],
						workgroupSize: [1, 1, 1],
						notes: ['First real WGSL kernel: build city NED-to-ECEF matrices from lon/lat radians.'],
					},
					{
						name: 'boundary-algebre',
						stage: 'geojson-boundary-raycast',
						profile: 'webgpu',
						inputs: [],
						outputs: [],
						workgroupSize: [1, 1, 1],
						notes: ['First real WGSL GeoJSON kernel: raycast the retained contours against azimuth samples.'],
					},
				],
			},
			shaderModuleCache: new Map([
				['city-ned2ecef', cityMatrixModule],
				['boundary-algebre', boundaryModule],
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

	private async runCityMatrixPass(
		context: WebGpuComputeContext,
		result: ComputeWorkflowResult,
	): Promise<{ timing: StageTiming; diagnostics: DatasetDiagnostic[] }> {
		const prepared = result.preparedDataset;
		const cityCount = prepared.cityCount;
		if (cityCount <= 0) {
			return {
				timing: {
					stage: 'static-town-precompute',
					scope: 'precompute',
					profile: 'webgpu',
					startedAtMs: 0,
					endedAtMs: 0,
					durationMs: 0,
				},
				diagnostics: [],
			};
		}

		const lonLat = new Float32Array(prepared.cityLonLatRadians);
		const usage = getGpuBufferUsage();
		const buffers = createCityNed2EcefDispatchResources(
			context.device,
			usage,
			lonLat,
			cityCount,
			EARTH_RADIUS_METERS,
		);

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
				{ binding: 0, resource: { buffer: buffers.input.buffer } },
				{ binding: 1, resource: { buffer: buffers.output.buffer } },
				{ binding: 2, resource: { buffer: buffers.uniform.buffer } },
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

		const diagnostics: DatasetDiagnostic[] = [];
		const cityMatricesReadback = await readBackFloat32Buffer(context.device, buffers.output.buffer, cityCount * 16);
		if (cityMatricesReadback) {
			diagnostics.push(
				...compareFloat32Buffers(
					'webgpu-city-matrices',
					result.staticTown?.cityNed2EcefMatrices ?? new Float32Array(cityCount * 16),
					cityMatricesReadback,
				),
			);
		}

		return { timing, diagnostics };
	}

	private async runBoundaryRaycastPass(
		context: WebGpuComputeContext,
		result: ComputeWorkflowResult,
		geojsonRun: ComputeWorkflowResult['geojsonRuns'][number],
	): Promise<{ timing: StageTiming; diagnostics: DatasetDiagnostic[] }> {
		const staticTown = result.staticTown;
		if (!staticTown) {
			return {
				timing: {
					stage: 'geojson-boundary-raycast',
					scope: 'precompute',
					profile: 'webgpu',
					startedAtMs: 0,
					endedAtMs: 0,
					durationMs: 0,
				},
				diagnostics: [],
			};
		}

		const boundary = geojsonRun.boundaryPrecompute;
		const cityCount = staticTown.cityCount;
		const azimuthSampleCount = boundary.azimuthSampleCount;
		const contourCount = boundary.countryContourSizes.length;
		if (cityCount <= 0 || azimuthSampleCount <= 0) {
			return {
				timing: {
					stage: 'geojson-boundary-raycast',
					scope: 'precompute',
					profile: 'webgpu',
					startedAtMs: 0,
					endedAtMs: 0,
					durationMs: 0,
				},
				diagnostics: [],
			};
		}

		const cityMatrices = staticTown.cityNed2EcefMatrices;
		const azimuthIntervals = packAzimuthIntervals(buildAzimuthIntervals(azimuthSampleCount));
		const usage = getGpuBufferUsage();
		const buffers = createBoundaryAlgebreDispatchResources(
			context.device,
			usage,
			{
				cityNed2EcefMatrices: cityMatrices,
				cityContourIndexes: boundary.cityContourIndexes,
				countryContourNVectorBuffer: boundary.countryContourNVectorBuffer,
				countryContourOffsets: boundary.countryContourOffsets,
				countryContourSizes: boundary.countryContourSizes,
				azimuthIntervals,
				cityCount,
				azimuthIntervalCount: azimuthSampleCount,
				contourCount,
				earthRadiusMeters: result.preparedDataset.cityCount > 0 ? EARTH_RADIUS_METERS : 0,
			},
		);

		const resources = await this.ensureResources();
		const pipeline = await context.device.createComputePipelineAsync({
			layout: 'auto',
			compute: {
				module: resources.shaderModuleCache?.get('boundary-algebre') ?? context.device.createShaderModule({ code: boundaryAlgebreShaderSource }),
				entryPoint: 'main',
			},
		});
		const bindGroup = context.device.createBindGroup({
			layout: pipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: buffers.cityMatrices.buffer } },
				{ binding: 1, resource: { buffer: buffers.cityContourIndexes.buffer } },
				{ binding: 2, resource: { buffer: buffers.contourNVectors.buffer } },
				{ binding: 3, resource: { buffer: buffers.contourOffsets.buffer } },
				{ binding: 4, resource: { buffer: buffers.contourSizes.buffer } },
				{ binding: 5, resource: { buffer: buffers.azimuthIntervals.buffer } },
				{ binding: 6, resource: { buffer: buffers.uniform.buffer } },
				{ binding: 7, resource: { buffer: buffers.townBoundaryAngular.buffer } },
				{ binding: 8, resource: { buffer: buffers.townBoundaryEcef.buffer } },
			],
		});

		const { timing } = await measureAsyncStage(
			'geojson-boundary-raycast',
			'precompute',
			'webgpu',
			async () => {
				const encoder = context.device.createCommandEncoder();
				const pass = encoder.beginComputePass();
				pass.setPipeline(pipeline);
				pass.setBindGroup(0, bindGroup);
				pass.dispatchWorkgroups(azimuthSampleCount, cityCount, 1);
				pass.end();
				context.queue.submit([encoder.finish()]);
				return undefined;
			},
		);

		const diagnostics: DatasetDiagnostic[] = [];
		const angularReadback = await readBackFloat32Buffer(
			context.device,
			buffers.townBoundaryAngular.buffer,
			cityCount * azimuthSampleCount * 4,
		);
		const ecefReadback = await readBackFloat32Buffer(
			context.device,
			buffers.townBoundaryEcef.buffer,
			cityCount * azimuthSampleCount * 4,
		);
		if (angularReadback && ecefReadback) {
			diagnostics.push(
				...compareFloat32Buffers(
					'webgpu-boundary-angular',
					geojsonRun.boundaryRaycast.townBoundaryAngular,
					angularReadback,
				),
				...compareFloat32Buffers(
					'webgpu-boundary-ecef',
					geojsonRun.boundaryRaycast.townBoundaryEcef,
					ecefReadback,
				),
			);
		}

		return { timing, diagnostics };
	}
}

/** Returns the WebGPU capability snapshot. */
export function webgpuCapabilities(available = false): ComputeCapabilities {
	return {
		webgpuAvailable: available,
		webgl2Available: false,
		cpuAvailable: true,
		notes: available ? ['WebGPU backend with city NED-to-ECEF and GeoJSON boundary passes'] : ['WebGPU unavailable'],
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

function remapBenchmarkProfile(benchmark: ComputeBenchmarkReport, extraTimings: readonly StageTiming[]): ComputeBenchmarkReport {
	const timings = [...benchmark.timings, ...extraTimings];
	return {
		...benchmark,
		profile: 'webgpu',
		timings: timings.map((timing) => ({
			...timing,
			profile: 'webgpu',
		})),
		totalDurationMs: benchmark.totalDurationMs + extraTimings.reduce((sum, timing) => sum + timing.durationMs, 0),
		notes: [
			...benchmark.notes,
			'WebGPU backend dispatches a city NED-to-ECEF pass and a GeoJSON boundary raycast pass before delegating the remaining compute stages to the CPU reference backend.',
		],
	};
}

function tagDiagnostics<T extends { profile?: string }>(diagnostics: readonly T[], profile: string): T[] {
	return diagnostics.map((diagnostic) =>
		diagnostic.profile === profile ? diagnostic : { ...diagnostic, profile },
	);
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
			MAP_READ: 1 << 0,
		}
	);
}
