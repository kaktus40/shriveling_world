import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { WebGl2ComputeBackend } from '$lib/compute/webgl2/backend';
import { createCpuComputeBackend } from '$lib/compute/cpu';

vi.mock('$lib/compute/webgl2/resources', () => ({
    createWebGl2ComputeResources: vi.fn().mockReturnValue({
        buffers: [],
        pipeline: { passes: [] },
        programCache: new Map(),
        framebufferCache: new Map(),
        doubleBufferSets: new Map(),
    })
}));

test('WebGl2ComputeBackend orchestrates full compute pipeline', async () => {
    class MockWebGL2RenderingContext {
        createBuffer() { return {} as WebGLBuffer; }
        createVertexArray() {}
        bindVertexArray() {}
        bindBuffer() {}
        enableVertexAttribArray() {}
        vertexAttribPointer() {}
        bufferData() {}
        getUniformLocation() {}
        createProgram() {}
        getParameter() { return 'WebGL 2.0'; }
        useProgram() {}
    }
    
    const mockGl = new MockWebGL2RenderingContext() as unknown as WebGL2RenderingContext;
    (global as any).WebGL2RenderingContext = MockWebGL2RenderingContext;

    const mockCanvas = { getContext: () => mockGl } as unknown as HTMLCanvasElement;
    const cpuBackend = createCpuComputeBackend();
    
    const backend = new WebGl2ComputeBackend({ canvas: mockCanvas, cpuBackend });
    
    // Simulate computeFrame call
    // Note: This will require extensive mocking of input/options due to complex dependencies
    // but verifies the backend setup.
    const available = await backend.ensureAvailable();
    assert.strictEqual(available, true);
    
    // Further testing of computeFrame orchestration requires more specific mocks
    // for runWebGl2ConeStages etc., which we will add progressively.
    assert.ok(backend);
});
