import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { runWebGpuCountryProjectionPass } from '$lib/compute/webgpu/passes/country-projection';
import type { WebGpuComputeContext, WebGpuComputeResources } from '$lib/compute/webgpu/types';
import type { ComputeResult } from '$lib/compute/core';
import type { GpuBufferAllocation } from '$lib/compute/webgpu/buffers';

test('runWebGpuCountryProjectionPass initializes correctly', async () => {
    const mockDevice = { 
        createComputePipelineAsync: vi.fn().mockResolvedValue({ getBindGroupLayout: () => ({}) }),
        createBuffer: vi.fn().mockReturnValue({}),
        createShaderModule: vi.fn().mockReturnValue({}),
        createBindGroup: vi.fn(),
        createCommandEncoder: () => ({
            beginComputePass: () => ({ setPipeline: vi.fn(), setBindGroup: vi.fn(), dispatchWorkgroups: vi.fn(), end: vi.fn() }),
            finish: vi.fn()
        }),
        queue: { submit: vi.fn(), writeBuffer: vi.fn() }
    };
    
    const mockContext = { device: mockDevice, queue: mockDevice.queue } as unknown as WebGpuComputeContext;
    const mockResources = { shaderModuleCache: new Map() } as unknown as WebGpuComputeResources;
    const mockResult = { preparedDataset: { cityCount: 1 } } as ComputeResult;
    const mockBuffer = { buffer: {} as GPUBuffer, contract: { count: 10 } } as GpuBufferAllocation;

    const result = await runWebGpuCountryProjectionPass({
        context: mockContext,
        result: mockResult,
        resources: mockResources,
        countryVertices: mockBuffer,
        options: {
            projection: { percent: 0.5, settings: { zCoefficient: 1.0 } }
        }
    });

    assert.ok(result.projectedVertices);
    assert.equal(mockDevice.createComputePipelineAsync.mock.calls.length, 1);
});
