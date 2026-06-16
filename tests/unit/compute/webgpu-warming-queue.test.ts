import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { WarmingOrchestrator } from '$lib/compute/webgpu/warming';
import type { WebGpuComputeContext, WebGpuComputeResources } from '$lib/compute/webgpu/types';
import type { ComputeResult } from '$lib/compute/core';

test('WarmingOrchestrator reorders queue based on focus year', async () => {
    const mockContext = { device: {} as GPUDevice } as WebGpuComputeContext;
    const mockResources = {} as WebGpuComputeResources;
    const mockResult = { preparedDataset: { cityCount: 1 } } as ComputeResult;

    const mockDeps = {
        runRawAlpha: vi.fn().mockResolvedValue({}),
        runCiseled: vi.fn().mockResolvedValue({ ciseledConeRimEcef: { buffer: {} as GPUBuffer } }),
        readBack: vi.fn().mockResolvedValue(new Float32Array([1]))
    };

    const orchestrator = new WarmingOrchestrator(mockContext, mockResources, mockResult, [2000, 2001, 2005, 2010], mockDeps);
    
    // Set focus to 2005 - await the call
    await orchestrator.setFocusYear(2005);
    
    const cache = orchestrator.getCache();
    assert.ok(cache.has(2005));
    assert.ok(cache.has(2001));
    assert.ok(cache.has(2000));
    assert.ok(cache.has(2010));
});
