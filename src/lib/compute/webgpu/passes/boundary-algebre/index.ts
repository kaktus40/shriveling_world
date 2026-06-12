import boundaryAlgebreMathSource from '../../../kernels/shared/math/webgpu.wgsl?raw';
import boundaryAlgebreKernelSource from '../../../kernels/boundary-algebre/webgpu.wgsl?raw';
import { EARTH_RADIUS_METERS } from '../../../../shared';
import type { DatasetDiagnostic } from '../../../../domain/data';
import { buildAzimuthIntervals, packAzimuthIntervals } from '../../../../domain/geojson';
import type { ComputeResult, StageTiming } from '../../../core';
import { measureAsyncStage } from '../../../core/timing';
import {
	compareFloat32Buffers,
	readBackFloat32Buffer,
} from '../../validation';
import type { WebGpuComputeContext, WebGpuComputeResources } from '../../types';
import {
	type GpuBufferUsageFlags,
} from '../../buffers';
import { createBoundaryAlgebreDispatchResources } from './buffers';

const boundaryAlgebreShaderSource = `${boundaryAlgebreMathSource}\n${boundaryAlgebreKernelSource}`;

export interface WebGpuBoundaryRaycastPassInput {
	readonly context: WebGpuComputeContext;
	readonly result: ComputeResult;
	readonly geojsonRun: ComputeResult['geojsonRuns'][number];
	readonly resources: WebGpuComputeResources;
}

export interface WebGpuBoundaryRaycastPassResult {
	readonly timing: StageTiming;
	readonly extraTimings?: StageTiming[];
	readonly diagnostics: DatasetDiagnostic[];
}

export async function runWebGpuBoundaryRaycastPass(
	input: WebGpuBoundaryRaycastPassInput,
): Promise<WebGpuBoundaryRaycastPassResult> {
	const staticTown = input.result.staticTown;
	if (!staticTown) {
		return {
			timing: {
				stage: 'geojson-boundary-raycast',
				scope: 'precompute',
				profile: 'webgpu',
				startedAtMs: 0,
				endedAtMs: 0,
				durationMs: 0,
			},
			diagnostics: [],
		};
	}

	const boundary = input.geojsonRun.boundaryPrecompute;
	const cityCount = staticTown.cityCount;
	const azimuthSampleCount = boundary.azimuthSampleCount;
	const contourCount = boundary.countryContourSizes.length;
	if (cityCount <= 0 || azimuthSampleCount <= 0) {
		return {
			timing: {
				stage: 'geojson-boundary-raycast',
				scope: 'precompute',
				profile: 'webgpu',
				startedAtMs: 0,
				endedAtMs: 0,
				durationMs: 0,
			},
			diagnostics: [],
		};
	}

	const buffers = createBoundaryAlgebreDispatchResources(
		input.context.device,
		getGpuBufferUsage(),
		{
			cityNed2EcefMatrices: staticTown.cityNed2EcefMatrices,
			cityContourIndexes: boundary.cityContourIndexes,
			countryContourNVectorBuffer: boundary.countryContourNVectorBuffer,
			countryContourOffsets: boundary.countryContourOffsets,
			countryContourSizes: boundary.countryContourSizes,
			azimuthIntervals: packAzimuthIntervals(buildAzimuthIntervals(azimuthSampleCount)),
			cityCount,
			azimuthIntervalCount: azimuthSampleCount,
			contourCount,
			earthRadiusMeters: EARTH_RADIUS_METERS,
		},
	);

	const resources = input.resources.shaderModuleCache?.get('boundary-algebre');
	const pipeline = await input.context.device.createComputePipelineAsync({
		layout: 'auto',
		compute: {
			module: resources ?? input.context.device.createShaderModule({ code: boundaryAlgebreShaderSource }),
			entryPoint: 'main',
		},
	});
	const bindGroup = input.context.device.createBindGroup({
		layout: pipeline.getBindGroupLayout(0),
		entries: [
			{ binding: 0, resource: { buffer: buffers.cityMatrices.buffer } },
			{ binding: 1, resource: { buffer: buffers.cityContourIndexes.buffer } },
			{ binding: 2, resource: { buffer: buffers.contourNVectors.buffer } },
			{ binding: 3, resource: { buffer: buffers.contourOffsets.buffer } },
			{ binding: 4, resource: { buffer: buffers.contourSizes.buffer } },
			{ binding: 5, resource: { buffer: buffers.azimuthIntervals.buffer } },
			{ binding: 6, resource: { buffer: buffers.uniform.buffer } },
			{ binding: 7, resource: { buffer: buffers.townBoundaryAngular.buffer } },
			{ binding: 8, resource: { buffer: buffers.townBoundaryEcef.buffer } },
		],
	});

	const { timing } = await measureAsyncStage(
		'geojson-boundary-raycast',
		'precompute',
		'webgpu',
		async () => {
			const encoder = input.context.device.createCommandEncoder();
			const pass = encoder.beginComputePass();
			pass.setPipeline(pipeline);
			pass.setBindGroup(0, bindGroup);
			pass.dispatchWorkgroups(azimuthSampleCount, cityCount, 1);
			pass.end();
			input.context.queue.submit([encoder.finish()]);
			return undefined;
		},
	);

	const diagnostics: DatasetDiagnostic[] = [];
	const angularReadback = await readBackFloat32Buffer(
		input.context.device,
		buffers.townBoundaryAngular.buffer,
		cityCount * azimuthSampleCount * 4,
	);
	const ecefReadback = await readBackFloat32Buffer(
		input.context.device,
		buffers.townBoundaryEcef.buffer,
		cityCount * azimuthSampleCount * 4,
	);
	if (angularReadback && ecefReadback) {
		diagnostics.push(
			...compareFloat32Buffers(
				'webgpu-boundary-angular',
				input.geojsonRun.boundaryRaycast.townBoundaryAngular,
				angularReadback,
			),
			...compareFloat32Buffers(
				'webgpu-boundary-ecef',
				input.geojsonRun.boundaryRaycast.townBoundaryEcef,
				ecefReadback,
			),
		);
	}

	return { timing, diagnostics };
}

function getGpuBufferUsage(): GpuBufferUsageFlags {
	const usage = (globalThis as typeof globalThis & {
		GPUBufferUsage?: GpuBufferUsageFlags;
	}).GPUBufferUsage;
	return (
		usage ?? {
			STORAGE: 1 << 7,
			COPY_DST: 1 << 3,
			COPY_SRC: 1 << 1,
			UNIFORM: 1 << 6,
			MAP_READ: 1 << 0,
		}
	);
}
