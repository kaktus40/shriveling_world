import {
	createCpuWorkflowBackend,
	type CpuComputeWorkflowBackend,
} from '../cpu';
import type {
	ComputeBenchmarkReport,
	ComputeCapabilities,
	ComputeProfileSelection,
	ComputeWorkflowBackend,
	ComputeWorkflowBackendDescriptor,
	ComputeWorkflowInput,
	ComputeWorkflowOptions,
	ComputeWorkflowResult,
} from '../core';

/** Canvas-like source used to probe or create a WebGL2 context. */
export type WebGl2CanvasLike = HTMLCanvasElement | OffscreenCanvas;

/** Options used to build the WebGL2 skeleton backend. */
export interface WebGl2WorkflowBackendOptions {
	/** Optional pre-existing canvas used to create the WebGL2 context. */
	readonly canvas?: WebGl2CanvasLike;
	/** Optional canvas factory used when no canvas is injected. */
	readonly createCanvas?: () => WebGl2CanvasLike | null;
	/** Optional CPU backend used as a temporary orchestration delegate. */
	readonly cpuBackend?: CpuComputeWorkflowBackend;
}

/** Lightweight WebGL2 backend skeleton for the migration. */
export class WebGl2ComputeWorkflowBackend implements ComputeWorkflowBackend {
	readonly profile = 'webgl2' as const;
	readonly #canvas: WebGl2CanvasLike | null;
	readonly #cpuBackend: CpuComputeWorkflowBackend;

	constructor(options: WebGl2WorkflowBackendOptions = {}) {
		this.#canvas = options.canvas ?? options.createCanvas?.() ?? null;
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
				capabilities: webgl2Capabilities(),
			};
		const result = await this.#cpuBackend.run(input, options, delegatedSelection);
		return {
			...result,
			selection: delegatedSelection,
			benchmark: remapBenchmarkProfile(result.benchmark),
			diagnostics: [
				...result.diagnostics,
				{
					severity: 'warning',
					code: 'webgl2-skeleton-cpu-delegation',
					message: 'WebGL2 backend is wired but still delegates compute stages to the CPU reference backend.',
				},
			],
		};
	}

	async dispose(): Promise<void> {
		await this.#cpuBackend.dispose();
	}

	async ensureAvailable(): Promise<boolean> {
		return probeWebGl2Availability(this.#canvas);
	}
}

/** Returns the WebGL2 capability snapshot. */
export function webgl2Capabilities(available = false): ComputeCapabilities {
	return {
		webgpuAvailable: false,
		webgl2Available: available,
		cpuAvailable: true,
		notes: available ? ['WebGL2 skeleton backend'] : ['WebGL2 unavailable'],
	};
}

/** Probes whether a WebGL2 context can be created from a canvas-like object. */
export function probeWebGl2Availability(canvas?: WebGl2CanvasLike | null): boolean {
	if (!canvas) {
		return false;
	}
	try {
		const context = canvas.getContext('webgl2');
		return context !== null;
	} catch {
		return false;
	}
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

function remapBenchmarkProfile(benchmark: ComputeBenchmarkReport): ComputeBenchmarkReport {
	return {
		...benchmark,
		profile: 'webgl2',
		timings: benchmark.timings.map((timing) => ({
			...timing,
			profile: 'webgl2',
		})),
		notes: [...benchmark.notes, 'WebGL2 skeleton currently delegates compute stages to the CPU reference backend.'],
	};
}
