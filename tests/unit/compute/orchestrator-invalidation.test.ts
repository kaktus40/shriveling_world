import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { createComputeOrchestrator, type ComputeOrchestrator } from '$lib/compute/core/orchestrator';
import type { ComputeBackendRegistry, ComputeBackend, ComputeInput, ComputeResult, ComputeOptions } from '$lib/compute/core/types';

test('orchestrator detects staticTown changes and sets invalidation flag', async () => {
        const mockBackend: ComputeBackend = {
                profile: 'cpu',
                warm: vi.fn(),
                computeFrame: vi.fn(async (input, options) => {
                        return { selection: { selected: 'cpu', fallbackUsed: false, capabilities: { cpuAvailable: true, webgpuAvailable: false, webgl2Available: false, notes: [] } } } as unknown as ComputeResult;
                }),
                dispose: vi.fn(),
        };

        const registry: ComputeBackendRegistry = {
                cpu: {
                        profile: 'cpu',
                        isAvailable: () => true,
                        create: async () => mockBackend,
                },
        };

        const orchestrator = createComputeOrchestrator(registry);
        const input: ComputeInput = { sourceFiles: [] };

        // First frame
        await orchestrator.computeFrame(input, { staticTown: { neighborLimit: 16 } });
        
        // Second frame with change
        await orchestrator.computeFrame(input, { staticTown: { neighborLimit: 32 } });

        const lastCallOptions = (mockBackend.computeFrame as any).mock.calls[1][1];
        assert.equal(lastCallOptions._invalidateStatic, true);
});
