import {
	createCpuWorkflowBackend,
	type CpuComputeWorkflowBackend,
} from '../cpu';
import { remapBenchmarkProfile, tagDiagnostics } from '../shared/workflow';
import { createWebGl2ComputeResources } from './resources';
import { runWebGl2CityMatrixPass } from './passes/city-ned2ecef';
import { runWebGl2BoundaryRaycastPass } from './passes/boundary-algebre';
import { runWebGl2CiseledConePass } from './passes/ciseled-cones';
import { runWebGl2CurveGeometryPass } from './passes/curve-geometry';
import { runWebGl2FinalConePass } from './passes/final-cones';
import { runWebGl2RawConeAlphaPass } from './passes/raw-cone-alphas';
import type {
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
			const curvePass = await runWebGl2CurveGeometryPass({
				gl: this.ensureGl(),
				result,
				options,
				resources: await this.ensureResources(),
			});
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
			benchmark: remapBenchmarkProfile(
				result.benchmark,
				this.profile,
				extraTimings,
				[
					'WebGL2 backend dispatches city NED-to-ECEF, raw-cone alpha, cone-cone, GeoJSON boundary and final geometry transform-feedback passes before delegating the remaining compute stages to the CPU reference backend.',
				],
			),
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
			const finalPass = await runWebGl2FinalConePass({
				gl: this.ensureGl(),
				result,
				geojsonRun,
				ciseledConeRimEcefBuffer: this.#ciseledConeRimEcefBuffer,
				townBoundaryAngularBuffer: boundaryPass.townBoundaryAngularBuffer ?? (() => { throw new Error('WebGL2 boundary angular buffer unavailable'); })(),
				townBoundaryEcefBuffer: boundaryPass.townBoundaryEcefBuffer ?? (() => { throw new Error('WebGL2 boundary ecef buffer unavailable'); })(),
				resources: await this.ensureResources(),
			});
			return {
				timing: boundaryPass.timing,
				extraTimings: [finalPass.timing],
				diagnostics: [...boundaryPass.diagnostics, ...finalPass.diagnostics],
			};
		}

		return boundaryPass;
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
