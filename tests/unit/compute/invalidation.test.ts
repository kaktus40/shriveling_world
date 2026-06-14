import assert from 'node:assert/strict';
import { test } from 'vitest';

import { diffComputeOptions, type ComputeOptions } from '$lib/compute';

function options(overrides: Partial<ComputeOptions> = {}): ComputeOptions {
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

test('compute stack invalidation preserves the prepared dataset and isolates yearly changes', () => {
	const impact = diffComputeOptions(options({ dynamicYear: 2000 }), options({ dynamicYear: 2010 }));

	assert.equal(impact.preparedDataset, false);
	assert.equal(impact.boundary, false);
	assert.equal(impact.staticTown, false);
	assert.equal(impact.dynamicTown, true);
	assert.equal(impact.rawCones, true);
	assert.equal(impact.coneIntersections, true);
	assert.equal(impact.finalCones, true);
	assert.equal(impact.curveGeometry, false);
});

test('compute stack invalidation propagates boundary-only changes to the final geometry tranche', () => {
	const impact = diffComputeOptions(
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

test('compute stack invalidation propagates projection changes to final cones and curves', () => {
	const impact = diffComputeOptions(
		options({
			projection: {
				start: 'none',
				end: 'equirectangular',
				percent: 0,
			},
		}),
		options({
			projection: {
				start: 'equirectangular',
				end: 'Mercator',
				percent: 50,
			},
		}),
	);

	assert.equal(impact.preparedDataset, false);
	assert.equal(impact.boundary, false);
	assert.equal(impact.staticTown, false);
	assert.equal(impact.dynamicTown, false);
	assert.equal(impact.rawCones, false);
	assert.equal(impact.coneIntersections, false);
	assert.equal(impact.finalCones, true);
	assert.equal(impact.curveGeometry, true);
});
