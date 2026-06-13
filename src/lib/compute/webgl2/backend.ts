import {
	createCpuComputeBackend,
	type CpuComputeBackend,
} from '../cpu';
import { remapBenchmarkProfile, tagDiagnostics } from '../shared/compute';
import { createWebGl2ComputeResources } from './resources';
import { runWebGl2CurveGeometryPass } from './passes/curve-geometry';
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
import type { WebGl2ComputeResources } from './types';
import { runWebGl2BoundaryStages } from './boundary';
import { runWebGl2ConeStages } from './cone';

/** Canvas-like source used to probe or create a WebGL2 context. */
export type WebGl2CanvasLike = HTMLCanvasElement | OffscreenCanvas;

/** Options used to build the WebGL2 fallback backend. */
export interface WebGl2ComputeBackendOptions {
	/** Optional pre-existing canvas used to create the WebGL2 context. */
	readonly canvas?: WebGl2CanvasLike;
	/** Optional canvas factory used when no canvas is injected. */
	readonly createCanvas?: () => WebGl2CanvasLike | null;
	/** Optional CPU backend used as a temporary orchestration delegate. */
	readonly cpuBackend?: CpuComputeBackend;
}

/** Operational WebGL2 fallback backend for the migration. */
export class WebGl2ComputeBackend implements ComputeBackend {
	readonly profile = 'webgl2' as const;
	readonly #canvas: WebGl2CanvasLike | null;
	readonly #cpuBackend: CpuComputeBackend;
	#gl: WebGL2RenderingContext | null;
	#resources: WebGl2ComputeResources | null = null;
	#ciseledConeRimEcefBuffer: WebGLBuffer | null = null;

	constructor(options: WebGl2ComputeBackendOptions = {}) {
		this.#canvas = options.canvas ?? options.createCanvas?.() ?? null;
		this.#gl = probeWebGl2Context(this.#canvas);
		this.#cpuBackend = options.cpuBackend ?? createCpuComputeBackend();
	}

	async computeFrame(
		input: ComputeInput,
		options: ComputeOptions = {},
		selection?: ComputeProfileSelection,
	): Promise<ComputeResult> {
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
		const result = await this.#cpuBackend.computeFrame(input, options, delegatedSelection);
		const coneStages = await runWebGl2ConeStages(this.ensureGl(), result, await this.ensureResources(), options);
		const extraTimings: StageTiming[] = [...coneStages.extraTimings];
		const compareDiagnostics: DatasetDiagnostic[] = [...coneStages.diagnostics];
		this.#ciseledConeRimEcefBuffer = coneStages.ciseledConeRimEcefBuffer;

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
			const boundaryPass = await runWebGl2BoundaryStages(
				this.ensureGl(),
				result,
				geojsonRun,
				await this.ensureResources(),
				this.#ciseledConeRimEcefBuffer,
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
export function createWebGl2ComputeBackendDescriptor(
	options: WebGl2ComputeBackendOptions = {},
): ComputeBackendDescriptor {
	return {
		profile: 'webgl2',
		isAvailable: () => probeWebGl2Availability(options.canvas ?? options.createCanvas?.() ?? createWebGl2ProbeCanvas()),
		create: async () => new WebGl2ComputeBackend(options),
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
