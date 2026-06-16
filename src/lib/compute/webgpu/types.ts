import type { ComputeProfileSelection } from '../core';
import type { ComputeGpuBackendResources, ComputeGpuPipelineContract } from '../gpu';

/** WebGPU context contract for the migration compute backend. */
export interface WebGpuComputeContext {
	readonly device: GPUDevice;
	readonly queue: GPUQueue;
	readonly selection: ComputeProfileSelection;
}

/** WebGPU pipeline resources prepared once per dataset or profile change. */
export interface WebGpuComputeResources extends ComputeGpuBackendResources {
	readonly pipeline: ComputeGpuPipelineContract;
	/** Optional cache of shader modules keyed by pass name. */
	readonly shaderModuleCache?: Map<string, GPUShaderModule>;
	/** Optional cache of compute pipelines keyed by pass name. */
	readonly pipelineCache?: Map<string, GPUComputePipeline>;
	/** Optional cache of bind groups keyed by pass name. */
	readonly bindGroupCache?: Map<string, GPUBindGroup>;
	readonly staticInvariants?: Map<string, GPUBuffer>;
}

/** WebGPU dispatch contract for one compute pass. */
export interface WebGpuDispatchContract {
	readonly passName: string;
	readonly entryPoint?: string;
	readonly workgroupSize?: readonly [number, number, number];
	readonly dispatchSize?: readonly [number, number, number];
}

