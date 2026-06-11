import rawConeAlphasVertexShaderSource from '../kernels/raw-cone-alphas-webgl2.vert?raw';
import cityNed2EcefVertexShaderSource from '../kernels/city-ned2ecef-webgl2.vert?raw';
import boundaryAlgebreVertexShaderSource from '../kernels/boundary-algebre-webgl2.vert?raw';
import rayIntersectTriangleWebGl2ShaderSource from '../kernels/ray-intersect-triangle-webgl2.glsl?raw';
import ciseledConesVertexShaderSource from '../kernels/ciseled-cones-webgl2.vert?raw';
import {
	createCpuWorkflowBackend,
	type CpuComputeWorkflowBackend,
} from '../cpu';
import {
	createCiseledConesDispatchResources,
	createCiseledConesProgram,
	createBoundaryAlgebreDispatchResources,
	createBoundaryAlgebreProgram,
	createCityNed2EcefDispatchResources,
	createCityNed2EcefProgram,
	createRawConeAlphasDispatchResources,
	createRawConeAlphasProgram,
	type WebGl2CiseledConesDispatchResources,
	type WebGl2BoundaryAlgebreDispatchResources,
	type WebGl2RawConeAlphaDispatchResources,
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
import type { ConeShape } from '../../domain/precompute';
import type { DatasetDiagnostic } from '../../domain/data';
import type { WebGl2ComputeContext, WebGl2ComputeResources } from './types';

/** Canvas-like source used to probe or create a WebGL2 context. */
export type WebGl2CanvasLike = HTMLCanvasElement | OffscreenCanvas;

/** Options used to build the WebGL2 fallback backend. */
export interface WebGl2WorkflowBackendOptions {
	/** Optional pre-existing canvas used to create the WebGL2 context. */
	readonly canvas?: WebGl2CanvasLike;
	/** Optional canvas factory used when no canvas is injected. */
	readonly createCanvas?: () => WebGl2CanvasLike | null;
	/** Optional CPU backend used as a temporary orchestration delegate. */
	readonly cpuBackend?: CpuComputeWorkflowBackend;
}

/** Operational WebGL2 fallback backend for the migration. */
export class WebGl2ComputeWorkflowBackend implements ComputeWorkflowBackend {
	readonly profile = 'webgl2' as const;
	readonly #canvas: WebGl2CanvasLike | null;
	readonly #cpuBackend: CpuComputeWorkflowBackend;
	#gl: WebGL2RenderingContext | null;
	#resources: WebGl2ComputeResources | null = null;

	constructor(options: WebGl2WorkflowBackendOptions = {}) {
		this.#canvas = options.canvas ?? options.createCanvas?.() ?? null;
		this.#gl = probeWebGl2Context(this.#canvas);
		this.#cpuBackend = options.cpuBackend ?? createCpuWorkflowBackend();
	}

	async run(
		input: ComputeWorkflowInput,
		options: ComputeWorkflowOptions = {},
		selection?: ComputeProfileSelection,
	): Promise<ComputeWorkflowResult> {
		const available = await this.ensureAvailable();
		if (!available) {
			throw new Error('WebGL2 compute backend unavailable: no WebGL2 context could be created');
		}

		const delegatedSelection: ComputeProfileSelection =
			selection ?? {
				selected: 'webgl2',
				fallbackUsed: false,
				capabilities: webgl2Capabilities(true),
			};
		const result = await this.#cpuBackend.run(input, options, delegatedSelection);
		const extraTimings: StageTiming[] = [];
		const compareDiagnostics: DatasetDiagnostic[] = [];

		if (result.staticTown) {
			const cityMatrixPass = await this.runCityMatrixPass(result);
			extraTimings.push(cityMatrixPass.timing);
			compareDiagnostics.push(...cityMatrixPass.diagnostics);
		}

		if (result.rawCones) {
			const rawConeAlphaPass = await this.runRawConeAlphaPass(result);
			extraTimings.push(rawConeAlphaPass.timing);
			compareDiagnostics.push(...rawConeAlphaPass.diagnostics);
		}

		if (result.staticTown && result.rawCones && result.coneIntersections) {
			const ciseledConePass = await this.runCiseledConePass(result);
			extraTimings.push(ciseledConePass.timing);
			compareDiagnostics.push(...ciseledConePass.diagnostics);
		}

		for (const geojsonRun of result.geojsonRuns) {
			const boundaryPass = await this.runBoundaryRaycastPass(result, geojsonRun);
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
					code: 'webgl2-city-matrix-pass-dispatched',
					profile: this.profile,
					message: 'WebGL2 backend dispatches a real city NED-to-ECEF transform-feedback pass before delegating the remaining compute stages to the CPU reference backend.',
				},
				{
					severity: 'warning',
					code: 'webgl2-ciseled-cones-pass-dispatched',
					profile: this.profile,
					message: 'WebGL2 backend dispatches a real cone-cone pass before delegating the remaining compute stages to the CPU reference backend.',
				},
				{
					severity: 'warning',
					code: 'webgl2-boundary-raycast-pass-dispatched',
					profile: this.profile,
					message: 'WebGL2 backend dispatches a real GeoJSON boundary transform-feedback pass before delegating the remaining compute stages to the CPU reference backend.',
				},
			],
		};
	}

	async dispose(): Promise<void> {
		await this.#cpuBackend.dispose();
		this.#resources = null;
		this.#gl = null;
	}

	async ensureAvailable(): Promise<boolean> {
		return probeWebGl2Availability(this.#canvas);
	}

	async ensureResources(): Promise<WebGl2ComputeResources> {
		if (this.#resources) {
			return this.#resources;
		}
		const gl = this.ensureGl();
		const program = createCityNed2EcefProgram(gl, cityNed2EcefVertexShaderSource);
		const rawConeAlphaProgram = createRawConeAlphasProgram(gl, rawConeAlphasVertexShaderSource);
		const boundaryProgram = createBoundaryAlgebreProgram(gl, boundaryAlgebreVertexShaderSource);
		const ciseledConesProgram = createCiseledConesProgram(
			gl,
			`${rayIntersectTriangleWebGl2ShaderSource}\n${ciseledConesVertexShaderSource}`,
		);
		this.#resources = {
			buffers: [],
			pipeline: {
				passes: [
					{
						name: 'city-ned2ecef',
						stage: 'static-town-precompute',
						profile: 'webgl2',
						inputs: [],
						outputs: [],
						workgroupSize: [1, 1, 1],
						notes: ['First operational WebGL2 fallback pass: city NED-to-ECEF matrices via transform feedback.'],
					},
					{
						name: 'boundary-algebre',
						stage: 'geojson-boundary-raycast',
						profile: 'webgl2',
						inputs: [],
						outputs: [],
						workgroupSize: [1, 1, 1],
						notes: ['First operational WebGL2 GeoJSON fallback pass: boundary raycast via transform feedback.'],
					},
					{
						name: 'raw-cone-alphas',
						stage: 'raw-cones-precompute',
						profile: 'webgl2',
						inputs: [],
						outputs: [],
						workgroupSize: [1, 1, 1],
						notes: ['First operational WebGL2 raw-cone pass: select cone alphas with transform feedback.'],
					},
					{
						name: 'ciseled-cones',
						stage: 'cone-intersections-precompute',
						profile: 'webgl2',
						inputs: [],
						outputs: [],
						workgroupSize: [1, 1, 1],
						notes: ['First operational WebGL2 cone-cone pass: exhaustive ciseled cones with transform feedback.'],
					},
				],
			},
			programCache: new Map([['city-ned2ecef', program]]),
			framebufferCache: new Map(),
		};
		this.#resources.programCache?.set('boundary-algebre', boundaryProgram);
		this.#resources.programCache?.set('raw-cone-alphas', rawConeAlphaProgram);
		this.#resources.programCache?.set('ciseled-cones', ciseledConesProgram);
		return this.#resources;
	}

	private async runBoundaryRaycastPass(
		result: ComputeWorkflowResult,
		geojsonRun: ComputeWorkflowResult['geojsonRuns'][number],
	): Promise<{ timing: StageTiming; diagnostics: DatasetDiagnostic[] }> {
		const staticTown = result.staticTown;
		if (!staticTown) {
			return {
				timing: {
					stage: 'geojson-boundary-raycast',
					scope: 'precompute',
					profile: 'webgl2',
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
					profile: 'webgl2',
					startedAtMs: 0,
					endedAtMs: 0,
					durationMs: 0,
				},
				diagnostics: [],
			};
		}

		const gl = this.ensureGl();
		const resources = await this.ensureResources();
		const program = resources.programCache?.get('boundary-algebre');
		if (!program) {
			throw new Error('WebGL2 boundary raycast program is not available');
		}

		const dispatchResources = createBoundaryAlgebreDispatchResources(
			gl,
			program,
			{
				cityNed2EcefMatrices: staticTown.cityNed2EcefMatrices,
				cityContourIndexes: boundary.cityContourIndexes,
				countryContourNVectorBuffer: boundary.countryContourNVectorBuffer,
				countryContourOffsets: boundary.countryContourOffsets,
				countryContourSizes: boundary.countryContourSizes,
				azimuthIntervals: packAzimuthIntervals(buildAzimuthIntervals(azimuthSampleCount)),
				cityCount,
				azimuthIntervalCount: azimuthSampleCount,
				contourCount,
				earthRadiusMeters: EARTH_RADIUS_METERS,
			},
		);

		const { timing } = await measureAsyncStage(
			'geojson-boundary-raycast',
			'precompute',
			'webgl2',
			async () => {
				gl.useProgram(program);
				gl.uniform4f(
					dispatchResources.uniformLocation,
					EARTH_RADIUS_METERS,
					cityCount,
					azimuthSampleCount,
					contourCount,
				);
				bindBoundaryTextures(gl, dispatchResources);
				gl.bindVertexArray(dispatchResources.vertexArray);
				gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, dispatchResources.angularOutputBuffer);
				gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, dispatchResources.ecefOutputBuffer);
				const transformFeedback = gl.createTransformFeedback();
				if (!transformFeedback) {
					throw new Error('WebGL2 transform feedback allocation failed');
				}
				gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback);
				gl.enable(gl.RASTERIZER_DISCARD);
				gl.beginTransformFeedback(gl.POINTS);
				gl.drawArraysInstanced(gl.POINTS, 0, 1, cityCount * azimuthSampleCount);
				gl.endTransformFeedback();
				gl.disable(gl.RASTERIZER_DISCARD);
				gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
				gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
				gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, null);
				gl.bindVertexArray(null);
				gl.finish();
				return undefined;
			},
		);

		const diagnostics: DatasetDiagnostic[] = [];
		const angularReadback = readBackFloat32Buffer(
			gl,
			gl.TRANSFORM_FEEDBACK_BUFFER,
			dispatchResources.angularOutputBuffer,
			cityCount * azimuthSampleCount * 4,
		);
		const ecefReadback = readBackFloat32Buffer(
			gl,
			gl.TRANSFORM_FEEDBACK_BUFFER,
			dispatchResources.ecefOutputBuffer,
			cityCount * azimuthSampleCount * 4,
		);
		if (angularReadback && ecefReadback) {
			diagnostics.push(
				...compareFloat32Buffers(
					'webgl2-boundary-angular',
					geojsonRun.boundaryRaycast.townBoundaryAngular,
					angularReadback,
				),
				...compareFloat32Buffers(
					'webgl2-boundary-ecef',
					geojsonRun.boundaryRaycast.townBoundaryEcef,
					ecefReadback,
				),
			);
		}

		return { timing, diagnostics };
	}

	private ensureGl(): WebGL2RenderingContext {
		if (this.#gl) {
			return this.#gl;
		}
		const gl = probeWebGl2Context(this.#canvas);
		if (!gl) {
			throw new Error('WebGL2 compute backend unavailable: no WebGL2 context could be created');
		}
		this.#gl = gl;
		return gl;
	}

	private async runCityMatrixPass(result: ComputeWorkflowResult): Promise<{ timing: StageTiming; diagnostics: DatasetDiagnostic[] }> {
		const prepared = result.preparedDataset;
		const cityCount = prepared.cityCount;
		if (cityCount <= 0) {
			return {
				timing: {
					stage: 'static-town-precompute',
					scope: 'precompute',
					profile: 'webgl2',
					startedAtMs: 0,
					endedAtMs: 0,
					durationMs: 0,
				},
				diagnostics: [],
			};
		}

		const gl = this.ensureGl();
		const resources = await this.ensureResources();
		const program = resources.programCache?.get('city-ned2ecef');
		if (!program) {
			throw new Error('WebGL2 city NED-to-ECEF program is not available');
		}

		const dispatchResources = createCityNed2EcefDispatchResources(
			gl,
			program,
			new Float32Array(prepared.cityLonLatRadians),
			cityCount,
			EARTH_RADIUS_METERS,
		);
		const transformFeedback = gl.createTransformFeedback();
		if (!transformFeedback) {
			throw new Error('WebGL2 transform feedback allocation failed');
		}

		const { timing } = await measureAsyncStage(
			'static-town-precompute',
			'precompute',
			'webgl2',
			async () => {
				gl.useProgram(program);
				gl.uniform1f(dispatchResources.uniformLocation, EARTH_RADIUS_METERS);
				gl.bindVertexArray(dispatchResources.vertexArray);
				gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, dispatchResources.outputBuffer);
				gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback);
				gl.enable(gl.RASTERIZER_DISCARD);
				gl.beginTransformFeedback(gl.POINTS);
				gl.drawArrays(gl.POINTS, 0, cityCount);
				gl.endTransformFeedback();
				gl.disable(gl.RASTERIZER_DISCARD);
				gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
				gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
				gl.bindVertexArray(null);
				gl.finish();
				return undefined;
			},
		);

		const diagnostics: DatasetDiagnostic[] = [];
		const cityMatricesReadback = readBackFloat32Buffer(
			gl,
			gl.TRANSFORM_FEEDBACK_BUFFER,
			dispatchResources.outputBuffer,
			cityCount * 16,
		);
		if (cityMatricesReadback) {
			diagnostics.push(
				...compareFloat32Buffers(
					'webgl2-city-matrices',
					result.staticTown?.cityNed2EcefMatrices ?? new Float32Array(cityCount * 16),
					cityMatricesReadback,
				),
			);
		}

		return { timing, diagnostics };
	}

	private async runRawConeAlphaPass(result: ComputeWorkflowResult): Promise<{ timing: StageTiming; diagnostics: DatasetDiagnostic[] }> {
		const rawCones = result.rawCones;
		const dynamicTown = result.dynamicTown;
		if (!rawCones || !dynamicTown) {
			return {
				timing: {
					stage: 'raw-cones-precompute',
					scope: 'precompute',
					profile: 'webgl2',
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
					profile: 'webgl2',
					startedAtMs: 0,
					endedAtMs: 0,
					durationMs: 0,
				},
				diagnostics: [],
			};
		}

		const gl = this.ensureGl();
		const resources = await this.ensureResources();
		const program = resources.programCache?.get('raw-cone-alphas');
		if (!program) {
			throw new Error('WebGL2 raw-cone alpha program is not available');
		}

		const dispatchResources = createRawConeAlphasDispatchResources(
			gl,
			program,
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
		const transformFeedback = gl.createTransformFeedback();
		if (!transformFeedback) {
			throw new Error('WebGL2 transform feedback allocation failed');
		}

		const { timing } = await measureAsyncStage(
			'raw-cones-precompute',
			'precompute',
			'webgl2',
			async () => {
				gl.useProgram(program);
				gl.uniform4f(
					dispatchResources.uniformLocation,
					dynamicTown.roadAlphaRadians,
					rawCones.attenuationRadians ?? 0,
					shapeToCode(rawCones.shape),
					azimuthSampleCount,
				);
				bindRawConeAlphaTextures(gl, dispatchResources);
				gl.bindVertexArray(dispatchResources.vertexArray);
				gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, dispatchResources.outputBuffer);
				gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback);
				gl.enable(gl.RASTERIZER_DISCARD);
				gl.beginTransformFeedback(gl.POINTS);
				gl.drawArraysInstanced(gl.POINTS, 0, 1, cityCount * azimuthSampleCount);
				gl.endTransformFeedback();
				gl.disable(gl.RASTERIZER_DISCARD);
				gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
				gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
				gl.bindVertexArray(null);
				gl.finish();
				return undefined;
			},
		);

		const diagnostics: DatasetDiagnostic[] = [];
		const alphaReadback = readBackFloat32Buffer(
			gl,
			gl.TRANSFORM_FEEDBACK_BUFFER,
			dispatchResources.outputBuffer,
			cityCount * azimuthSampleCount,
		);
		if (alphaReadback) {
			diagnostics.push(
				...compareFloat32Buffers(
					'webgl2-raw-cone-alpha',
					rawCones.coneAlphaRadians,
					alphaReadback,
				),
			);
		}

		return { timing, diagnostics };
	}

	private async runCiseledConePass(result: ComputeWorkflowResult): Promise<{ timing: StageTiming; diagnostics: DatasetDiagnostic[] }> {
		const staticTown = result.staticTown;
		const rawCones = result.rawCones;
		const coneIntersections = result.coneIntersections;
		if (!staticTown || !rawCones || !coneIntersections) {
			return {
				timing: {
					stage: 'cone-intersections-precompute',
					scope: 'interactive',
					profile: 'webgl2',
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
					profile: 'webgl2',
					startedAtMs: 0,
					endedAtMs: 0,
					durationMs: 0,
				},
				diagnostics: [],
			};
		}

		const gl = this.ensureGl();
		const resources = await this.ensureResources();
		const program = resources.programCache?.get('ciseled-cones');
		if (!program) {
			throw new Error('WebGL2 ciseled cones program is not available');
		}

		const dispatchResources = createCiseledConesDispatchResources(
			gl,
			program,
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
		const transformFeedback = gl.createTransformFeedback();
		if (!transformFeedback) {
			throw new Error('WebGL2 transform feedback allocation failed');
		}

		const { timing } = await measureAsyncStage(
			'cone-intersections-precompute',
			'interactive',
			'webgl2',
			async () => {
				gl.useProgram(program);
				gl.uniform4f(
					dispatchResources.uniformLocation,
					cityCount,
					azimuthSampleCount,
					staticTown.neighborLimit,
					0,
				);
				bindCiseledConesTextures(gl, dispatchResources);
				gl.bindVertexArray(dispatchResources.vertexArray);
				gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, dispatchResources.coneIntersectionDistanceMetersBuffer);
				gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, dispatchResources.ciseledConeRimEcefBuffer);
				gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback);
				gl.enable(gl.RASTERIZER_DISCARD);
				gl.beginTransformFeedback(gl.POINTS);
				gl.drawArraysInstanced(gl.POINTS, 0, 1, cityCount * azimuthSampleCount);
				gl.endTransformFeedback();
				gl.disable(gl.RASTERIZER_DISCARD);
				gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
				gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
				gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, null);
				gl.bindVertexArray(null);
				gl.finish();
				return undefined;
			},
		);

		const diagnostics: DatasetDiagnostic[] = [];
		const distanceReadback = readBackFloat32Buffer(
			gl,
			gl.TRANSFORM_FEEDBACK_BUFFER,
			dispatchResources.coneIntersectionDistanceMetersBuffer,
			cityCount * azimuthSampleCount,
		);
		const rimReadback = readBackFloat32Buffer(
			gl,
			gl.TRANSFORM_FEEDBACK_BUFFER,
			dispatchResources.ciseledConeRimEcefBuffer,
			cityCount * azimuthSampleCount * 4,
		);
		if (distanceReadback && rimReadback) {
			diagnostics.push(
				...compareFloat32Buffers(
					'webgl2-cone-intersection-distance',
					coneIntersections.coneIntersectionDistanceMeters,
					distanceReadback,
				),
				...compareFloat32Buffers(
					'webgl2-ciseled-cone-rim',
					coneIntersections.ciseledConeRimEcef,
					rimReadback,
				),
			);
		}

		return { timing, diagnostics };
	}
}

