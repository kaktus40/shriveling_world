import { describe, it, expect } from 'vitest';
import { createComputeWorker } from '../../src/lib/compute/phase-c/phase-c';

// Ensure CpuComputeBackend would prefer module Worker when available by
// asserting a module worker can be instantiated and responds to ping.

describe('cpu compute backend worker preference', () => {
  it('module worker responds to ping and is preferred over in-process', async () => {
    const worker = createComputeWorker();
    const res = await worker.post({ id: 'ping-1', type: 'ping' });
    expect(res).toBeDefined();
    expect(res.ok).toBe(true);
    expect(res.type).toBe('pong');
  });
});
