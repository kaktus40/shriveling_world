import {
	createCpuComputeBackend,
	type CpuComputeBackend,
} from '../cpu';
import { getGpuBufferUsage, remapBenchmarkProfile, tagDiagnostics } from '../shared/compute';
import { createWebGpuComputeResources } from './resources';
import { runWebGpuCurveGeometryPass } from './passes/curve-geometry';
import type {
	ComputeCapabilities,
	ComputeProfileSelection,
	ComputeBackend,
	ComputeBackendDescriptor,
	ComputeInput,
	ComputeOptions,
	ComputeResult,
	StageTiming,
} from '../core';
import type { DatasetDiagnostic } from '../../domain/data';
import type { WebGpuComputeContext, WebGpuComputeResources } from './types';
import { runWebGpuBoundaryStages } from './boundary';
import { runWebGpuConeStages } from './cone';

/** Options used to build the WebGPU backend. */
export interface WebGpuComputeBackendOptions {
	/** Optional pre-existing GPU device used by the backend. */
	readonly device?: GPUDevice | null;
	/** Optional adapter factory used when no device is injected. */
	readonly requestAdapter?: () => Promise<GPUAdapter | null>;
	/** Optional CPU backend used as a temporary orchestration delegate. */
	readonly cpuBackend?: CpuComputeBackend;
}

/** Lightweight WebGPU backend for the migration. */
export class WebGpuComputeBackend implements ComputeBackend {
	readonly profile = 'webgpu' as const;
	readonly #cpuBackend: CpuComputeBackend;
	#device: GPUDevice | null;
	#requestAdapter: (() => Promise<GPUAdapter | null>) | null;
	#resources: WebGpuComputeResources | null = null;

	constructor(options: WebGpuComputeBackendOptions = {}) {
		this.#device = options.device ?? null;
		this.#requestAdapter = options.requestAdapter ?? null;
		this.#cpuBackend = options.cpuBackend ?? createCpuComputeBackend();
	}

	async computeFrame(
		input: ComputeInput,
		options: ComputeOptions = {},
		selection?: ComputeProfileSelection,
	): Promise<ComputeResult> {
		const context = await this.ensureContext();
		const delegatedSelection: ComputeProfileSelection =
			selection ?? {
				selected: 'webgpu',
				fallbackUsed: false,
				capabilities: webgpuCapabilities(true),
			};
		const result = await this.#cpuBackend.computeFrame(input, options, delegatedSelection);
		const coneStages = await runWebGpuConeStages(context, result, await this.ensureResources());
		const extraTimings: StageTiming[] = [...coneStages.extraTimings];
		const compareDiagnostics: DatasetDiagnostic[] = [...coneStages.diagnostics];

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
			const boundaryPass = await runWebGpuBoundaryStages(
				context,
				result,
				geojsonRun,
				await this.ensureResources(),
			);
			extraTimings.push(boundaryPass.timing);
			if (boundaryPass.extraTimings) {
				extraTimings.push(...boundaryPass.extraTimings);
			}
			compareDiagnostics.push(...boundaryPass.diagnostics);
		}

		return {
			...result,
			selection: delegatedSelection,
			benchmark: remapBenchmarkProfile(
				result.benchmark,
				this.profile,
				extraTimings,
				[
					'WebGPU backend dispatches city NED-to-ECEF, raw-cone alpha, cone-cone, boundary and final geometry passes before delegating the remaining compute stages to the CPU reference backend.',
				],
			),
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
export function createWebGpuComputeBackendDescriptor(
	options: WebGpuComputeBackendOptions = {},
): ComputeBackendDescriptor {
	return {
		profile: 'webgpu',
		isAvailable: () => probeWebGpuAvailability(options.device ?? null, options.requestAdapter ?? null),
		create: async () => new WebGpuComputeBackend(options),
	};
}

async function defaultRequestWebGpuAdapter(): Promise<GPUAdapter | null> {
	if (typeof navigator === 'undefined' || !('gpu' in navigator) || !navigator.gpu) {
		return null;
	}
	return navigator.gpu.requestAdapter();
}
