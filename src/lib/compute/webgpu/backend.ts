import { WarmingOrchestrator } from "./warming";
import {
	createCpuComputeBackend,
	type CpuComputeBackend,
} from '../cpu';
import { getGpuBufferUsage, remapBenchmarkProfile, tagDiagnostics } from '../shared/compute';
import { createWebGpuComputeResources } from './resources';
import { runWebGpuCurveGeometryPass } from './passes/curve-geometry';
import { runWebGpuCountryProjectionPass } from './passes/country-projection';
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
	#warmingOrchestrator: WarmingOrchestrator | null = null;
	#device: GPUDevice | null;
	#requestAdapter: (() => Promise<GPUAdapter | null>) | null;
	#resources: WebGpuComputeResources | null = null;

	constructor(options: WebGpuComputeBackendOptions = {}) {
		this.#device = options.device ?? null;
		this.#requestAdapter = options.requestAdapter ?? null;
		this.#cpuBackend = options.cpuBackend ?? createCpuComputeBackend();
	}

	async warm(): Promise<void> {
		if (!(await this.ensureAvailable())) {
			throw new Error('WebGPU compute backend unavailable: no adapter could be created');
		}
		await this.ensureContext();
		await this.ensureResources();
	}

	private async ensureWarmingOrchestrator(result: ComputeResult): Promise<WarmingOrchestrator> {
		if (this.#warmingOrchestrator) {
			return this.#warmingOrchestrator;
		}
		
		const span = result.preparedDataset.speedTimeline.span;
		const allYears = [];
		for(let year = span.beginYear; year <= span.endYear; year++) {
			allYears.push(year);
		}

		this.#warmingOrchestrator = new WarmingOrchestrator(
			await this.ensureContext(),
			await this.ensureResources(),
			result,
			allYears
		);
		return this.#warmingOrchestrator;
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
		
		if ((options as any)._invalidateStatic) {
			this.#resources?.staticInvariants?.clear();
			this.#warmingOrchestrator = null;
		}

		// Initialize warming orchestrator
		const warming = await this.ensureWarmingOrchestrator(result);
		const dynamicYear = options.dynamicYear ?? result.preparedDataset.speedTimeline.span.beginYear;
		warming.setFocusYear(dynamicYear);

		// Use cache for distances (t)
		const cachedDistances = warming.getCache().get(dynamicYear);
        let cachedCiseledRim;
        if (cachedDistances) {
            const usage = getGpuBufferUsage();
            const buffer = context.device.createBuffer({
                size: cachedDistances.byteLength,
                usage: usage.STORAGE | usage.COPY_DST,
            });
            context.device.queue.writeBuffer(buffer, 0, cachedDistances);
            cachedCiseledRim = {
                buffer,
                contract: { name: 'cached-ciseled', size: cachedDistances.byteLength, usage: 'STORAGE' } as any
            };
        }

		const coneStages = await runWebGpuConeStages(context, result, await this.ensureResources(), options, cachedCiseledRim);
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
			// Boundary/Clipping pass
			const boundaryPass = await runWebGpuBoundaryStages(
				context,
				result,
				geojsonRun,
				await this.ensureResources(),
				options,
			);
			extraTimings.push(boundaryPass.timing);
			
			// Country projection pass
			if (geojsonRun.countryGeometries) {
				const projectionPass = await runWebGpuCountryProjectionPass({
					context,
					result,
					resources: await this.ensureResources(),
					countryVertices: geojsonRun.countryGeometries as any,
					options,
				});
				extraTimings.push(projectionPass.timing);
			}

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
				['WebGPU backend dispatches city NED-to-ECEF, raw-cone alpha, cone-cone, boundary, country projection, final cone geometry and final curve geometry passes.'],
			),
			diagnostics: [
				...result.diagnostics,
				...tagDiagnostics(compareDiagnostics, this.profile),
			],
		};
	}

	async dispose(): Promise<void> {
		await this.#cpuBackend.dispose();
		this.#resources = null;
		this.#device = null;
		this.#warmingOrchestrator = null;
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
// ... (helper functions probeWebGpuAvailability, webgpuCapabilities, createWebGpuComputeBackendDescriptor, defaultRequestWebGpuAdapter remain same)
