import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { WarmingOrchestrator } from '$lib/compute/webgpu/warming';
import type { WebGpuComputeContext, WebGpuComputeResources } from '$lib/compute/webgpu/types';
import type { ComputeResult } from '$lib/compute/core';

test('WarmingOrchestrator caches results', async () => {
    const mockContext = { device: {} as GPUDevice } as WebGpuComputeContext;
    const mockResources = {} as WebGpuComputeResources;
    const mockResult = { preparedDataset: { cityCount: 1 } } as ComputeResult;

    const mockDeps = {
        runRawAlpha: vi.fn().mockResolvedValue({}),
        runCiseled: vi.fn().mockResolvedValue({ ciseledConeRimEcef: { buffer: {} as GPUBuffer } }),
        readBack: vi.fn().mockResolvedValue(new Float32Array([1, 2, 3, 4]))
    };

    const orchestrator = new WarmingOrchestrator(mockContext, mockResources, mockResult, mockDeps);
    
    // Test that it returns a result and caches it
    const data = await orchestrator.warmYear(2000);
    assert.ok(orchestrator.getCache().has(2000));
    assert.deepEqual(data, new Float32Array([1, 2, 3, 4]));
    
    // Verify cached result is the same instance
    const cachedData = await orchestrator.warmYear(2000);
    assert.strictEqual(data, cachedData);
    assert.equal(mockDeps.readBack.mock.calls.length, 1); // Should only be called once
});
