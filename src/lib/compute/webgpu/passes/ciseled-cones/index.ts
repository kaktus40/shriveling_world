import sharedMathShaderSource from '../../../kernels/shared/math/webgpu.wgsl?raw';
import rayIntersectTriangleShaderSource from '../../../kernels/shared/ray-intersect-triangle/webgpu.wgsl?raw';
import ciseledConesShaderSource from '../../../kernels/ciseled-cones/webgpu.wgsl?raw';
import type { DatasetDiagnostic } from '../../../../domain/data';
import type { ComputeOptions, ComputeResult, StageTiming } from '../../../core';
import { ALPHA_SUPPORT_EPSILON_RADIANS } from '../../../../domain/precompute/cpu/cone-intersection-constants';
import { measureAsyncStage } from '../../../core/timing';
import {
	compareFloat32Buffers,
	readBackFloat32Buffer,
} from '../../validation';
import type { WebGpuComputeContext, WebGpuComputeResources } from '../../types';
import {
	type GpuBufferAllocation,
} from '../../buffers';
import { createCiseledConesDispatchResources } from './buffers';

export interface WebGpuCiseledConePassInput {
	readonly context: WebGpuComputeContext;
	readonly result: ComputeResult;
	readonly resources: WebGpuComputeResources;
	readonly usage: {
		readonly STORAGE: number;
		readonly COPY_DST: number;
		readonly COPY_SRC: number;
		readonly UNIFORM: number;
		readonly MAP_READ: number;
	};
	readonly coneIntersection?: ComputeOptions['coneIntersection'];
}

export interface WebGpuCiseledConePassResult {
	readonly timing: StageTiming;
	readonly diagnostics: DatasetDiagnostic[];
	readonly ciseledConeRimEcef?: GpuBufferAllocation;
}

export async function runWebGpuCiseledConePass(
	input: WebGpuCiseledConePassInput,
): Promise<WebGpuCiseledConePassResult> {
	const staticTown = input.result.staticTown;
	const rawCones = input.result.rawCones;
	const reference = input.result.coneIntersections;
	const dynamicTown = input.result.dynamicTown;
	if (!staticTown || !rawCones || !reference || !dynamicTown) {
		return {
			timing: {
				stage: 'cone-intersections-precompute',
				scope: 'interactive',
				profile: 'webgpu',
				startedAtMs: 0,
				endedAtMs: 0,
				durationMs: 0,
			},
			diagnostics: [],
		};
	}

	const cityCount = rawCones.cityCount;
	const azimuthSampleCount = rawCones.azimuthSampleCount;
	const alphaAwareOptions = input.coneIntersection?.alphaAware ?? {};
	if (cityCount <= 0 || azimuthSampleCount <= 0) {
		return {
			timing: {
				stage: 'cone-intersections-precompute',
				scope: 'interactive',
				profile: 'webgpu',
				startedAtMs: 0,
				endedAtMs: 0,
				durationMs: 0,
			},
			diagnostics: [],
		};
	}

	const resources = createCiseledConesDispatchResources(
		input.context.device,
		input.usage,
		{
			cityNed2EcefMatrices: staticTown.cityNed2EcefMatrices,
			overlapCandidates: staticTown.overlapCandidates,
			overlapCandidateCounts: staticTown.overlapCandidateCounts,
			rawConeRimEcef: rawCones.rawConeRimEcef,
			cityPairInvariants: staticTown.cityPairInvariants,
			coneAlphaRadians: rawCones.coneAlphaRadians,
			cityCount,
			azimuthSampleCount,
			neighborLimit: staticTown.neighborLimit,
			roadAlphaRadians: dynamicTown.roadAlphaRadians,
			bilateralNeighborhoodFaceCount:
				alphaAwareOptions.bilateralNeighborhoodFaceCount ?? Math.min(Math.max(azimuthSampleCount, 1), 8),
			alphaEpsilonRadians: alphaAwareOptions.alphaEpsilonRadians ?? ALPHA_SUPPORT_EPSILON_RADIANS,
		},
	);
	const pipeline = await input.context.device.createComputePipelineAsync({
		layout: 'auto',
		compute: {
			module:
				input.resources.shaderModuleCache?.get('ciseled-cones') ??
				input.context.device.createShaderModule({
					code: `${sharedMathShaderSource}\n${rayIntersectTriangleShaderSource}\n${ciseledConesShaderSource}`,
				}),
			entryPoint: 'main',
		},
	});
	const bindGroup = input.context.device.createBindGroup({
		layout: pipeline.getBindGroupLayout(0),
		entries: [
			{ binding: 0, resource: { buffer: resources.cityMatrices.buffer } },
			{ binding: 1, resource: { buffer: resources.overlapCandidates.buffer } },
			{ binding: 2, resource: { buffer: resources.overlapCandidateCounts.buffer } },
			{ binding: 3, resource: { buffer: resources.rawConeRimEcef.buffer } },
			{ binding: 4, resource: { buffer: resources.cityPairInvariants.buffer } },
			{ binding: 5, resource: { buffer: resources.coneAlphaRadians.buffer } },
			{ binding: 6, resource: { buffer: resources.uniform.buffer } },
			{ binding: 7, resource: { buffer: resources.heuristics.buffer } },
			{ binding: 8, resource: { buffer: resources.coneIntersectionDistanceMeters.buffer } },
			{ binding: 9, resource: { buffer: resources.ciseledConeRimEcef.buffer } },
		],
	});

	const { timing } = await measureAsyncStage(
		'cone-intersections-precompute',
		'interactive',
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
	const distanceReadback = await readBackFloat32Buffer(
		input.context.device,
		resources.coneIntersectionDistanceMeters.buffer,
		cityCount * azimuthSampleCount,
	);
	const rimReadback = await readBackFloat32Buffer(
		input.context.device,
		resources.ciseledConeRimEcef.buffer,
		cityCount * azimuthSampleCount * 4,
	);
	if (distanceReadback && rimReadback) {
		diagnostics.push(
			...compareFloat32Buffers(
				'webgpu-cone-intersection-distance',
				reference.coneIntersectionDistanceMeters,
				distanceReadback,
			),
			...compareFloat32Buffers(
				'webgpu-ciseled-cone-rim',
				reference.ciseledConeRimEcef,
				rimReadback,
			),
		);
	}

	return { timing, diagnostics, ciseledConeRimEcef: resources.ciseledConeRimEcef };
}
