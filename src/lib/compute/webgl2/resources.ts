import cityNed2EcefVertexShaderSource from '../kernels/city-ned2ecef/webgl2.vert?raw';
import boundaryAlgebreVertexShaderSource from '../kernels/boundary-algebre/webgl2.vert?raw';
import projectionWebGl2ShaderSource from '../kernels/shared/projection/webgl2.glsl?raw';
import sharedMathWebGl2ShaderSource from '../kernels/shared/math/webgl2.glsl?raw';
import rayIntersectTriangleWebGl2ShaderSource from '../kernels/shared/ray-intersect-triangle/webgl2.glsl?raw';
import ciseledConesVertexShaderSource from '../kernels/ciseled-cones/webgl2.vert?raw';
import finalConesVertexShaderSource from '../kernels/final-cones/webgl2.vert?raw';
import curveGeometryVertexShaderSource from '../kernels/curve-geometry/webgl2.vert?raw';
import {
	createBoundaryAlgebreProgram,
	createCityNed2EcefProgram,
	createCurveGeometryProgram,
	createCiseledConesProgram,
	createFinalConesProgram,
	createRawConeAlphasProgram,
} from './buffers';
import { composeWebGl2VertexShaderSource } from './programs';
import type { WebGl2ComputeResources } from './types';
import { createRawConeAlphasVertexShaderSource } from './passes/raw-cone-alphas/source';

/** Track GL contexts that have had resources created so repeated creations indicate a potential recreation bug. */
const __webgl2InitializedContexts: WeakSet<WebGL2RenderingContext> = new WeakSet();

/** Creates the cached WebGL2 resources for all migration compute passes. */
export function createWebGl2ComputeResources(gl: WebGL2RenderingContext): WebGl2ComputeResources {
	if (__webgl2InitializedContexts.has(gl)) {
		console.warn('WebGL2 resources recreated for context — possible program/pipeline recreation after warm(). This may indicate a persistence bug.');
		if (typeof console.trace === 'function') console.trace();
	} else {
		__webgl2InitializedContexts.add(gl);
	}
	const cityProgram = createCityNed2EcefProgram(gl, cityNed2EcefVertexShaderSource);
	const rawConeAlphaProgram = createRawConeAlphasProgram(gl, createRawConeAlphasVertexShaderSource());
	const boundaryProgram = createBoundaryAlgebreProgram(
		gl,
		composeWebGl2VertexShaderSource(sharedMathWebGl2ShaderSource, boundaryAlgebreVertexShaderSource),
	);
	const ciseledConesProgram = createCiseledConesProgram(
		gl,
		composeWebGl2VertexShaderSource(sharedMathWebGl2ShaderSource, rayIntersectTriangleWebGl2ShaderSource, ciseledConesVertexShaderSource),
	);
	const finalConesProgram = createFinalConesProgram(
		gl,
		composeWebGl2VertexShaderSource(projectionWebGl2ShaderSource, finalConesVertexShaderSource),
	);
	const curveGeometryProgram = createCurveGeometryProgram(
		gl,
		composeWebGl2VertexShaderSource(projectionWebGl2ShaderSource, curveGeometryVertexShaderSource),
	);

	// Log compiled program keys to help confirm shader compilation at runtime.
	try {
		const programNames = ['city-ned2ecef','boundary-algebre','raw-cone-alphas','ciseled-cones','final-cones','curve-geometry'];
		console.debug(`WebGL2: compiled programs: ${programNames.join(', ')}`);
	} catch {}

	return {
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
				{
					name: 'final-cones',
					stage: 'final-cones-precompute',
					profile: 'webgl2',
					inputs: [],
					outputs: [],
					workgroupSize: [1, 1, 1],
					notes: ['Final operational WebGL2 geometry-emission pass: merge boundary clipping and display projection into the final render-ready cone geometry.'],
				},
				{
					name: 'curve-geometry',
					stage: 'final-curves-precompute',
					profile: 'webgl2',
					inputs: [],
					outputs: [],
					workgroupSize: [1, 1, 1],
					notes: ['Final curve geometry WebGL2 pass: sample render-ready curve vertices from prepared curve controls, yearly speed ratios and the display projection mix.'],
				},
			],
		},
		programCache: new Map([
			['city-ned2ecef', cityProgram],
			['boundary-algebre', boundaryProgram],
			['raw-cone-alphas', rawConeAlphaProgram],
			['ciseled-cones', ciseledConesProgram],
			['final-cones', finalConesProgram],
			['curve-geometry', curveGeometryProgram],
		]),
		framebufferCache: new Map(),
	};
}
