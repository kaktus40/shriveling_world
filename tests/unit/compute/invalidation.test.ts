import assert from 'node:assert/strict';
import { test } from 'vitest';

import { diffComputeWorkflowOptions, type ComputeWorkflowOptions } from '$lib/compute';

function options(overrides: Partial<ComputeWorkflowOptions> = {}): ComputeWorkflowOptions {
	return {
		boundaryRaycast: { azimuthSampleCount: 360 },
		staticTown: { sectorCount: 360, neighborLimit: 16 },
		dynamicYear: 2000,
		rawCone: {
			shape: 'complex',
			azimuthSampleCount: 360,
			coneLengthMeters: 1000,
			attenuationRadians: Math.PI / 6,
		},
		...overrides,
	};
}

test('compute workflow invalidation preserves the prepared dataset and isolates yearly changes', () => {
	const impact = diffComputeWorkflowOptions(options({ dynamicYear: 2000 }), options({ dynamicYear: 2010 }));

	assert.equal(impact.preparedDataset, false);
	assert.equal(impact.boundary, false);
	assert.equal(impact.staticTown, false);
	assert.equal(impact.dynamicTown, true);
	assert.equal(impact.rawCones, true);
	assert.equal(impact.coneIntersections, true);
	assert.equal(impact.finalCones, true);
	assert.equal(impact.curveGeometry, false);
});

test('compute workflow invalidation propagates boundary-only changes to the final geometry tranche', () => {
	const impact = diffComputeWorkflowOptions(
		options({ boundaryRaycast: { azimuthSampleCount: 180 } }),
		options({ boundaryRaycast: { azimuthSampleCount: 360 } }),
	);

	assert.equal(impact.preparedDataset, false);
	assert.equal(impact.boundary, true);
	assert.equal(impact.staticTown, false);
	assert.equal(impact.dynamicTown, false);
	assert.equal(impact.rawCones, false);
	assert.equal(impact.coneIntersections, false);
	assert.equal(impact.finalCones, true);
	assert.equal(impact.curveGeometry, false);
});
