import assert from 'node:assert/strict';
import { test } from 'vitest';

import { diffWorkspacePrecomputeRequest, type WorkspacePrecomputeRequest } from '$lib/application/workspace';

function request(overrides: Partial<WorkspacePrecomputeRequest> = {}): WorkspacePrecomputeRequest {
	return {
		boundaryAzimuthSampleCount: 360,
		year: 2000,
		shape: 'complex',
		azimuthSampleCount: 360,
		neighborLimit: 16,
		sectorCount: 360,
		coneLengthMeters: 1000,
		attenuationRadians: Math.PI / 6,
		...overrides,
	};
}

test('year changes only invalidate dynamic cone tranches and their dependents', () => {
	const impact = diffWorkspacePrecomputeRequest(request({ year: 2000 }), request({ year: 2010 }));

	assert.equal(impact.preparedDataset, false);
	assert.equal(impact.boundary, false);
	assert.equal(impact.staticTown, false);
	assert.equal(impact.dynamicTown, true);
	assert.equal(impact.rawCones, true);
	assert.equal(impact.coneIntersections, true);
	assert.equal(impact.finalCones, true);
});

test('boundary azimuth changes invalidate only the boundary and final geometry tranches', () => {
	const impact = diffWorkspacePrecomputeRequest(
		request({ boundaryAzimuthSampleCount: 180 }),
		request({ boundaryAzimuthSampleCount: 360 }),
	);

	assert.equal(impact.preparedDataset, false);
	assert.equal(impact.boundary, true);
	assert.equal(impact.staticTown, false);
	assert.equal(impact.dynamicTown, false);
	assert.equal(impact.rawCones, false);
	assert.equal(impact.coneIntersections, false);
	assert.equal(impact.finalCones, true);
});

test('raw cone geometry changes invalidate the cone tranches but not the prepared dataset', () => {
	const impact = diffWorkspacePrecomputeRequest(
		request({ coneLengthMeters: 1000 }),
		request({ coneLengthMeters: 2000 }),
	);

	assert.equal(impact.preparedDataset, false);
	assert.equal(impact.boundary, false);
	assert.equal(impact.staticTown, false);
	assert.equal(impact.dynamicTown, false);
	assert.equal(impact.rawCones, true);
	assert.equal(impact.coneIntersections, true);
	assert.equal(impact.finalCones, true);
});
