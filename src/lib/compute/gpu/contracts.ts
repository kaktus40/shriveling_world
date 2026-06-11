import type { ComputeProfile } from '../core';
import type { ComputeStage } from '../core';

/** GPU-side scalar unit contract used by compute buffers. */
export type ComputeGpuUnit = 'unitless' | 'radians' | 'meters' | 'seconds';

/** GPU-side coordinate order contract used by structured buffers. */
export type ComputeGpuCoordinateOrder = 'longitude-latitude' | 'x-y-z' | 'ned' | 'ecef';

/** GPU-side buffer scalar encoding. */
export type ComputeGpuElementType = 'float32' | 'uint32' | 'int32' | 'uint8';

/**
 * Shared contract for a GPU-facing buffer.
 *
 * The contract makes the buffer semantics explicit so that WebGL2 and WebGPU
 * keep the same logical data layout even if the transport differs.
 */
export interface ComputeGpuBufferContract {
	/** Stable buffer name shared by CPU, WebGL2, WebGPU and diagnostics. */
	readonly name: string;
	/** Buffer scalar encoding. */
	readonly elementType: ComputeGpuElementType;
	/** Number of bytes between two logical elements or records. */
	readonly strideBytes: number;
	/** Number of logical elements or records. */
	readonly count: number;
	/** Optional angular unit contract for scalar or vector angular buffers. */
	readonly angularUnit?: ComputeGpuUnit;
	/** Optional linear unit contract for scalar or vector linear buffers. */
	readonly linearUnit?: ComputeGpuUnit;
	/** Optional coordinate order contract for vector buffers. */
	readonly coordinateOrder?: ComputeGpuCoordinateOrder;
	/** Optional free-form notes for diagnostics and future conformance tests. */
	readonly notes?: readonly string[];
}

/** Shared contract for one GPU compute pass. */
export interface ComputeGpuPassContract {
	/** Stable pass name shared by roadmap, benchmark and diagnostics. */
	readonly name: string;
	/** Logical stage exposed by the migration benchmark. */
	readonly stage: ComputeStage;
	/** Compute profile that owns the pass implementation. */
	readonly profile: Exclude<ComputeProfile, 'cpu'>;
	/** Ordered input buffers consumed by the pass. */
	readonly inputs: readonly ComputeGpuBufferContract[];
	/** Ordered output buffers produced by the pass. */
	readonly outputs: readonly ComputeGpuBufferContract[];
	/** Optional dispatch size or vertex grouping contract. */
	readonly workgroupSize?: readonly [number, number, number];
	/** Optional notes for conformance and benchmark documentation. */
	readonly notes?: readonly string[];
}

/** Shared contract for one GPU backend pipeline. */
export interface ComputeGpuPipelineContract {
	/** Passes executed by the backend, in dispatch order. */
	readonly passes: readonly ComputeGpuPassContract[];
}

/** Shared contract for buffers and passes prepared by a GPU backend. */
export interface ComputeGpuBackendResources {
	readonly buffers: readonly ComputeGpuBufferContract[];
	readonly pipeline: ComputeGpuPipelineContract;
}

