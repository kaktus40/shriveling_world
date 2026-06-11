import cityNed2EcefVertexShaderSource from '../kernels/city-ned2ecef-webgl2.vert?raw';
import boundaryAlgebreVertexShaderSource from '../kernels/boundary-algebre-webgl2.vert?raw';
import {
	createCpuWorkflowBackend,
	type CpuComputeWorkflowBackend,
} from '../cpu';
import {
	createBoundaryAlgebreDispatchResources,
	createBoundaryAlgebreProgram,
	createCityNed2EcefDispatchResources,
	createCityNed2EcefProgram,
	type WebGl2BoundaryAlgebreDispatchResources,
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
				...compareDiagnostics,
				{
					severity: 'warning',
					code: 'webgl2-city-matrix-pass-dispatched',
					message: 'WebGL2 backend dispatches a real city NED-to-ECEF transform-feedback pass before delegating the remaining compute stages to the CPU reference backend.',
				},
				{
					severity: 'warning',
					code: 'webgl2-boundary-raycast-pass-dispatched',
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
		const boundaryProgram = createBoundaryAlgebreProgram(gl, boundaryAlgebreVertexShaderSource);
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
				],
			},
			programCache: new Map([['city-ned2ecef', program]]),
			framebufferCache: new Map(),
		};
		this.#resources.programCache?.set('boundary-algebre', boundaryProgram);
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
}

/** Returns the WebGL2 capability snapshot. */
export function webgl2Capabilities(available = false): ComputeCapabilities {
	return {
		webgpuAvailable: false,
		webgl2Available: available,
		cpuAvailable: true,
		notes: available
			? ['WebGL2 fallback backend with city NED-to-ECEF and GeoJSON boundary transform-feedback passes']
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
			'WebGL2 backend dispatches a city NED-to-ECEF transform-feedback pass and a GeoJSON boundary transform-feedback pass before delegating the remaining compute stages to the CPU reference backend.',
		],
	};
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