/** Returns the WebGL2 capability snapshot. */
export function webgl2Capabilities(available = false): ComputeCapabilities {
	return {
		webgpuAvailable: false,
		webgl2Available: available,
		cpuAvailable: true,
		notes: available
			? ['WebGL2 fallback backend with city NED-to-ECEF, raw-cone alpha, ciseled-cone and GeoJSON boundary transform-feedback passes']
			: ['WebGL2 unavailable'],
	};
}

/** Probes whether a WebGL2 context can be created from a canvas-like object. */
export function probeWebGl2Availability(canvas?: WebGl2CanvasLike | null): boolean {
	return probeWebGl2Context(canvas) !== null;
}

/** Creates a canvas-like object suitable for a WebGL2 probe when the runtime supports it. */
export function createWebGl2ProbeCanvas(): WebGl2CanvasLike | null {
	if (typeof OffscreenCanvas !== 'undefined') {
		return new OffscreenCanvas(1, 1);
	}
	if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
		return document.createElement('canvas');
	}
	return null;
}

/** Creates a WebGL2 backend descriptor used by profile selection. */
export function createWebGl2WorkflowBackendDescriptor(
	options: WebGl2WorkflowBackendOptions = {},
): ComputeWorkflowBackendDescriptor {
	return {
		profile: 'webgl2',
		isAvailable: () => probeWebGl2Availability(options.canvas ?? options.createCanvas?.() ?? createWebGl2ProbeCanvas()),
		create: async () => new WebGl2ComputeWorkflowBackend(options),
	};
}

