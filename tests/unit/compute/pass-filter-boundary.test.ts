import { describe, it, expect } from 'vitest';
import { runWebGl2BoundaryStages } from '../../../src/lib/compute/webgl2/boundary';

// This test verifies that when passFilter excludes the 'geojson-boundary-raycast'
// stage, the boundary runner returns a synthetic timing (skip) and does not
// attempt to execute the actual GL-bound pass. The function short-circuits
// early in this case so no real WebGL context is required.

describe('WebGL2 boundary passFilter', () => {
  it('skips geojson-boundary-raycast when filtered', async () => {
    const dummyGl = null as unknown as WebGL2RenderingContext;
    const dummyResult = {} as any;
    const dummyGeojsonRun = {} as any;
    const dummyResources = {} as any;

    const res = await runWebGl2BoundaryStages(dummyGl, dummyResult, dummyGeojsonRun, dummyResources, null, undefined, {
      passFilter: ['static-town-precompute'], // intentionally does not include geojson-boundary-raycast
    } as any);

    expect(res).toBeDefined();
    expect(res.timing).toBeDefined();
    expect(res.timing.stage).toBe('geojson-boundary-raycast');
    expect(res.diagnostics).toEqual([]);
  });
});
