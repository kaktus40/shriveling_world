import rawConeAlphasMathSource from '../../../kernels/shared/math/webgl2.glsl?raw';
import rawConeAlphasKernelSource from '../../../kernels/raw-cone-alphas/webgl2.vert?raw';
import { composeWebGl2VertexShaderSource } from '../../programs';

/** Builds the canonical WebGL2 vertex shader source for the raw-cone alpha pass. */
export function createRawConeAlphasVertexShaderSource(): string {
	return composeWebGl2VertexShaderSource(rawConeAlphasMathSource, rawConeAlphasKernelSource);
}
