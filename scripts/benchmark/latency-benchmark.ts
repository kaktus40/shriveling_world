#!/usr/bin/env -S node
// Simple synthetic latency benchmark (TypeScript). Run with: npx tsx scripts/benchmark/latency-benchmark.ts
const iterations = parseInt(process.env.BENCH_ITERATIONS || '20000', 10);
const sizeBytes = parseInt(process.env.BENCH_SIZE || '4096', 10);
console.log(JSON.stringify({ note: 'Starting synthetic benchmark', iterations, sizeBytes }));
const start = Date.now();
for (let i = 0; i < iterations; i++) {
  const a = new ArrayBuffer(sizeBytes);
  const v = new Uint8Array(a);
  v[0] = i & 0xff;
  if ((i & 1023) === 0) {
    // micro-yield - no-op
  }
}
const durationMs = Date.now() - start;
console.log(JSON.stringify({ iterations, sizeBytes, durationMs, perIterationMs: durationMs / iterations }));
