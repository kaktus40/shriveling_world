import assert from 'node:assert/strict';
import { test } from 'vitest';
import type GeoJSON from 'geojson';
import { EARTH_RADIUS_METERS } from '../../../src/lib/shared';
import {
	buildAzimuthIntervals,
	buildCityNed2EcefMatrices,
	computeTownBoundaryLimitsCpu,
	degreesToRadians,
	packAzimuthIntervals,
	prepareBoundaryPrecompute,
} from '../../../src/lib/domain/geojson';

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

function runRaycast(coordinates: number[][], townLongitudeDeg: number, townLatitudeDeg: number, intervalHalfWidthDeg = 1) {
	const town = {
		cityId: 5,
		cityCode: 100,
		longitudeRadians: degreesToRadians(townLongitudeDeg),
		latitudeRadians: degreesToRadians(townLatitudeDeg),
	};
	const precompute = prepareBoundaryPrecompute(featureCollection(coordinates), [town], {
		contourMaxSegmentRadians: degreesToRadians(1),
		interiorPointSpacingRadians: degreesToRadians(5),
		azimuthSampleCount: 4,
		countryExtrusionHeightMeters: 0,
	});
	const raycast = computeTownBoundaryLimitsCpu({
		cityNed2EcefMatrices: buildCityNed2EcefMatrices([town]),
		cityContourIndexes: precompute.cityContourIndexes,
		countryContourNVectorBuffer: precompute.countryContourNVectorBuffer,
		countryContourOffsets: precompute.countryContourOffsets,
		countryContourSizes: precompute.countryContourSizes,
		azimuthIntervals: packAzimuthIntervals(buildAzimuthIntervals(4, degreesToRadians(intervalHalfWidthDeg))),
		earthRadiusMeters: EARTH_RADIUS_METERS,
	});

	return { precompute, raycast };
}

function validFlags(buffer: Float32Array): number[] {
	return [buffer[3], buffer[7], buffer[11], buffer[15]];
}

function distances(buffer: Float32Array): number[] {
	return [buffer[2], buffer[6], buffer[10], buffer[14]];
}

test('computeTownBoundaryLimitsCpu finds four limits for a centered city in a square', () => {
	const { raycast } = runRaycast(
		[
			[0, 0],
			[10, 0],
			[10, 10],
			[0, 10],
		],
		5,
		5
	);

	assert.deepEqual(validFlags(raycast.townBoundaryAngular), [1, 1, 1, 1]);
	distances(raycast.townBoundaryAngular).forEach((distance) => assert.ok(distance > 0));
	assert.equal(raycast.diagnostics.length, 0);
});

test('computeTownBoundaryLimitsCpu handles an off-center city in a square', () => {
	const { raycast } = runRaycast(
		[
			[0, 0],
			[10, 0],
			[10, 10],
			[0, 10],
		],
		2,
		5
	);
	const [, eastDistance, , westDistance] = distances(raycast.townBoundaryAngular);

	assert.deepEqual(validFlags(raycast.townBoundaryAngular), [1, 1, 1, 1]);
	assert.ok(eastDistance > westDistance, 'east boundary should be farther than west boundary for a western off-center city');
});

test('computeTownBoundaryLimitsCpu handles a non-square polygon', () => {
	const { raycast } = runRaycast(
		[
			[0, 0],
			[12, 0],
			[9, 8],
			[3, 11],
			[-1, 5],
		],
		5,
		5
	);

	assert.deepEqual(validFlags(raycast.townBoundaryAngular), [1, 1, 1, 1]);
	distances(raycast.townBoundaryAngular).forEach((distance) => assert.ok(distance > 0));
});

test('computeTownBoundaryLimitsCpu handles a simple concave polygon', () => {
	const { raycast } = runRaycast(
		[
			[0, 0],
			[10, 0],
			[10, 4],
			[6, 4],
			[6, 10],
			[0, 10],
		],
		3,
		5
	);

	assert.deepEqual(validFlags(raycast.townBoundaryAngular), [1, 1, 1, 1]);
	distances(raycast.townBoundaryAngular).forEach((distance) => assert.ok(distance > 0));
});

test('computeTownBoundaryLimitsCpu reports misses for a city outside every contour', () => {
	const { precompute, raycast } = runRaycast(
		[
			[0, 0],
			[10, 0],
			[10, 10],
			[0, 10],
		],
		20,
		20
	);

	assert.equal(precompute.cityContourIndexes[0], -1);
	assert.deepEqual(validFlags(raycast.townBoundaryAngular), [0, 0, 0, 0]);
	assert.equal(raycast.diagnostics[0]?.code, 'city-without-country-contour');
});

test('buildAzimuthIntervals represents the zero crossing as a continuous negative interval', () => {
	const packed = packAzimuthIntervals(buildAzimuthIntervals(360, degreesToRadians(1)));

	assert.ok(Math.abs(packed[0] - degreesToRadians(-1)) < 1e-8);
	assert.ok(Math.abs(packed[1] - degreesToRadians(1)) < 1e-8);
});
