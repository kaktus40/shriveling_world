import { strict as assert } from 'node:assert';
import { describe, test } from 'vitest';
import type { ComputeResult } from '$lib/compute';
import { EARTH_RADIUS_METERS } from '$lib/shared';
import { APP_GLOBE_RADIUS } from '$lib/application/app/geometry';
import { buildAppBusinessLayers, ecefToAppPoint } from '$lib/application/app/render';

function buildMinimalComputeResult(): ComputeResult {
	return {
		selection: {} as ComputeResult['selection'],
		inspectedFiles: [],
		baseNetwork: {} as ComputeResult['baseNetwork'],
		preparedDataset: {} as ComputeResult['preparedDataset'],
		geojsonRuns: [
			{
				fileName: 'synthetic.geojson',
				geojson: {} as ComputeResult['geojsonRuns'][number]['geojson'],
				boundaryPrecompute: {} as ComputeResult['geojsonRuns'][number]['boundaryPrecompute'],
				boundaryRaycast: {
					townBoundaryAngular: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1]),
					townBoundaryEcef: new Float32Array([
						EARTH_RADIUS_METERS,
						0,
						0,
						1,
						0,
						EARTH_RADIUS_METERS,
						0,
						1,
					]),
					azimuthIntervalCount: 2,
					diagnostics: [],
				},
				finalCones: {
					cityCount: 1,
					azimuthSampleCount: 2,
					finalConeGeometryEcef: new Float32Array([
						EARTH_RADIUS_METERS,
						0,
						0,
						1,
						0,
						EARTH_RADIUS_METERS,
						0,
						1,
					]),
				},
			},
		],
		staticTown: {} as ComputeResult['staticTown'],
		dynamicTown: undefined,
		rawCones: undefined,
		coneIntersections: undefined,
		curveGeometry: {
			curveCount: 1,
			pointsPerCurve: 1,
			positions: new Float32Array([
				EARTH_RADIUS_METERS,
				0,
				0,
				1,
				0,
				EARTH_RADIUS_METERS,
				0,
				1,
			]),
		},
		diagnostics: [],
		benchmark: {} as ComputeResult['benchmark'],
	};
}

describe('app render helpers', () => {
	test('scale ecef points to the app globe radius', () => {
		assert.deepEqual(ecefToAppPoint(EARTH_RADIUS_METERS, 0, 0), [APP_GLOBE_RADIUS, 0, 0]);
	});

	test('extract real business layers from compute results', () => {
		const layers = buildAppBusinessLayers(buildMinimalComputeResult(), 100);
		assert.equal(layers.length, 3);
		assert.equal(layers[0]?.name, 'boundary-0-synthetic.geojson');
		assert.equal(layers[1]?.name, 'final-cones-0-synthetic.geojson');
		assert.equal(layers[2]?.name, 'curve-geometry');
		assert.equal(layers[0]?.polylines[0]?.points.length, 3);
		assert.equal(layers[1]?.polylines[0]?.points.length, 3);
		assert.equal(layers[2]?.polylines[0]?.points.length, 2);
		assert.equal(layers[0]?.opacity, 0.8);
		assert.equal(layers[1]?.opacity, 0.8);
		assert.equal(layers[2]?.opacity, 0.8);
	});

	test('blend business layer opacity with representation percent', () => {
		const layersLow = buildAppBusinessLayers(buildMinimalComputeResult(), 0);
		const layersHigh = buildAppBusinessLayers(buildMinimalComputeResult(), 100);
		assert.ok((layersLow[0]?.opacity ?? 0) < (layersHigh[0]?.opacity ?? 0));
	});
});
