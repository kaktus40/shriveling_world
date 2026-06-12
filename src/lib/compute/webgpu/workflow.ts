import {
	createCpuWorkflowBackend,
	type CpuComputeWorkflowBackend,
} from '../cpu';
import { type GpuBufferAllocation } from './buffers';
import { createWebGpuComputeResources } from './resources';
import { runWebGpuCityMatrixPass } from './passes/city-ned2ecef';
import { runWebGpuBoundaryRaycastPass } from './passes/boundary-algebre';
import { runWebGpuCiseledConePass } from './passes/ciseled-cones';
import { runWebGpuCurveGeometryPass } from './passes/curve-geometry';
import { runWebGpuRawConeAlphaPass } from './passes/raw-cone-alphas';
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
	#ciseledConeRimEcef: GpuBufferAllocation | null = null;

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
		this.#ciseledConeRimEcef = null;
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

		if (result.rawCones) {
			const rawConeAlphaPass = await this.runRawConeAlphaPass(context, result);
			extraTimings.push(rawConeAlphaPass.timing);
			compareDiagnostics.push(...rawConeAlphaPass.diagnostics);
		}

		if (result.staticTown && result.rawCones && result.coneIntersections) {
			const ciseledConePass = await this.runCiseledConePass(context, result);
			extraTimings.push(ciseledConePass.timing);
			compareDiagnostics.push(...ciseledConePass.diagnostics);
			if (ciseledConePass.ciseledConeRimEcef) {
				this.#ciseledConeRimEcef = ciseledConePass.ciseledConeRimEcef;
			}
		}

		if (options.curve?.enabled === true && result.staticTown && result.curveGeometry) {
			const curvePass = await runWebGpuCurveGeometryPass({
				context,
				result,
				options,
				resources: await this.ensureResources(),
				usage: getGpuBufferUsage(),
			});
			extraTimings.push(curvePass.timing);
			compareDiagnostics.push(...curvePass.diagnostics);
		}

		for (const geojsonRun of result.geojsonRuns) {
			const boundaryPass = await this.runBoundaryRaycastPass(context, result, geojsonRun);
			extraTimings.push(boundaryPass.timing);
			if (boundaryPass.extraTimings) {
				extraTimings.push(...boundaryPass.extraTimings);
			}
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
					code: 'webgpu-partial-cpu-delegation',
					profile: this.profile,
					message: 'WebGPU backend is wired, dispatches real city, raw-cone and cone-cone WGSL passes, but still delegates the remaining compute stages to the CPU reference backend.',
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
		this.#resources = createWebGpuComputeResources(device);
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
		return runWebGpuCityMatrixPass({
			context,
			result,
			resources: await this.ensureResources(),
			usage: getGpuBufferUsage(),
		});
	}

	private async runRawConeAlphaPass(
		context: WebGpuComputeContext,
		result: ComputeWorkflowResult,
	): Promise<{ timing: StageTiming; diagnostics: DatasetDiagnostic[] }> {
		return runWebGpuRawConeAlphaPass({
			context,
			result,
			resources: await this.ensureResources(),
			usage: getGpuBufferUsage(),
		});
	}

	private async runCiseledConePass(
		context: WebGpuComputeContext,
		result: ComputeWorkflowResult,
	): Promise<{ timing: StageTiming; diagnostics: DatasetDiagnostic[]; ciseledConeRimEcef?: GpuBufferAllocation }> {
		return runWebGpuCiseledConePass({
			context,
			result,
			resources: await this.ensureResources(),
			usage: getGpuBufferUsage(),
		});
	}

	private async runBoundaryRaycastPass(
		context: WebGpuComputeContext,
		result: ComputeWorkflowResult,
		geojsonRun: ComputeWorkflowResult['geojsonRuns'][number],
	): Promise<{ timing: StageTiming; extraTimings?: StageTiming[]; diagnostics: DatasetDiagnostic[] }> {
		return runWebGpuBoundaryRaycastPass({
			context,
			result,
			geojsonRun,
			resources: await this.ensureResources(),
		});
	}

}

/** Returns the WebGPU capability snapshot. */
export function webgpuCapabilities(available = false): ComputeCapabilities {
	return {
		webgpuAvailable: available,
		webgl2Available: false,
		cpuAvailable: true,
		notes: available
			? ['WebGPU backend with city NED-to-ECEF, GeoJSON boundary, cone-cone and final geometry passes']
			: ['WebGPU unavailable'],
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
			'WebGPU backend dispatches city NED-to-ECEF, raw-cone alpha, cone-cone, boundary and final geometry passes before delegating the remaining compute stages to the CPU reference backend.',
		],
	};
}

function tagDiagnostics<T extends { severity: 'warning' | 'error'; code: string; profile?: string }>(
	diagnostics: readonly T[],
	profile: string,
): T[] {
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
	readonly MAP_READ: number;
} {
	const usage = (globalThis as typeof globalThis & {
		GPUBufferUsage?: {
			STORAGE: number;
			COPY_DST: number;
			COPY_SRC: number;
			UNIFORM: number;
			MAP_READ: number;
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
