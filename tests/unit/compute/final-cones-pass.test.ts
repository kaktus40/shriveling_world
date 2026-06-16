import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { runWebGpuFinalConesPass } from '$lib/compute/webgpu/passes/final-cones';
import type { WebGpuComputeContext, WebGpuComputeResources } from '$lib/compute/webgpu/types';
import type { ComputeResult } from '$lib/compute/core';
import type { GpuBufferAllocation } from '$lib/compute/webgpu/buffers';

test('runWebGpuFinalConesPass initializes pipeline correctly', async () => {
    const mockDevice = { 
        createComputePipelineAsync: vi.fn().mockResolvedValue({ getBindGroupLayout: () => ({}) }),
        createBuffer: vi.fn(),
        createBindGroup: vi.fn(),
        createCommandEncoder: () => ({
            beginComputePass: () => ({ setPipeline: vi.fn(), setBindGroup: vi.fn(), dispatchWorkgroups: vi.fn(), end: vi.fn() }),
            finish: vi.fn()
        }),
        queue: { submit: vi.fn() }
    };
    
    const mockContext = { device: mockDevice, queue: mockDevice.queue } as unknown as WebGpuComputeContext;
    const mockResources = { shaderModuleCache: new Map() } as unknown as WebGpuComputeResources;
    const mockResult = { preparedDataset: { cityCount: 1 } } as ComputeResult;
    const mockBuffer = { buffer: {} as GPUBuffer } as GpuBufferAllocation;

    const result = await runWebGpuFinalConesPass({
        context: mockContext,
        result: mockResult,
        resources: mockResources,
        ciseledConeRim: mockBuffer,
        townBoundaryAngular: mockBuffer,
        townBoundaryEcef: mockBuffer,
        options: {}
    });

    assert.ok(result.finalConeGeometryEcef);
    assert.equal(mockDevice.createComputePipelineAsync.mock.calls.length, 1);
});
