import curveGeometryShaderSource from '../../../kernels/curve-geometry/webgpu.wgsl?raw';
import { EARTH_RADIUS_METERS } from '../../../../shared';
import type { DatasetDiagnostic } from '../../../../domain/data';
import { prepareCurveGeometryInput, prepareCurvePrecompute } from '../../../../domain/precompute';
import type { ComputeWorkflowOptions, ComputeWorkflowResult, StageTiming } from '../../../core';
import { measureAsyncStage } from '../../../core/timing';
import {
	compareFloat32Buffers,
	readBackFloat32Buffer,
} from '../../validation';
import type { WebGpuComputeContext, WebGpuComputeResources } from '../../types';
import {
	type GpuBufferAllocation,
	type GpuBufferUsageFlags,
} from '../../buffers';
import { createCurveGeometryDispatchResources } from './buffers';

export interface WebGpuCurveGeometryPassInput {
	readonly context: WebGpuComputeContext;
	readonly result: ComputeWorkflowResult;
	readonly options: ComputeWorkflowOptions;
	readonly resources: WebGpuComputeResources;
	readonly usage: GpuBufferUsageFlags;
}

export interface WebGpuCurveGeometryPassResult {
	readonly timing: StageTiming;
	readonly diagnostics: DatasetDiagnostic[];
	readonly curveVertexPositions?: GpuBufferAllocation;
}

export async function runWebGpuCurveGeometryPass(
	input: WebGpuCurveGeometryPassInput,
): Promise<WebGpuCurveGeometryPassResult> {
	const staticTown = input.result.staticTown;
	const curveGeometry = input.result.curveGeometry;
	if (!staticTown || !curveGeometry) {
		return {
			timing: {
				stage: 'curve-geometry-precompute',
				scope: 'precompute',
				profile: 'webgpu',
				startedAtMs: 0,
				endedAtMs: 0,
				durationMs: 0,
			},
			diagnostics: [],
		};
	}

	const curvePrecompute = prepareCurvePrecompute(input.result.preparedDataset, staticTown);
	const curveInput = prepareCurveGeometryInput(curvePrecompute, {
		year: input.options.curve?.year ?? input.result.dynamicTown?.year ?? input.result.preparedDataset.speedTimeline.span.beginYear,
		pointsPerCurve: input.options.curve?.pointsPerCurve ?? curveGeometry.pointsPerCurve,
		curvePosition: input.options.curve?.curvePosition ?? 'above',
		coefficient: input.options.curve?.coefficient ?? 1,
	});

	if (curveInput.curveCount <= 0) {
		return {
			timing: {
				stage: 'curve-geometry-precompute',
				scope: 'precompute',
				profile: 'webgpu',
				startedAtMs: 0,
				endedAtMs: 0,
				durationMs: 0,
			},
			diagnostics: tagDiagnostics(curvePrecompute.diagnostics, 'webgpu'),
		};
	}

	const dispatchResources = createCurveGeometryDispatchResources(input.context.device, input.usage, {
		...curveInput,
		earthRadiusMeters: EARTH_RADIUS_METERS,
	});
	const pipeline = await input.context.device.createComputePipelineAsync({
		layout: 'auto',
		compute: {
			module:
				input.resources.shaderModuleCache?.get('curve-geometry') ??
				input.context.device.createShaderModule({ code: curveGeometryShaderSource }),
			entryPoint: 'main',
		},
	});
	const bindGroup = input.context.device.createBindGroup({
		layout: pipeline.getBindGroupLayout(0),
		entries: [
			{ binding: 0, resource: { buffer: dispatchResources.curveControlPointsEcef.buffer } },
			{ binding: 1, resource: { buffer: dispatchResources.curveThetaRadians.buffer } },
			{ binding: 2, resource: { buffer: dispatchResources.curveSpeedRatio.buffer } },
			{ binding: 3, resource: { buffer: dispatchResources.curveIds.buffer } },
			{ binding: 4, resource: { buffer: dispatchResources.uniform.buffer } },
			{ binding: 5, resource: { buffer: dispatchResources.curveVertexPositions.buffer } },
		],
	});

	const { timing } = await measureAsyncStage(
		'curve-geometry-precompute',
		'precompute',
		'webgpu',
		async () => {
			const encoder = input.context.device.createCommandEncoder();
			const pass = encoder.beginComputePass();
			pass.setPipeline(pipeline);
			pass.setBindGroup(0, bindGroup);
			pass.dispatchWorkgroups(curveInput.pointsPerCurve + 1, curveInput.curveCount, 1);
			pass.end();
			input.context.queue.submit([encoder.finish()]);
			return undefined;
		},
	);

	const diagnostics: DatasetDiagnostic[] = [];
	const readback = await readBackFloat32Buffer(
		input.context.device,
		dispatchResources.curveVertexPositions.buffer,
		curveInput.curveCount * (curveInput.pointsPerCurve + 1) * 4,
	);
	if (readback) {
		diagnostics.push(
			...compareFloat32Buffers(
				'webgpu-curve-geometry',
				curveGeometry.positions,
				readback,
			),
		);
	}

	diagnostics.push(...tagDiagnostics(curvePrecompute.diagnostics, 'webgpu'));
	return { timing, diagnostics, curveVertexPositions: dispatchResources.curveVertexPositions };
}

function tagDiagnostics<T extends { severity: 'warning' | 'error'; code: string; profile?: string }>(
	diagnostics: readonly T[],
	profile: string,
): T[] {
	return diagnostics.map((diagnostic) =>
		diagnostic.profile === profile ? diagnostic : { ...diagnostic, profile },
	);
}
