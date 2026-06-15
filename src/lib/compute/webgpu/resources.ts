import rawConeAlphasShaderSource from '../kernels/raw-cone-alphas/webgpu.wgsl?raw';
import boundaryAlgebreShaderSource from '../kernels/boundary-algebre/webgpu.wgsl?raw';
import cityNed2EcefShaderSource from '../kernels/city-ned2ecef/webgpu.wgsl?raw';
import curveGeometryShaderSource from '../kernels/curve-geometry/webgpu.wgsl?raw';
import finalConesShaderSource from '../kernels/final-cones/webgpu.wgsl?raw';
import projectionShaderSource from '../kernels/shared/projection/webgpu.wgsl?raw';
import sharedMathShaderSource from '../kernels/shared/math/webgpu.wgsl?raw';
import rayIntersectTriangleShaderSource from '../kernels/shared/ray-intersect-triangle/webgpu.wgsl?raw';
import ciseledConesShaderSource from '../kernels/ciseled-cones/webgpu.wgsl?raw';
import type { ComputeGpuBufferContract, ComputeGpuPipelineContract } from '../gpu';
import type { WebGpuComputeResources } from './types';

function buildPassContract(
	name: string,
	stage: ComputeGpuPipelineContract['passes'][number]['stage'],
	notes: readonly string[],
): ComputeGpuPipelineContract['passes'][number] {
	return {
		name,
		stage,
		profile: 'webgpu',
		inputs: [],
		outputs: [],
		workgroupSize: [1, 1, 1],
		notes,
	};
}

/** Cache of created WebGPU resources keyed by GPUDevice to ensure identity and avoid recreation by probes or other callers. */
const __webgpuResourcesCache: WeakMap<GPUDevice, WebGpuComputeResources> = new WeakMap();

/** Creates the cached WebGPU resources for all migration compute passes. Returns cached instance when available. */
export function createWebGpuComputeResources(device: GPUDevice): WebGpuComputeResources {
	const cached = __webgpuResourcesCache.get(device);
	if (cached) {
		return cached;
	}
	const cityMatrixModule = device.createShaderModule({ code: cityNed2EcefShaderSource });
	const rawConeAlphaModule = device.createShaderModule({
		code: `${sharedMathShaderSource}\n${rawConeAlphasShaderSource}`,
	});
	const ciseledConeModule = device.createShaderModule({
		code: `${sharedMathShaderSource}\n${rayIntersectTriangleShaderSource}\n${ciseledConesShaderSource}`,
	});
	const finalConeModule = device.createShaderModule({
		code: `${projectionShaderSource}\n${finalConesShaderSource}`,
	});
	const boundaryModule = device.createShaderModule({
		code: `${sharedMathShaderSource}\n${boundaryAlgebreShaderSource}`,
	});
	const curveGeometryProjectedModule = device.createShaderModule({
		code: `${projectionShaderSource}\n${curveGeometryShaderSource}`,
	});

	const buffers: readonly ComputeGpuBufferContract[] = [];
	const resources: WebGpuComputeResources = {
		buffers,
		pipeline: {
			passes: [
				buildPassContract('city-ned2ecef', 'static-town-precompute', [
					'First real WGSL kernel: build city NED-to-ECEF matrices from lon/lat radians.',
				]),
				buildPassContract('boundary-algebre', 'geojson-boundary-raycast', [
					'First real WGSL GeoJSON kernel: raycast the retained contours against azimuth samples.',
				]),
				buildPassContract('raw-cone-alphas', 'raw-cones-precompute', [
					'First real WGSL raw-cone kernel: select cone alphas per city and azimuth sample.',
				]),
				buildPassContract('ciseled-cones', 'cone-intersections-precompute', [
					'First real WGSL cone-cone kernel: exhaustively ciseled raw cones against retained neighbors and compared them against the CPU oracle.',
				]),
				buildPassContract('final-cones', 'final-cones-precompute', [
					'Final real WGSL geometry-emission kernel: merge boundary clipping and display projection into the final render-ready cone geometry.',
				]),
				buildPassContract('curve-geometry', 'final-curves-precompute', [
					'Final curve geometry WGSL kernel: sample render-ready curve vertices from prepared curve controls, yearly speed ratios and the display projection mix.',
				]),
			],
		},
		shaderModuleCache: new Map([
			['city-ned2ecef', cityMatrixModule],
			['raw-cone-alphas', rawConeAlphaModule],
			['ciseled-cones', ciseledConeModule],
			['final-cones', finalConeModule],
			['boundary-algebre', boundaryModule],
			['curve-geometry', curveGeometryProjectedModule],
		]),
		pipelineCache: new Map(),
		bindGroupCache: new Map(),
	};
	__webgpuResourcesCache.set(device, resources);
	return resources;
}

