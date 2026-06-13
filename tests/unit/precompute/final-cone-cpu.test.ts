import { strict as assert } from 'node:assert';
import { describe, test } from 'vitest';
import { EARTH_RADIUS_METERS } from '$lib/shared';
import { computeFinalConePrecomputeCpu } from '$lib/domain/precompute/cpu';
import { UNUSED_INDEX, type ConeIntersectionOraclePrecompute } from '$lib/domain/precompute';
import type { BoundaryRaycastResult } from '$lib/domain/geojson';

function createOracle(): ConeIntersectionOraclePrecompute {
	return {
		cityCount: 1,
		azimuthSampleCount: 1,
		coneIntersectionDistanceMeters: new Float32Array([EARTH_RADIUS_METERS]),
		ciseledConeRimEcef: new Float32Array([EARTH_RADIUS_METERS, 0, 0, 1]),
		winningNeighborCityIndexes: new Uint32Array([UNUSED_INDEX]),
		winningFaceIndexes: new Uint32Array([UNUSED_INDEX]),
		testedFaceCounts: new Uint32Array([1]),
	};
}

function createBoundary(): BoundaryRaycastResult {
	return {
		azimuthIntervalCount: 1,
		townBoundaryAngular: new Float32Array([0, 0, 0, 1]),
		townBoundaryEcef: new Float32Array([0, 0, 0, 1]),
		diagnostics: [],
	};
}

describe('final cone CPU projection', () => {
	test('projects the final cone geometry in the selected display space', () => {
		const result = computeFinalConePrecomputeCpu(
			createOracle(),
			createBoundary(),
			EARTH_RADIUS_METERS,
			{
				start: 'none',
				end: 'none',
				percent: 0,
			},
		);

		assert.equal(result.finalConeGeometryEcef[0], 1);
		assert.ok(Math.abs(result.finalConeGeometryEcef[1]) < 1e-7);
		assert.ok(Math.abs(result.finalConeGeometryEcef[2]) < 1e-7);
		assert.equal(result.finalConeGeometryEcef[3], 1);
	});

	test('blends between two display projections using the requested ratio', () => {
		const result = computeFinalConePrecomputeCpu(
			createOracle(),
			createBoundary(),
			EARTH_RADIUS_METERS,
			{
				start: 'none',
				end: 'equirectangular',
				percent: 50,
			},
		);

		assert.equal(result.finalConeGeometryEcef[0], 0.5);
		assert.equal(result.finalConeGeometryEcef[1], 0);
		assert.equal(result.finalConeGeometryEcef[2], 0);
		assert.equal(result.finalConeGeometryEcef[3], 1);
	});
});
