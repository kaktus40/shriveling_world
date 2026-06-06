import assert from 'node:assert/strict';
import test from 'node:test';
import {
	EARTH_RADIUS_METERS,
	buildNed2EcefMatrix,
	lonLatToNVector,
	intermediateNVector,
	nVectorToLonLat,
	readMatrixColumn3,
	readNVectorFromNed2Ecef,
} from '../../../src/lib/shared';
import { degreesToRadians } from '../../../src/lib/domain/geojson';

const EPSILON = 1e-6;

function assertClose(actual: number, expected: number, epsilon = EPSILON): void {
	assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}

function assertVecClose(actual: readonly number[], expected: readonly number[], epsilon = EPSILON): void {
	assert.equal(actual.length, expected.length);
	actual.forEach((value, index) => assertClose(value, expected[index], epsilon));
}

test('lonLatToNVector and nVectorToLonLat use radians internally', () => {
	const lonLat = [degreesToRadians(12), degreesToRadians(34)] as const;
	const nVector = lonLatToNVector(lonLat);
	const roundtrip = nVectorToLonLat(nVector);

	assertVecClose(roundtrip, lonLat);
});

test('buildNed2EcefMatrix follows the corrected latitude convention at the equator', () => {
	const matrix = buildNed2EcefMatrix([0, 0]);

	assertVecClose(readMatrixColumn3(matrix, 0, 0), [0, 0, 1]);
	assertVecClose(readMatrixColumn3(matrix, 0, 1), [0, 1, 0]);
	assertVecClose(readMatrixColumn3(matrix, 0, 2), [-1, 0, 0]);
	assertVecClose(readMatrixColumn3(matrix, 0, 3), [EARTH_RADIUS_METERS, 0, 0], 1e-3);
	assertVecClose(readNVectorFromNed2Ecef(matrix, 0), [1, 0, 0]);
});

test('buildNed2EcefMatrix keeps the north pole translation on the Z axis', () => {
	const matrix = buildNed2EcefMatrix([0, degreesToRadians(90)]);

	assertVecClose(readMatrixColumn3(matrix, 0, 3), [0, 0, EARTH_RADIUS_METERS], 1e-2);
	assertVecClose(readNVectorFromNed2Ecef(matrix, 0), [0, 0, 1], 1e-6);
});

test('intermediateNVector follows normalized spherical interpolation used by historical midpoints', () => {
	const quarter = intermediateNVector([1, 0, 0], [0, 1, 0], 0.5);
	assertVecClose(quarter, [Math.SQRT1_2, Math.SQRT1_2, 0]);
	assert.throws(() => intermediateNVector([1, 0, 0], [-1, 0, 0], 0.5), /antipodal/);
});
