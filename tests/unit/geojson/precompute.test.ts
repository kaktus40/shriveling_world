import assert from 'node:assert/strict';
import test from 'node:test';
import type GeoJSON from 'geojson';
import { degreesToRadians, prepareBoundaryPrecompute } from '../../../src/lib/domain/geojson';

function assertClose(actual: number, expected: number, epsilon = 1e-8): void {
	assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}

function featureCollection(coordinates: number[][]): GeoJSON.FeatureCollection {
	return {
		type: 'FeatureCollection',
		features: [
			{
				type: 'Feature',
				properties: { name: 'test' },
				geometry: {
					type: 'Polygon',
					coordinates: [[...coordinates, coordinates[0]]],
				},
			},
		],
	};
}

test('prepareBoundaryPrecompute converts GeoJSON degrees to internal radians and builds vector buffers', () => {
	const result = prepareBoundaryPrecompute(
		featureCollection([
			[0, 0],
			[10, 0],
			[10, 10],
			[0, 10],
		]),
		[{ cityId: 0, cityCode: 100, longitudeRadians: degreesToRadians(5), latitudeRadians: degreesToRadians(5) }],
		{ contourMaxSegmentRadians: degreesToRadians(1), interiorPointSpacingRadians: degreesToRadians(5) }
	);

	assert.equal(result.contours.length, 1);
	assert.equal(result.countryContourOffsets[0], 0);
	assert.equal(result.countryContourSizes[0], 40);
	assert.equal(result.countryContourBuffer.length, result.countryContourSizes[0] * 2);
	assert.equal(result.countryContourNVectorBuffer.length, result.countryContourSizes[0] * 4);
	assertClose(result.countryContourBuffer[2], degreesToRadians(1));
	assert.equal(result.countryContourBuffer[3], 0);
	assert.equal(result.cityContourIndexes[0], 0);
	assert.equal(result.townCountryIndexes[0], 0);
});

test('cityContourIndexes follows city order while townCountryIndexes remains indexed by cityId', () => {
	const result = prepareBoundaryPrecompute(
		featureCollection([
			[0, 0],
			[10, 0],
			[10, 10],
			[0, 10],
		]),
		[{ cityId: 5, cityCode: 100, longitudeRadians: degreesToRadians(5), latitudeRadians: degreesToRadians(5) }],
		{ contourMaxSegmentRadians: degreesToRadians(2), interiorPointSpacingRadians: degreesToRadians(5) }
	);

	assert.deepEqual([...result.cityContourIndexes], [0]);
	assert.deepEqual([...result.townCountryIndexes], [-1, -1, -1, -1, -1, 0]);
});

test('prepareBoundaryPrecompute reports a town outside retained contours', () => {
	const result = prepareBoundaryPrecompute(
		featureCollection([
			[0, 0],
			[10, 0],
			[10, 10],
			[0, 10],
		]),
		[{ cityId: 0, cityCode: 100, longitudeRadians: degreesToRadians(20), latitudeRadians: degreesToRadians(20) }],
		{ contourMaxSegmentRadians: degreesToRadians(2), interiorPointSpacingRadians: degreesToRadians(5) }
	);

	assert.equal(result.cityContourIndexes[0], -1);
	assert.equal(result.townCountryIndexes[0], -1);
	assert.equal(result.diagnostics[0]?.code, 'town-outside-country-contours');
});