function remapBenchmarkProfile(benchmark: ComputeBenchmarkReport, extraTimings: readonly StageTiming[]): ComputeBenchmarkReport {
	const timings = [...benchmark.timings, ...extraTimings];
	return {
		...benchmark,
		profile: 'webgl2',
		timings: timings.map((timing) => ({
			...timing,
			profile: 'webgl2',
		})),
		totalDurationMs: benchmark.totalDurationMs + extraTimings.reduce((sum, timing) => sum + timing.durationMs, 0),
		notes: [
			...benchmark.notes,
			'WebGL2 backend dispatches city NED-to-ECEF, raw-cone alpha, cone-cone and GeoJSON boundary transform-feedback passes before delegating the remaining compute stages to the CPU reference backend.',
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

function bindBoundaryTextures(
	gl: WebGL2RenderingContext,
	resources: WebGl2BoundaryAlgebreDispatchResources,
): void {
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, resources.cityMatricesTexture);
	const cityMatricesLocation = gl.getUniformLocation(resources.program, 'u_cityMatrices');
	const cityContourIndexesLocation = gl.getUniformLocation(resources.program, 'u_cityContourIndexes');
	const contourNVectorsLocation = gl.getUniformLocation(resources.program, 'u_contourNVectors');
	const contourOffsetsLocation = gl.getUniformLocation(resources.program, 'u_contourOffsets');
	const contourSizesLocation = gl.getUniformLocation(resources.program, 'u_contourSizes');
	const azimuthIntervalsLocation = gl.getUniformLocation(resources.program, 'u_azimuthIntervals');
	if (
		!cityMatricesLocation ||
		!cityContourIndexesLocation ||
		!contourNVectorsLocation ||
		!contourOffsetsLocation ||
		!contourSizesLocation ||
		!azimuthIntervalsLocation
	) {
		throw new Error('WebGL2 boundary raycast uniform lookup failed');
	}
	gl.uniform1i(cityMatricesLocation, 0);

	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, resources.cityContourIndexesTexture);
	gl.uniform1i(cityContourIndexesLocation, 1);

	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, resources.contourNVectorsTexture);
	gl.uniform1i(contourNVectorsLocation, 2);

	gl.activeTexture(gl.TEXTURE3);
	gl.bindTexture(gl.TEXTURE_2D, resources.contourOffsetsTexture);
	gl.uniform1i(contourOffsetsLocation, 3);

	gl.activeTexture(gl.TEXTURE4);
	gl.bindTexture(gl.TEXTURE_2D, resources.contourSizesTexture);
	gl.uniform1i(contourSizesLocation, 4);

	gl.activeTexture(gl.TEXTURE5);
	gl.bindTexture(gl.TEXTURE_2D, resources.azimuthIntervalsTexture);
	gl.uniform1i(azimuthIntervalsLocation, 5);
}

