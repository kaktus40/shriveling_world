import cityNed2EcefShaderSource from '../../kernels/city-ned2ecef/webgpu.wgsl?raw';
import { EARTH_RADIUS_METERS } from '../../../shared';
import type { DatasetDiagnostic } from '../../../domain/data';
import type { ComputeWorkflowResult, StageTiming } from '../../core';
import { measureAsyncStage } from '../../core/timing';
import {
	compareFloat32Buffers,
	readBackFloat32Buffer,
} from '../validation';
import type { WebGpuComputeContext, WebGpuComputeResources } from '../types';
import {
	type GpuBufferAllocation,
} from '../buffers';
import { createCityNed2EcefDispatchResources } from './city-matrix-buffers';

export interface GpuBufferUsage {
	readonly STORAGE: number;
	readonly COPY_DST: number;
	readonly COPY_SRC: number;
	readonly UNIFORM: number;
	readonly MAP_READ: number;
}

export interface WebGpuCityMatrixPassInput {
	readonly context: WebGpuComputeContext;
	readonly result: ComputeWorkflowResult;
	readonly resources: WebGpuComputeResources;
	readonly usage: GpuBufferUsage;
}

export interface WebGpuCityMatrixPassResult {
	readonly timing: StageTiming;
	readonly diagnostics: DatasetDiagnostic[];
	readonly cityMatricesBuffer?: GpuBufferAllocation;
}

export async function runWebGpuCityMatrixPass(
	input: WebGpuCityMatrixPassInput,
): Promise<WebGpuCityMatrixPassResult> {
	const prepared = input.result.preparedDataset;
	const cityCount = prepared.cityCount;
	if (cityCount <= 0) {
		return {
			timing: {
				stage: 'static-town-precompute',
				scope: 'precompute',
				profile: 'webgpu',
				startedAtMs: 0,
				endedAtMs: 0,
				durationMs: 0,
			},
			diagnostics: [],
		};
	}

	const lonLat = new Float32Array(prepared.cityLonLatRadians);
	const buffers = createCityNed2EcefDispatchResources(
		input.context.device,
		input.usage,
		{
			cityLonLatRadians: lonLat,
			cityCount,
			earthRadiusMeters: EARTH_RADIUS_METERS,
		},
	);
	const pipeline = await input.context.device.createComputePipelineAsync({
		layout: 'auto',
		compute: {
			module:
				input.resources.shaderModuleCache?.get('city-ned2ecef') ??
				input.context.device.createShaderModule({ code: cityNed2EcefShaderSource }),
			entryPoint: 'main',
		},
	});
	const bindGroup = input.context.device.createBindGroup({
		layout: pipeline.getBindGroupLayout(0),
		entries: [
			{ binding: 0, resource: { buffer: buffers.input.buffer } },
			{ binding: 1, resource: { buffer: buffers.output.buffer } },
			{ binding: 2, resource: { buffer: buffers.uniform.buffer } },
		],
	});

	const { timing } = await measureAsyncStage(
		'static-town-precompute',
		'precompute',
		'webgpu',
		async () => {
			const encoder = input.context.device.createCommandEncoder();
			const pass = encoder.beginComputePass();
			pass.setPipeline(pipeline);
			pass.setBindGroup(0, bindGroup);
			pass.dispatchWorkgroups(cityCount, 1, 1);
			pass.end();
			input.context.queue.submit([encoder.finish()]);
			return undefined;
		},
	);

	const diagnostics: DatasetDiagnostic[] = [];
	const cityMatricesReadback = await readBackFloat32Buffer(input.context.device, buffers.output.buffer, cityCount * 16);
	if (cityMatricesReadback) {
		diagnostics.push(
			...compareFloat32Buffers(
				'webgpu-city-matrices',
				input.result.staticTown?.cityNed2EcefMatrices ?? new Float32Array(cityCount * 16),
				cityMatricesReadback,
			),
		);
	}

	return { timing, diagnostics, cityMatricesBuffer: buffers.output };
}
