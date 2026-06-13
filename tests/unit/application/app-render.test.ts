import { strict as assert } from 'node:assert';
import { describe, test } from 'vitest';
import type { ComputeResult } from '$lib/compute';
import { EARTH_RADIUS_METERS } from '$lib/shared';
import { APP_GLOBE_RADIUS } from '$lib/application/app/geometry';
import {
	buildAppBusinessLayers,
	ecefToAppPoint,
} from '$lib/application/app/render';
import {
	mixAppProjectionPoints,
	projectAppEcefPoint,
} from '$lib/application/app/projection';

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
		const layers = buildAppBusinessLayers(buildMinimalComputeResult(), 'none', 'none', 100);
		assert.equal(layers.length, 3);
		assert.equal(layers[0]?.name, 'boundary-0-synthetic.geojson');
		assert.equal(layers[1]?.name, 'final-cones-0-synthetic.geojson');
		assert.equal(layers[2]?.name, 'curve-geometry');
		assert.equal(layers[0]?.polylines[0]?.points.length, 3);
		assert.equal(layers[1]?.polylines[0]?.points.length, 3);
		assert.equal(layers[2]?.polylines[0]?.points.length, 2);
		assert.equal(layers[0]?.opacity, 0.66);
		assert.equal(layers[1]?.opacity, 0.6);
		assert.equal(layers[2]?.opacity, 0.72);
	});

	test('project business layer geometry with the selected projection', () => {
		const globeLayers = buildAppBusinessLayers(buildMinimalComputeResult(), 'none', 'none', 0);
		const cartoLayers = buildAppBusinessLayers(buildMinimalComputeResult(), 'equirectangular', 'equirectangular', 0);
		assert.notDeepEqual(globeLayers[0]?.polylines[0]?.points[1], cartoLayers[0]?.polylines[0]?.points[1]);
	});

	test('focus the selected business layer when a city is selected', () => {
		const unfocusedLayers = buildAppBusinessLayers(buildMinimalComputeResult(), 'none', 'none', 100, null);
		const focusedLayers = buildAppBusinessLayers(buildMinimalComputeResult(), 'none', 'none', 100, 0);
		assert.ok((focusedLayers[0]?.opacity ?? 0) > (unfocusedLayers[0]?.opacity ?? 0));
	});

	test('blend business layer geometry between projections', () => {
		const globePoint = projectAppEcefPoint(0, EARTH_RADIUS_METERS, 0, 'none', 'none', 0);
		const cartoPoint = projectAppEcefPoint(0, EARTH_RADIUS_METERS, 0, 'equirectangular', 'equirectangular', 0);
		assert.deepEqual(mixAppProjectionPoints(globePoint, cartoPoint, 50), [
			(globePoint[0] + cartoPoint[0]) / 2,
			(globePoint[1] + cartoPoint[1]) / 2,
			(globePoint[2] + cartoPoint[2]) / 2,
		]);
	});
});