function bindRawConeAlphaTextures(
	gl: WebGL2RenderingContext,
	resources: WebGl2RawConeAlphaDispatchResources,
): void {
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, resources.cityLinkOffsetsTexture);
	const cityLinkOffsetsLocation = gl.getUniformLocation(resources.program, 'u_cityLinkOffsets');
	const cityLinkCountsLocation = gl.getUniformLocation(resources.program, 'u_cityLinkCounts');
	const cityLinkAzimuthLocation = gl.getUniformLocation(resources.program, 'u_cityLinkAzimuthRadians');
	const cityLinkAlphaLocation = gl.getUniformLocation(resources.program, 'u_cityLinkAlphaRadians');
	const cityFastestTerrestrialAlphaLocation = gl.getUniformLocation(
		resources.program,
		'u_cityFastestTerrestrialAlphaRadians',
	);
	if (
		!cityLinkOffsetsLocation ||
		!cityLinkCountsLocation ||
		!cityLinkAzimuthLocation ||
		!cityLinkAlphaLocation ||
		!cityFastestTerrestrialAlphaLocation
	) {
		throw new Error('WebGL2 raw-cone alpha uniform lookup failed');
	}

	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, resources.cityLinkCountsTexture);
	gl.uniform1i(cityLinkCountsLocation, 1);

	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, resources.cityLinkAzimuthTexture);
	gl.uniform1i(cityLinkAzimuthLocation, 2);

	gl.activeTexture(gl.TEXTURE3);
	gl.bindTexture(gl.TEXTURE_2D, resources.cityLinkAlphaTexture);
	gl.uniform1i(cityLinkAlphaLocation, 3);

	gl.activeTexture(gl.TEXTURE4);
	gl.bindTexture(gl.TEXTURE_2D, resources.cityFastestTerrestrialAlphaTexture);
	gl.uniform1i(cityFastestTerrestrialAlphaLocation, 4);

	gl.uniform1i(cityLinkOffsetsLocation, 0);
}

