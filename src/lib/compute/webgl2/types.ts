import type { ComputeProfileSelection } from '../core';
import type { ComputeGpuBackendResources, ComputeGpuPipelineContract } from '../gpu';

/** WebGL2 context contract for the migration compute backend. */
export interface WebGl2ComputeContext {
	readonly gl: WebGL2RenderingContext;
	readonly selection: ComputeProfileSelection;
}

/** WebGL2 pipeline resources prepared once per dataset or profile change. */
export interface WebGl2ComputeResources extends ComputeGpuBackendResources {
	readonly pipeline: ComputeGpuPipelineContract;
	/** Optional cache of compiled shader programs keyed by pass name. */
	readonly programCache?: Map<string, WebGLProgram>;
	/** Optional cache of framebuffers or textures keyed by buffer name. */
	readonly framebufferCache?: Map<string, WebGLFramebuffer | WebGLTexture>;
}

/** WebGL2 dispatch contract for one compute pass. */
export interface WebGl2DispatchContract {
	readonly passName: string;
	readonly vertexShaderSource?: string;
	readonly fragmentShaderSource?: string;
	readonly uniforms?: Readonly<Record<string, number | boolean | readonly number[]>>;
}

