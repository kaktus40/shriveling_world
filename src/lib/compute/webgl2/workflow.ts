import boundaryAlgebreVertexShaderSource from '../kernels/boundary-algebre/webgl2.vert?raw';
import rayIntersectTriangleWebGl2ShaderSource from '../kernels/shared/ray-intersect-triangle/webgl2.glsl?raw';
import ciseledConesVertexShaderSource from '../kernels/ciseled-cones/webgl2.vert?raw';
import finalConesVertexShaderSource from '../kernels/final-cones/webgl2.vert?raw';
import curveGeometryVertexShaderSource from '../kernels/curve-geometry/webgl2.vert?raw';
import {
	createCpuWorkflowBackend,
	type CpuComputeWorkflowBackend,
} from '../cpu';
import {
	createCiseledConesDispatchResources,
	createCiseledConesProgram,
	createBoundaryAlgebreDispatchResources,
	createBoundaryAlgebreProgram,
	createFinalConesDispatchResources,
	createFinalConesProgram,
	createCurveGeometryDispatchResources,
	createCurveGeometryProgram,
	type WebGl2CiseledConesDispatchResources,
	type WebGl2BoundaryAlgebreDispatchResources,
	type WebGl2CurveGeometryDispatchResources,
	type WebGl2FinalConesDispatchResources,
	type WebGl2RawConeAlphaDispatchResources,
} from './buffers';
import { createWebGl2ComputeResources } from './resources';
import { runWebGl2CityMatrixPass } from './passes/city-matrix';
import { runWebGl2BoundaryRaycastPass } from './passes/boundary-algebre';
import { runWebGl2CiseledConePass } from './passes/ciseled-cones';
import { runWebGl2RawConeAlphaPass } from './passes/raw-cone-alpha';
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
import { prepareCurveGeometryInput, prepareCurvePrecompute } from '../../domain/precompute';
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
	#ciseledConeRimEcefBuffer: WebGLBuffer | null = null;

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
		this.#ciseledConeRimEcefBuffer = null;
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
			if (ciseledConePass.ciseledConeRimEcefBuffer) {
				this.#ciseledConeRimEcefBuffer = ciseledConePass.ciseledConeRimEcefBuffer;
			}
		}

		if (options.curve?.enabled === true && result.staticTown && result.curveGeometry) {
			const curvePass = await this.runCurveGeometryPass(result, options);
			extraTimings.push(curvePass.timing);
			compareDiagnostics.push(...curvePass.diagnostics);
		}

		for (const geojsonRun of result.geojsonRuns) {
			const boundaryPass = await this.runBoundaryRaycastPass(result, geojsonRun);
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
				{
					severity: 'warning',
					code: 'webgl2-final-cones-pass-dispatched',
					profile: this.profile,
					message: 'WebGL2 backend dispatches a real final cone geometry transform-feedback pass before delegating the remaining compute stages to the CPU reference backend.',
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
		this.#resources = createWebGl2ComputeResources(gl);
		return this.#resources;
	}

	private async runBoundaryRaycastPass(
		result: ComputeWorkflowResult,
		geojsonRun: ComputeWorkflowResult['geojsonRuns'][number],
	): Promise<{ timing: StageTiming; extraTimings?: StageTiming[]; diagnostics: DatasetDiagnostic[] }> {
		const boundaryPass = await runWebGl2BoundaryRaycastPass({
			gl: this.ensureGl(),
			result,
			geojsonRun,
			resources: await this.ensureResources(),
		});

		if (this.#ciseledConeRimEcefBuffer && geojsonRun.finalCones) {
			const finalPass = await this.runFinalConePass(
				result,
				geojsonRun,
				this.#ciseledConeRimEcefBuffer,
				boundaryPass.townBoundaryAngularBuffer ?? (() => { throw new Error('WebGL2 boundary angular buffer unavailable'); })(),
				boundaryPass.townBoundaryEcefBuffer ?? (() => { throw new Error('WebGL2 boundary ecef buffer unavailable'); })(),
			);
			return {
				timing: boundaryPass.timing,
				extraTimings: [finalPass.timing],
				diagnostics: [...boundaryPass.diagnostics, ...finalPass.diagnostics],
			};
		}

		return boundaryPass;
	}

	private async runFinalConePass(
		result: ComputeWorkflowResult,
		geojsonRun: ComputeWorkflowResult['geojsonRuns'][number],
		ciseledConeRimEcefBuffer: WebGLBuffer,
		townBoundaryAngularBuffer: WebGLBuffer,
		townBoundaryEcefBuffer: WebGLBuffer,
	): Promise<{ timing: StageTiming; diagnostics: DatasetDiagnostic[] }> {
		const staticTown = result.staticTown;
		if (!staticTown) {
			return {
				timing: {
					stage: 'final-cones-precompute',
					scope: 'precompute',
					profile: 'webgl2',
					startedAtMs: 0,
					endedAtMs: 0,
					durationMs: 0,
				},
				diagnostics: [],
			};
		}

		const finalCones = geojsonRun.finalCones;
		if (!finalCones) {
			return {
				timing: {
					stage: 'final-cones-precompute',
					scope: 'precompute',
					profile: 'webgl2',
					startedAtMs: 0,
					endedAtMs: 0,
					durationMs: 0,
				},
				diagnostics: [],
			};
		}

		const cityCount = staticTown.cityCount;
		const azimuthSampleCount = geojsonRun.boundaryRaycast.azimuthIntervalCount;
		if (cityCount <= 0 || azimuthSampleCount <= 0) {
			return {
				timing: {
					stage: 'final-cones-precompute',
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
		const program = resources.programCache?.get('final-cones');
		if (!program) {
			throw new Error('WebGL2 final cones program is not available');
		}

		const dispatchResources = createFinalConesDispatchResources(gl, program, {
			ciseledConeRimEcef: ciseledConeRimEcefBuffer,
			townBoundaryAngular: townBoundaryAngularBuffer,
			townBoundaryEcef: townBoundaryEcefBuffer,
			cityCount,
			azimuthSampleCount,
			earthRadiusMeters: EARTH_RADIUS_METERS,
		});
		const transformFeedback = gl.createTransformFeedback();
		if (!transformFeedback) {
			throw new Error('WebGL2 transform feedback allocation failed');
		}

		const { timing } = await measureAsyncStage(
			'final-cones-precompute',
			'precompute',
			'webgl2',
			async () => {
				gl.useProgram(program);
				gl.uniform4f(
					dispatchResources.uniformLocation,
					EARTH_RADIUS_METERS,
					cityCount,
					azimuthSampleCount,
					0,
				);
				this.bindFinalConesInputs(gl, dispatchResources);
				gl.bindVertexArray(dispatchResources.vertexArray);
				gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, dispatchResources.finalConeGeometryEcefBuffer);
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
		const finalReadback = readBackFloat32Buffer(
			gl,
			gl.TRANSFORM_FEEDBACK_BUFFER,
			dispatchResources.finalConeGeometryEcefBuffer,
			cityCount * azimuthSampleCount * 4,
		);
		if (finalReadback) {
			diagnostics.push(
				...compareFloat32Buffers(
					'webgl2-final-cone-geometry',
					finalCones.finalConeGeometryEcef,
					finalReadback,
				),
			);
		}
		return { timing, diagnostics };
	}

	private async runCurveGeometryPass(
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
					profile: 'webgl2',
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
					profile: 'webgl2',
					startedAtMs: 0,
					endedAtMs: 0,
					durationMs: 0,
				},
				diagnostics: tagDiagnostics(curvePrecompute.diagnostics, this.profile),
			};
		}

		const gl = this.ensureGl();
		const resources = await this.ensureResources();
		const program = resources.programCache?.get('curve-geometry');
		if (!program) {
			throw new Error('WebGL2 curve geometry program is not available');
		}

		const dispatchResources = createCurveGeometryDispatchResources(gl, program, {
			...curveInput,
			earthRadiusMeters: EARTH_RADIUS_METERS,
		});
		const transformFeedback = gl.createTransformFeedback();
		if (!transformFeedback) {
			throw new Error('WebGL2 transform feedback allocation failed');
		}

		const { timing } = await measureAsyncStage(
			'curve-geometry-precompute',
			'precompute',
			'webgl2',
			async () => {
				gl.useProgram(program);
				gl.uniform4f(
					dispatchResources.uniformLocation,
					EARTH_RADIUS_METERS,
					curveInput.pointsPerCurve,
					curvePositionToCode(curveInput.curvePosition),
					curveInput.coefficient ?? 1,
				);
				bindCurveGeometryTextures(gl, dispatchResources);
				gl.bindVertexArray(dispatchResources.vertexArray);
				gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, dispatchResources.outputBuffer);
				gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback);
				gl.enable(gl.RASTERIZER_DISCARD);
				gl.beginTransformFeedback(gl.POINTS);
				gl.drawArraysInstanced(gl.POINTS, 0, curveInput.pointsPerCurve + 1, curveInput.curveCount);
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
		const readback = readBackFloat32Buffer(
			gl,
			gl.TRANSFORM_FEEDBACK_BUFFER,
			dispatchResources.outputBuffer,
			curveInput.curveCount * (curveInput.pointsPerCurve + 1) * 4,
		);
		if (readback) {
			diagnostics.push(
				...compareFloat32Buffers(
					'webgl2-curve-geometry',
					curveGeometry.positions,
					readback,
				),
			);
		}

		diagnostics.push(...tagDiagnostics(curvePrecompute.diagnostics, this.profile));
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

	private bindFinalConesInputs(
		gl: WebGL2RenderingContext,
		resources: WebGl2FinalConesDispatchResources,
	): void {
		gl.bindVertexArray(resources.vertexArray);

		gl.bindBuffer(gl.ARRAY_BUFFER, resources.ciseledConeRimEcefBuffer);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
		gl.vertexAttribDivisor?.(0, 1);

		gl.bindBuffer(gl.ARRAY_BUFFER, resources.townBoundaryAngularBuffer);
		gl.enableVertexAttribArray(1);
		gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
		gl.vertexAttribDivisor?.(1, 1);

		gl.bindBuffer(gl.ARRAY_BUFFER, resources.townBoundaryEcefBuffer);
		gl.enableVertexAttribArray(2);
		gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);
		gl.vertexAttribDivisor?.(2, 1);

		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		gl.bindVertexArray(null);
	}

	private async runCityMatrixPass(result: ComputeWorkflowResult): Promise<{ timing: StageTiming; diagnostics: DatasetDiagnostic[] }> {
		return runWebGl2CityMatrixPass({
			gl: this.ensureGl(),
			result,
			resources: await this.ensureResources(),
		});
	}

	private async runRawConeAlphaPass(result: ComputeWorkflowResult): Promise<{ timing: StageTiming; diagnostics: DatasetDiagnostic[] }> {
		return runWebGl2RawConeAlphaPass({
			gl: this.ensureGl(),
			result,
			resources: await this.ensureResources(),
		});
	}

	private async runCiseledConePass(result: ComputeWorkflowResult): Promise<{ timing: StageTiming; diagnostics: DatasetDiagnostic[]; ciseledConeRimEcefBuffer?: WebGLBuffer }> {
		return runWebGl2CiseledConePass({
			gl: this.ensureGl(),
			result,
			resources: await this.ensureResources(),
		});
	}
}

/** Returns the WebGL2 capability snapshot. */
export function webgl2Capabilities(available = false): ComputeCapabilities {
	return {
		webgpuAvailable: false,
		webgl2Available: available,
		cpuAvailable: true,
		notes: available
			? ['WebGL2 fallback backend with city NED-to-ECEF, raw-cone alpha, ciseled-cone, GeoJSON boundary and final geometry transform-feedback passes']
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
			'WebGL2 backend dispatches city NED-to-ECEF, raw-cone alpha, cone-cone, GeoJSON boundary and final geometry transform-feedback passes before delegating the remaining compute stages to the CPU reference backend.',
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

function bindCurveGeometryTextures(
	gl: WebGL2RenderingContext,
	resources: WebGl2CurveGeometryDispatchResources,
): void {
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, resources.curveControlPointsEcefTexture);
	const controlPointsLocation = gl.getUniformLocation(resources.program, 'u_curveControlPointsEcef');
	const thetaLocation = gl.getUniformLocation(resources.program, 'u_curveThetaRadians');
	const speedRatioLocation = gl.getUniformLocation(resources.program, 'u_curveSpeedRatio');
	const idsLocation = gl.getUniformLocation(resources.program, 'u_curveIds');
	if (!controlPointsLocation || !thetaLocation || !speedRatioLocation || !idsLocation) {
		throw new Error('WebGL2 curve geometry uniform lookup failed');
	}
	gl.uniform1i(controlPointsLocation, 0);

	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, resources.curveThetaRadiansTexture);
	gl.uniform1i(thetaLocation, 1);

	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, resources.curveSpeedRatioTexture);
	gl.uniform1i(speedRatioLocation, 2);

	gl.activeTexture(gl.TEXTURE3);
	gl.bindTexture(gl.TEXTURE_2D, resources.curveIdsTexture);
	gl.uniform1i(idsLocation, 3);
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

function curvePositionToCode(position: 'above' | 'below' | 'below-when-possible' | 'stick-to-cone'): number {
	switch (position) {
		case 'above':
			return 0;
		case 'below':
			return 1;
		case 'below-when-possible':
			return 2;
		case 'stick-to-cone':
			return 3;
	}
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
