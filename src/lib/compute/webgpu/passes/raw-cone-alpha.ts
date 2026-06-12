import rawConeAlphasShaderSource from '../../kernels/raw-cone-alphas/webgpu.wgsl?raw';
import type { DatasetDiagnostic } from '../../../domain/data';
import type { ComputeWorkflowResult, StageTiming } from '../../core';
import { measureAsyncStage } from '../../core/timing';
import {
	compareFloat32Buffers,
	readBackFloat32Buffer,
} from '../validation';
import type { WebGpuComputeContext, WebGpuComputeResources } from '../types';
import {
	createRawConeAlphaDispatchResources,
	type GpuBufferAllocation,
} from '../buffers';
import type { GpuBufferUsage } from './city-matrix';

export interface WebGpuRawConeAlphaPassInput {
	readonly context: WebGpuComputeContext;
	readonly result: ComputeWorkflowResult;
	readonly resources: WebGpuComputeResources;
	readonly usage: GpuBufferUsage;
}

export interface WebGpuRawConeAlphaPassResult {
	readonly timing: StageTiming;
	readonly diagnostics: DatasetDiagnostic[];
	readonly coneAlphaBuffer?: GpuBufferAllocation;
}

export async function runWebGpuRawConeAlphaPass(
	input: WebGpuRawConeAlphaPassInput,
): Promise<WebGpuRawConeAlphaPassResult> {
	const rawCones = input.result.rawCones;
	const dynamicTown = input.result.dynamicTown;
	if (!rawCones || !dynamicTown) {
		return {
			timing: {
				stage: 'raw-cones-precompute',
				scope: 'precompute',
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
	if (cityCount <= 0 || azimuthSampleCount <= 0) {
		return {
			timing: {
				stage: 'raw-cones-precompute',
				scope: 'precompute',
				profile: 'webgpu',
				startedAtMs: 0,
				endedAtMs: 0,
				durationMs: 0,
			},
			diagnostics: [],
		};
	}

	const resources = createRawConeAlphaDispatchResources(
		input.context.device,
		input.usage,
		{
			cityLinkOffsets: dynamicTown.cityLinkOffsets,
			cityLinkCounts: dynamicTown.cityLinkCounts,
			cityLinkAzimuthRadians: dynamicTown.cityLinkAzimuthRadians,
			cityLinkAlphaRadians: dynamicTown.cityLinkAlphaRadians,
			cityFastestTerrestrialAlphaRadians: dynamicTown.cityFastestTerrestrialAlphaRadians,
			cityCount,
			azimuthSampleCount,
			roadAlphaRadians: dynamicTown.roadAlphaRadians,
			attenuationRadians: rawCones.attenuationRadians ?? 0,
			shape: rawCones.shape,
		},
	);
	const pipeline = await input.context.device.createComputePipelineAsync({
		layout: 'auto',
		compute: {
			module:
				input.resources.shaderModuleCache?.get('raw-cone-alphas') ??
				input.context.device.createShaderModule({ code: rawConeAlphasShaderSource }),
			entryPoint: 'main',
		},
	});
	const bindGroup = input.context.device.createBindGroup({
		layout: pipeline.getBindGroupLayout(0),
		entries: [
			{ binding: 0, resource: { buffer: resources.cityLinkOffsets.buffer } },
			{ binding: 1, resource: { buffer: resources.cityLinkCounts.buffer } },
			{ binding: 2, resource: { buffer: resources.cityLinkAzimuthRadians.buffer } },
			{ binding: 3, resource: { buffer: resources.cityLinkAlphaRadians.buffer } },
			{ binding: 4, resource: { buffer: resources.cityFastestTerrestrialAlphaRadians.buffer } },
			{ binding: 5, resource: { buffer: resources.uniform.buffer } },
			{ binding: 6, resource: { buffer: resources.coneAlphaRadians.buffer } },
		],
	});

	const { timing } = await measureAsyncStage(
		'raw-cones-precompute',
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
	const alphaReadback = await readBackFloat32Buffer(input.context.device, resources.coneAlphaRadians.buffer, cityCount * azimuthSampleCount);
	if (alphaReadback) {
		diagnostics.push(
			...compareFloat32Buffers(
				'webgpu-raw-cone-alpha',
				rawCones.coneAlphaRadians,
				alphaReadback,
			),
		);
	}

	return { timing, diagnostics, coneAlphaBuffer: resources.coneAlphaRadians };
}