function bindCiseledConesTextures(
	gl: WebGL2RenderingContext,
	resources: WebGl2CiseledConesDispatchResources,
): void {
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, resources.cityMatricesTexture);
	const cityMatricesLocation = gl.getUniformLocation(resources.program, 'u_cityMatrices');
	const overlapCandidatesLocation = gl.getUniformLocation(resources.program, 'u_overlapCandidates');
	const overlapCandidateCountsLocation = gl.getUniformLocation(resources.program, 'u_overlapCandidateCounts');
	const rawConeRimEcefLocation = gl.getUniformLocation(resources.program, 'u_rawConeRimEcef');
	if (
		!cityMatricesLocation ||
		!overlapCandidatesLocation ||
		!overlapCandidateCountsLocation ||
		!rawConeRimEcefLocation
	) {
		throw new Error('WebGL2 ciseled cones uniform lookup failed');
	}
	gl.uniform1i(cityMatricesLocation, 0);

	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, resources.overlapCandidatesTexture);
	gl.uniform1i(overlapCandidatesLocation, 1);

	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, resources.overlapCandidateCountsTexture);
	gl.uniform1i(overlapCandidateCountsLocation, 2);

	gl.activeTexture(gl.TEXTURE3);
	gl.bindTexture(gl.TEXTURE_2D, resources.rawConeRimEcefTexture);
	gl.uniform1i(rawConeRimEcefLocation, 3);
}

function shapeToCode(shape: ConeShape): number {
	if (shape === 'road') {
		return 0;
	}
	if (shape === 'fastest-terrestrial') {
		return 1;
	}
	return 2;
}

function probeWebGl2Context(canvas?: WebGl2CanvasLike | null): WebGL2RenderingContext | null {
	if (!canvas) {
		return null;
	}
	try {
		const context = canvas.getContext('webgl2');
		if (!context) {
			return null;
		}
		if (typeof WebGL2RenderingContext !== 'undefined' && context instanceof WebGL2RenderingContext) {
			return context;
		}
		return typeof (context as WebGL2RenderingContext).createBuffer === 'function'
			? (context as WebGL2RenderingContext)
			: null;
	} catch {
		return null;
	}
}
