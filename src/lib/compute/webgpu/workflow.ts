import rawConeAlphasShaderSource from '../kernels/raw-cone-alphas/webgpu.wgsl?raw';
import boundaryAlgebreShaderSource from '../kernels/boundary-algebre/webgpu.wgsl?raw';
import cityNed2EcefShaderSource from '../kernels/city-ned2ecef/webgpu.wgsl?raw';
import curveGeometryShaderSource from '../kernels/curve-geometry/webgpu.wgsl?raw';
import finalConesShaderSource from '../kernels/final-cones/webgpu.wgsl?raw';
import rayIntersectTriangleShaderSource from '../kernels/shared/ray-intersect-triangle/webgpu.wgsl?raw';
import ciseledConesShaderSource from '../kernels/ciseled-cones/webgpu.wgsl?raw';
import {
	createCpuWorkflowBackend,
	type CpuComputeWorkflowBackend,
} from '../cpu';
import {
	createBoundaryAlgebreDispatchResources,
	createCityNed2EcefDispatchResources,
	createCiseledConesDispatchResources,
	createCurveGeometryDispatchResources,
	createFinalConesDispatchResources,
	createRawConeAlphaDispatchResources,
	type GpuBufferAllocation,
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
import {
	prepareCurveGeometryInput,
	prepareCurvePrecompute,
} from '../../domain/precompute';
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
			const curvePass = await this.runCurveGeometryPass(context, result, options);
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
		const cityMatrixModule = device.createShaderModule({ code: cityNed2EcefShaderSource });
		const rawConeAlphaModule = device.createShaderModule({ code: rawConeAlphasShaderSource });
		const ciseledConeModule = device.createShaderModule({
			code: `${rayIntersectTriangleShaderSource}\n${ciseledConesShaderSource}`,
		});
		const finalConeModule = device.createShaderModule({ code: finalConesShaderSource });
		const boundaryModule = device.createShaderModule({ code: boundaryAlgebreShaderSource });
		const curveGeometryModule = device.createShaderModule({ code: curveGeometryShaderSource });
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
					{
						name: 'raw-cone-alphas',
						stage: 'raw-cones-precompute',
						profile: 'webgpu',
						inputs: [],
						outputs: [],
						workgroupSize: [1, 1, 1],
						notes: ['First real WGSL raw-cone kernel: select cone alphas per city and azimuth sample.'],
					},
					{
						name: 'ciseled-cones',
						stage: 'cone-intersections-precompute',
						profile: 'webgpu',
						inputs: [],
						outputs: [],
						workgroupSize: [1, 1, 1],
						notes: ['First real WGSL cone-cone kernel: exhaustively ciseled raw cones against retained neighbors and compared them against the CPU oracle.'],
					},
					{
						name: 'final-cones',
						stage: 'final-cones-precompute',
						profile: 'webgpu',
						inputs: [],
						outputs: [],
						workgroupSize: [1, 1, 1],
						notes: ['Final real WGSL geometry-emission kernel: merge boundary clipping into the final render-ready cone geometry.'],
					},
					{
						name: 'curve-geometry',
						stage: 'curve-geometry-precompute',
						profile: 'webgpu',
						inputs: [],
						outputs: [],
						workgroupSize: [1, 1, 1],
						notes: ['Curve geometry WGSL kernel: sample render-ready curve vertices from prepared curve controls and yearly speed ratios.'],
					},
				],
			},
			shaderModuleCache: new Map([
				['city-ned2ecef', cityMatrixModule],
				['raw-cone-alphas', rawConeAlphaModule],
				['ciseled-cones', ciseledConeModule],
				['final-cones', finalConeModule],
				['boundary-algebre', boundaryModule],
				['curve-geometry', curveGeometryModule],
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

	private async runRawConeAlphaPass(
		context: WebGpuComputeContext,
		result: ComputeWorkflowResult,
	): Promise<{ timing: StageTiming; diagnostics: DatasetDiagnostic[] }> {
		const rawCones = result.rawCones;
		const dynamicTown = result.dynamicTown;
		if (!rawCones || !dynamicTown) {
			return {
				timing: {
					stage: 'raw-cones-precompute',
					scope: 'precompute',
					profile: 'webgpu',
					startedAtMs: 0,
					endedAtMs: 0,
					durationMs: 0,
				},
				diagnostics: [],
			};
		}

		const cityCount = rawCones.cityCount;
		const azimuthSampleCount = rawCones.azimuthSampleCount;
		if (cityCount <= 0 || azimuthSampleCount <= 0) {
			return {
				timing: {
					stage: 'raw-cones-precompute',
					scope: 'precompute',
					profile: 'webgpu',
					startedAtMs: 0,
					endedAtMs: 0,
					durationMs: 0,
				},
				diagnostics: [],
			};
		}

		const usage = getGpuBufferUsage();
		const resources = createRawConeAlphaDispatchResources(
			context.device,
			usage,
			{
				cityLinkOffsets: dynamicTown.cityLinkOffsets,
				cityLinkCounts: dynamicTown.cityLinkCounts,
				cityLinkAzimuthRadians: dynamicTown.cityLinkAzimuthRadians,
				cityLinkAlphaRadians: dynamicTown.cityLinkAlphaRadians,
				cityFastestTerrestrialAlphaRadians: dynamicTown.cityFastestTerrestrialAlphaRadians,
				cityCount,
				azimuthSampleCount,
				roadAlphaRadians: dynamicTown.roadAlphaRadians,
				attenuationRadians: rawCones.attenuationRadians ?? 0,
				shape: rawCones.shape,
			},
		);
		const resourcesCache = await this.ensureResources();
		const pipeline = await context.device.createComputePipelineAsync({
			layout: 'auto',
			compute: {
				module:
					resourcesCache.shaderModuleCache?.get('raw-cone-alphas') ??
					context.device.createShaderModule({ code: rawConeAlphasShaderSource }),
				entryPoint: 'main',
			},
		});
		const bindGroup = context.device.createBindGroup({
			layout: pipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: resources.cityLinkOffsets.buffer } },
				{ binding: 1, resource: { buffer: resources.cityLinkCounts.buffer } },
				{ binding: 2, resource: { buffer: resources.cityLinkAzimuthRadians.buffer } },
				{ binding: 3, resource: { buffer: resources.cityLinkAlphaRadians.buffer } },
				{ binding: 4, resource: { buffer: resources.cityFastestTerrestrialAlphaRadians.buffer } },
				{ binding: 5, resource: { buffer: resources.uniform.buffer } },
				{ binding: 6, resource: { buffer: resources.coneAlphaRadians.buffer } },
			],
		});

		const { timing } = await measureAsyncStage(
			'raw-cones-precompute',
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
		const alphaReadback = await readBackFloat32Buffer(
			context.device,
			resources.coneAlphaRadians.buffer,
			cityCount * azimuthSampleCount,
		);
		if (alphaReadback) {
			diagnostics.push(
				...compareFloat32Buffers(
					'webgpu-raw-cone-alpha',
					rawCones.coneAlphaRadians,
					alphaReadback,
				),
			);
		}

		return { timing, diagnostics };
	}

	private async runCiseledConePass(
		context: WebGpuComputeContext,
		result: ComputeWorkflowResult,
	): Promise<{ timing: StageTiming; diagnostics: DatasetDiagnostic[]; ciseledConeRimEcef?: GpuBufferAllocation }> {
		const staticTown = result.staticTown;
		const rawCones = result.rawCones;
		const reference = result.coneIntersections;
		if (!staticTown || !rawCones || !reference) {
			return {
				timing: {
					stage: 'cone-intersections-precompute',
					scope: 'interactive',
					profile: 'webgpu',
					startedAtMs: 0,
					endedAtMs: 0,
					durationMs: 0,
				},
				diagnostics: [],
			};
		}

		const cityCount = rawCones.cityCount;
		const azimuthSampleCount = rawCones.azimuthSampleCount;
		if (cityCount <= 0 || azimuthSampleCount <= 0) {
			return {
				timing: {
					stage: 'cone-intersections-precompute',
					scope: 'interactive',
					profile: 'webgpu',
					startedAtMs: 0,
					endedAtMs: 0,
					durationMs: 0,
				},
				diagnostics: [],
			};
		}

		const usage = getGpuBufferUsage();
		const resources = createCiseledConesDispatchResources(
			context.device,
			usage,
			{
				cityNed2EcefMatrices: staticTown.cityNed2EcefMatrices,
				overlapCandidates: staticTown.overlapCandidates,
				overlapCandidateCounts: staticTown.overlapCandidateCounts,
				rawConeRimEcef: rawCones.rawConeRimEcef,
				cityCount,
				azimuthSampleCount,
				neighborLimit: staticTown.neighborLimit,
			},
		);

		const resourcesCache = await this.ensureResources();
		const pipeline = await context.device.createComputePipelineAsync({
			layout: 'auto',
			compute: {
				module:
					resourcesCache.shaderModuleCache?.get('ciseled-cones') ??
					context.device.createShaderModule({ code: ciseledConesShaderSource }),
				entryPoint: 'main',
			},
		});
		const bindGroup = context.device.createBindGroup({
			layout: pipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: resources.cityMatrices.buffer } },
				{ binding: 1, resource: { buffer: resources.overlapCandidates.buffer } },
				{ binding: 2, resource: { buffer: resources.overlapCandidateCounts.buffer } },
				{ binding: 3, resource: { buffer: resources.rawConeRimEcef.buffer } },
				{ binding: 4, resource: { buffer: resources.uniform.buffer } },
				{ binding: 5, resource: { buffer: resources.coneIntersectionDistanceMeters.buffer } },
				{ binding: 6, resource: { buffer: resources.ciseledConeRimEcef.buffer } },
			],
		});

		const { timing } = await measureAsyncStage(
			'cone-intersections-precompute',
			'interactive',
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
		const distanceReadback = await readBackFloat32Buffer(
			context.device,
			resources.coneIntersectionDistanceMeters.buffer,
			cityCount * azimuthSampleCount,
		);
		const rimReadback = await readBackFloat32Buffer(
			context.device,
			resources.ciseledConeRimEcef.buffer,
			cityCount * azimuthSampleCount * 4,
		);
		if (distanceReadback && rimReadback) {
			diagnostics.push(
				...compareFloat32Buffers(
					'webgpu-cone-intersection-distance',
					reference.coneIntersectionDistanceMeters,
					distanceReadback,
				),
				...compareFloat32Buffers(
					'webgpu-ciseled-cone-rim',
					reference.ciseledConeRimEcef,
					rimReadback,
				),
			);
		}

		return { timing, diagnostics, ciseledConeRimEcef: resources.ciseledConeRimEcef };
	}

	private async runBoundaryRaycastPass(
		context: WebGpuComputeContext,
		result: ComputeWorkflowResult,
		geojsonRun: ComputeWorkflowResult['geojsonRuns'][number],
	): Promise<{ timing: StageTiming; extraTimings?: StageTiming[]; diagnostics: DatasetDiagnostic[] }> {
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
				extraTimings: [],
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
				extraTimings: [],
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

		if (this.#ciseledConeRimEcef && geojsonRun.finalCones) {
			const finalResources = createFinalConesDispatchResources(
				context.device,
				usage,
				{
					ciseledConeRimEcef: this.#ciseledConeRimEcef,
					townBoundaryAngular: buffers.townBoundaryAngular,
					townBoundaryEcef: buffers.townBoundaryEcef,
					cityCount,
					azimuthSampleCount,
					earthRadiusMeters: EARTH_RADIUS_METERS,
				},
			);
			const finalPipeline = await context.device.createComputePipelineAsync({
				layout: 'auto',
				compute: {
					module:
						resources.shaderModuleCache?.get('final-cones') ??
						context.device.createShaderModule({ code: finalConesShaderSource }),
					entryPoint: 'main',
				},
			});
			const finalBindGroup = context.device.createBindGroup({
				layout: finalPipeline.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: { buffer: finalResources.ciseledConeRimEcef.buffer } },
					{ binding: 1, resource: { buffer: finalResources.townBoundaryAngular.buffer } },
					{ binding: 2, resource: { buffer: finalResources.townBoundaryEcef.buffer } },
					{ binding: 3, resource: { buffer: finalResources.uniform.buffer } },
					{ binding: 4, resource: { buffer: finalResources.finalConeGeometryEcef.buffer } },
				],
			});
			const finalTiming = await measureAsyncStage(
				'final-cones-precompute',
				'precompute',
				'webgpu',
				async () => {
					const encoder = context.device.createCommandEncoder();
					const pass = encoder.beginComputePass();
					pass.setPipeline(finalPipeline);
					pass.setBindGroup(0, finalBindGroup);
					pass.dispatchWorkgroups(azimuthSampleCount, cityCount, 1);
					pass.end();
					context.queue.submit([encoder.finish()]);
					return undefined;
				},
			);
			const finalReadback = await readBackFloat32Buffer(
				context.device,
				finalResources.finalConeGeometryEcef.buffer,
				cityCount * azimuthSampleCount * 4,
			);
			if (finalReadback) {
				diagnostics.push(
					...compareFloat32Buffers(
						'webgpu-final-cone-geometry',
						geojsonRun.finalCones.finalConeGeometryEcef,
						finalReadback,
					),
				);
			}
			return {
				timing,
				extraTimings: [finalTiming.timing],
				diagnostics,
			};
		}

		return { timing, diagnostics };
	}

	private async runCurveGeometryPass(
		context: WebGpuComputeContext,
		result: ComputeWorkflowResult,
		options: ComputeWorkflowOptions,
	): Promise<{ timing: StageTiming; diagnostics: DatasetDiagnostic[] }> {
		const staticTown = result.staticTown;
		const curveGeometry = result.curveGeometry;
		if (!staticTown || !curveGeometry) {
			return {
				timing: {
					stage: 'curve-geometry-precompute',
					scope: 'precompute',
					profile: 'webgpu',
					startedAtMs: 0,
					endedAtMs: 0,
					durationMs: 0,
				},
				diagnostics: [],
			};
		}

		const curvePrecompute = prepareCurvePrecompute(result.preparedDataset, staticTown);
		const curveInput = prepareCurveGeometryInput(curvePrecompute, {
			year: options.curve?.year ?? result.dynamicTown?.year ?? result.preparedDataset.speedTimeline.span.beginYear,
			pointsPerCurve: options.curve?.pointsPerCurve ?? curveGeometry.pointsPerCurve,
			curvePosition: options.curve?.curvePosition ?? 'above',
			coefficient: options.curve?.coefficient ?? 1,
		});

		if (curveInput.curveCount <= 0) {
			return {
				timing: {
					stage: 'curve-geometry-precompute',
					scope: 'precompute',
					profile: 'webgpu',
					startedAtMs: 0,
					endedAtMs: 0,
					durationMs: 0,
				},
				diagnostics: tagDiagnostics(curvePrecompute.diagnostics, this.profile),
			};
		}

		const usage = getGpuBufferUsage();
		const dispatchResources = createCurveGeometryDispatchResources(context.device, usage, {
			...curveInput,
			earthRadiusMeters: EARTH_RADIUS_METERS,
		});
		const resources = await this.ensureResources();
		const pipeline = await context.device.createComputePipelineAsync({
			layout: 'auto',
			compute: {
				module:
					resources.shaderModuleCache?.get('curve-geometry') ??
					context.device.createShaderModule({ code: curveGeometryShaderSource }),
				entryPoint: 'main',
			},
		});
		const bindGroup = context.device.createBindGroup({
			layout: pipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: dispatchResources.curveControlPointsEcef.buffer } },
				{ binding: 1, resource: { buffer: dispatchResources.curveThetaRadians.buffer } },
				{ binding: 2, resource: { buffer: dispatchResources.curveSpeedRatio.buffer } },
				{ binding: 3, resource: { buffer: dispatchResources.curveIds.buffer } },
				{ binding: 4, resource: { buffer: dispatchResources.uniform.buffer } },
				{ binding: 5, resource: { buffer: dispatchResources.curveVertexPositions.buffer } },
			],
		});

		const { timing } = await measureAsyncStage(
			'curve-geometry-precompute',
			'precompute',
			'webgpu',
			async () => {
				const encoder = context.device.createCommandEncoder();
				const pass = encoder.beginComputePass();
				pass.setPipeline(pipeline);
				pass.setBindGroup(0, bindGroup);
				pass.dispatchWorkgroups(curveInput.pointsPerCurve + 1, curveInput.curveCount, 1);
				pass.end();
				context.queue.submit([encoder.finish()]);
				return undefined;
			},
		);

		const diagnostics: DatasetDiagnostic[] = [];
		const readback = await readBackFloat32Buffer(
			context.device,
			dispatchResources.curveVertexPositions.buffer,
			curveInput.curveCount * (curveInput.pointsPerCurve + 1) * 4,
		);
		if (readback) {
			diagnostics.push(
				...compareFloat32Buffers(
					'webgpu-curve-geometry',
					curveGeometry.positions,
					readback,
				),
			);
		}

		diagnostics.push(...tagDiagnostics(curvePrecompute.diagnostics, this.profile));
		return { timing, diagnostics };
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
