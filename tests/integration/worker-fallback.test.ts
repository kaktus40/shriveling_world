import { describe, it, expect } from 'vitest';
import { createComputeWorker } from '../../src/lib/compute/phase-c/phase-c';

describe('compute worker auto-detection', () => {
  it('responds to ping via worker or in-process fallback', async () => {
    const worker = createComputeWorker();
    const res = await worker.post({ id: 'test-ping', type: 'ping' });
    expect(res).toBeDefined();
    expect(res.ok).toBe(true);
    expect(res.type === 'pong' || res.type === 'result').toBe(true);
  });
});
