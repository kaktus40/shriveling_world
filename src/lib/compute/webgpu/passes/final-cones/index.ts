import finalConesShaderSource from '../../../kernels/final-cones/webgpu.wgsl?raw';
import type { DatasetDiagnostic } from '../../../../domain/data';
import type { ComputeResult, StageTiming } from '../../../core';
import { measureAsyncStage } from '../../../core/timing';
import type { WebGpuComputeContext, WebGpuComputeResources } from '../../types';
import { type GpuBufferAllocation } from '../../buffers';
import { getGpuBufferUsage } from '../../../shared/compute';

export interface WebGpuFinalConesPassInput {
    readonly context: WebGpuComputeContext;
    readonly result: ComputeResult;
    readonly resources: WebGpuComputeResources;
    readonly ciseledConeRim: GpuBufferAllocation;
    readonly townBoundaryAngular: GpuBufferAllocation;
    readonly townBoundaryEcef: GpuBufferAllocation;
    readonly options: any;
}

export interface WebGpuFinalConesPassResult {
    readonly timing: StageTiming;
    readonly diagnostics: DatasetDiagnostic[];
    readonly finalConeGeometryEcef: GpuBufferAllocation;
}

export async function runWebGpuFinalConesPass(
    input: WebGpuFinalConesPassInput,
): Promise<WebGpuFinalConesPassResult> {
    const { device, queue } = input.context;
    const usage = getGpuBufferUsage();
    
    const pipeline = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: {
            module: input.resources.shaderModuleCache?.get('final-cones') ?? 
                    device.createShaderModule({ code: finalConesShaderSource }),
            entryPoint: 'main',
        },
    });

    const cityCount = input.result.preparedDataset.cityCount;
    const azimuthSampleCount = input.result.rawCones?.azimuthSampleCount ?? 360;
    
    const finalConeGeometryEcef = device.createBuffer({
        size: cityCount * azimuthSampleCount * 16,
        usage: usage.STORAGE | usage.COPY_SRC,
    });

    const uniformBuffer = device.createBuffer({
        size: 64, // FinalConeUniforms: 4 * vec4<f32>
        usage: usage.UNIFORM | usage.COPY_DST,
    });
    
    const proj = input.options.projection;
    const uniformData = new Float32Array([
        6371e3, cityCount, azimuthSampleCount, 12,
        0, 0, proj?.percent ?? 0, 0,
        proj?.settings?.referenceLongitudeRadians ?? 0,
        proj?.settings?.referenceLatitudeRadians ?? 0,
        proj?.settings?.referenceHeightMeters ?? 0,
        proj?.settings?.zCoefficient ?? 1,
        proj?.settings?.standardParallel1Radians ?? 0,
        proj?.settings?.standardParallel2Radians ?? 0,
        0, 0
    ]);
    queue.writeBuffer(uniformBuffer, 0, uniformData);

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: input.ciseledConeRim.buffer } },
            { binding: 1, resource: { buffer: input.townBoundaryAngular.buffer } },
            { binding: 2, resource: { buffer: input.townBoundaryEcef.buffer } },
            { binding: 3, resource: { buffer: uniformBuffer } },
            { binding: 4, resource: { buffer: finalConeGeometryEcef } },
        ],
    });

    const { timing } = await measureAsyncStage(
        'final-cones-precompute',
        'precompute',
        'webgpu',
        async () => {
            const encoder = device.createCommandEncoder();
            const pass = encoder.beginComputePass();
            pass.setPipeline(pipeline);
            pass.setBindGroup(0, bindGroup);
            pass.dispatchWorkgroups(azimuthSampleCount, cityCount, 1);
            pass.end();
            queue.submit([encoder.finish()]);
            return undefined;
        },
    );

    return {
        timing,
        diagnostics: [],
        finalConeGeometryEcef: { 
            buffer: finalConeGeometryEcef, 
            contract: { name: 'finalConeGeometryEcef', size: cityCount * azimuthSampleCount * 16, usage: 'STORAGE' } as any 
        }
    };
}
