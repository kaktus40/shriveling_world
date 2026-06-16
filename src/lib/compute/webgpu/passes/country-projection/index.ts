import countryProjectionShaderSource from '../../../kernels/country-projection/webgpu.wgsl?raw';
import projectionShaderSource from '../../../kernels/shared/projection/webgpu.wgsl?raw';
import sharedMathShaderSource from '../../../kernels/shared/math/webgpu.wgsl?raw';
import type { DatasetDiagnostic } from '../../../../domain/data';
import type { ComputeResult, StageTiming } from '../../../core';
import { measureAsyncStage } from '../../../core/timing';
import type { WebGpuComputeContext, WebGpuComputeResources } from '../../types';
import { type GpuBufferAllocation } from '../../buffers';
import { getGpuBufferUsage } from '../../../shared/compute';

export interface WebGpuCountryProjectionPassInput {
    readonly context: WebGpuComputeContext;
    readonly result: ComputeResult;
    readonly resources: WebGpuComputeResources;
    readonly countryVertices: GpuBufferAllocation; // Buffer from Phase 2 [lon, lat, h]
    readonly options: any;
}

export interface WebGpuCountryProjectionPassResult {
    readonly timing: StageTiming;
    readonly diagnostics: DatasetDiagnostic[];
    readonly projectedVertices: GpuBufferAllocation;
}

export async function runWebGpuCountryProjectionPass(
    input: WebGpuCountryProjectionPassInput,
): Promise<WebGpuCountryProjectionPassResult> {
    const { device, queue } = input.context;
    const usage = getGpuBufferUsage();
    
    // Shader compilation
    const pipeline = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: {
            module: device.createShaderModule({ 
                code: `${sharedMathShaderSource}\n${projectionShaderSource}\n${countryProjectionShaderSource}` 
            }),
            entryPoint: 'main',
        },
    });
    
    const vertexCount = input.countryVertices.contract.count;
    
    // Output Buffer: 4 * f32 per vertex
    const projectedVertices = device.createBuffer({
        size: vertexCount * 16, 
        usage: usage.STORAGE | usage.COPY_SRC,
    });

    // Uniform buffer setup
    const uniformBuffer = device.createBuffer({
        size: 64, 
        usage: usage.UNIFORM | usage.COPY_DST,
    });
    
    // Fill Uniforms - match CountryProjectionUniforms struct
    const proj = input.options.projection;
    const settings = proj?.settings;
    const uniformData = new Float32Array([
        proj?.start === 'none' ? 0 : 1, proj?.end === 'none' ? 0 : 1, proj?.percent ?? 0, 0,
        settings?.referenceLongitudeRadians ?? 0,
        settings?.referenceLatitudeRadians ?? 0,
        settings?.referenceHeightMeters ?? 0,
        settings?.zCoefficient ?? 1,
        settings?.standardParallel1Radians ?? 0,
        settings?.standardParallel2Radians ?? 0,
        0, 0,
        proj?.percent ?? 1.0, settings?.zCoefficient ?? 1.0, 0, 0
    ]);
    queue.writeBuffer(uniformBuffer, 0, uniformData);

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: input.countryVertices.buffer } },
            { binding: 1, resource: { buffer: uniformBuffer } },
            { binding: 2, resource: { buffer: projectedVertices } },
        ],
    });

    const { timing } = await measureAsyncStage(
        'country-projection',
        'precompute',
        'webgpu',
        async () => {
            const encoder = device.createCommandEncoder();
            const pass = encoder.beginComputePass();
            pass.setPipeline(pipeline);
            pass.setBindGroup(0, bindGroup);
            pass.dispatchWorkgroups(Math.ceil(vertexCount / 64), 1, 1);
            pass.end();
            queue.submit([encoder.finish()]);
            return undefined;
        },
    );

    return {
        timing,
        diagnostics: [],
        projectedVertices: { 
            buffer: projectedVertices, 
            contract: { name: 'projectedVertices', size: vertexCount * 16, usage: 'STORAGE' } as any 
        }
    };
}
