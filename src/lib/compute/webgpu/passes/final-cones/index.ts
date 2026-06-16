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
    readonly options: any; // ComputeOptions
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
    
    // Shader compilation
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
    
    // Output Buffer
    const finalConeGeometryEcef = device.createBuffer({
        size: cityCount * azimuthSampleCount * 16, // vec4<f32>
        usage: usage.STORAGE | usage.COPY_SRC,
    });

    // Uniform buffer setup - FinalConeUniforms: 4 * vec4<f32> = 64 bytes
    const uniformBuffer = device.createBuffer({
        size: 64, 
        usage: usage.UNIFORM | usage.COPY_DST,
    });
    
    // Inject projection parameters
    const proj = input.options.projection;
    const settings = proj?.settings;
    const uniformData = new Float32Array([
        // values: vec4<f32>(earthRadius, cityCount, azimuthSampleCount, globeRadius)
        6371e3, cityCount, azimuthSampleCount, 12,
        // projection: vec4<f32>(startModeIndex, endModeIndex, percent, 0)
        proj?.start === 'none' ? 0 : 1, proj?.end === 'none' ? 0 : 1, proj?.percent ?? 0, 0,
        // projection_settings_a: vec4<f32>(refLon, refLat, refHeight, zCoeff)
        settings?.referenceLongitudeRadians ?? 0,
        settings?.referenceLatitudeRadians ?? 0,
        settings?.referenceHeightMeters ?? 0,
        settings?.zCoefficient ?? 1,
        // projection_settings_b: vec4<f32>(standardParallel1, standardParallel2, 0, 0)
        settings?.standardParallel1Radians ?? 0,
        settings?.standardParallel2Radians ?? 0,
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
