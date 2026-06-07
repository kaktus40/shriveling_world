import assert from 'node:assert/strict';
import test from 'node:test';
import {
	CITY_NED2ECEF_MATRIX_STRIDE,
	RAW_CONE_RIM_ECEF_STRIDE,
	UNUSED_INDEX,
	benchmarkConeIntersectionOracleCpu,
	computeConeIntersectionOracleCpu,
	intersectRayTriangleDoubleSided,
	type ConeIntersectionStaticInput,
	type RawConePrecompute,
} from '../../../src/lib/domain/precompute';

test('double-sided ray triangle intersection accepts both windings and rejects invalid distances', () => {
	const origin: [number, number, number] = [0, 0, 0];
	const direction: [number, number, number] = [1, 0, 0];
	const a: [number, number, number] = [5, -1, -1];
	const b: [number, number, number] = [5, 1, -1];
	const c: [number, number, number] = [5, 0, 1];

	assert.equal(intersectRayTriangleDoubleSided(origin, direction, a, b, c), 5);
	assert.equal(intersectRayTriangleDoubleSided(origin, direction, a, c, b), 5);
	assert.equal(intersectRayTriangleDoubleSided(origin, direction, a, b, c, 4), undefined);
	assert.equal(intersectRayTriangleDoubleSided(origin, [-1, 0, 0], a, b, c), undefined);
});

test('exhaustive cone oracle clips rays against every face of retained neighbors', () => {
	const staticInput = createStaticInput();
	const rawCones = createRawCones();
	const result = computeConeIntersectionOracleCpu(staticInput, rawCones);
	const expectedDistance = Math.sqrt(102) / 2;

	assert.equal(result.cityCount, 2);
	assert.equal(result.azimuthSampleCount, 4);
	assertClose(result.coneIntersectionDistanceMeters[0], expectedDistance);
	assert.equal(result.winningNeighborCityIndexes[0], 1);
	assert.equal(result.winningFaceIndexes[0], 0);
	assert.equal(result.testedFaceCounts[0], 4);
	assertClose(result.ciseledConeRimEcef[0], 5);
	assertClose(result.ciseledConeRimEcef[1], 0.5);
	assertClose(result.ciseledConeRimEcef[2], 0.5);
	assert.equal(result.ciseledConeRimEcef[3], 1);

	for (let rayIndex = 4; rayIndex < 8; rayIndex += 1) {
		assert.equal(result.winningNeighborCityIndexes[rayIndex], UNUSED_INDEX);
		assert.equal(result.winningFaceIndexes[rayIndex], UNUSED_INDEX);
		assert.equal(result.testedFaceCounts[rayIndex], 0);
	}
});

test('exhaustive cone oracle leaves a raw rim unchanged when no neighbor face intersects it', () => {
	const staticInput = createStaticInput();
	const rawCones = createRawCones();
	const result = computeConeIntersectionOracleCpu(staticInput, rawCones);
	const rayIndex = 1;
	const offset = rayIndex * RAW_CONE_RIM_ECEF_STRIDE;

	assert.equal(result.winningNeighborCityIndexes[rayIndex], UNUSED_INDEX);
	assert.equal(result.winningFaceIndexes[rayIndex], UNUSED_INDEX);
	assert.equal(result.testedFaceCounts[rayIndex], 4);
	assert.deepEqual(
		Array.from(result.ciseledConeRimEcef.slice(offset, offset + RAW_CONE_RIM_ECEF_STRIDE)),
		Array.from(rawCones.rawConeRimEcef.slice(offset, offset + RAW_CONE_RIM_ECEF_STRIDE)),
	);
});

test('exhaustive cone oracle rejects malformed shared buffer contracts', () => {
	const staticInput = createStaticInput();
	const rawCones = createRawCones();

	assert.throws(
		() => computeConeIntersectionOracleCpu({ ...staticInput, overlapCandidateCounts: new Uint32Array([2, 0]) }, rawCones),
		/neighborLimit/,
	);
	assert.throws(
		() => computeConeIntersectionOracleCpu({ ...staticInput, overlapCandidates: new Uint32Array([0, UNUSED_INDEX]) }, rawCones),
		/invalid neighbor/,
	);
	assert.throws(
		() => computeConeIntersectionOracleCpu(staticInput, { ...rawCones, rawConeRimEcef: new Float32Array(4) }),
		/rawConeRimEcef/,
	);
});

test('exhaustive cone oracle benchmark reports timing and tested face count', () => {
	let clockValue = 0;
	const report = benchmarkConeIntersectionOracleCpu(createStaticInput(), createRawCones(), {
		warmupIterations: 0,
		measurementIterations: 2,
		clock: () => clockValue++,
	});

	assert.equal(report.profile, 'cpu');
	assert.equal(report.testedFaceCount, 16);
	assert.equal(report.phases[0].phase, 'cone-intersection-exhaustive');
	assert.equal(report.phases[0].wallClock.medianMilliseconds, 1);
});

function createStaticInput(): ConeIntersectionStaticInput {
	const cityNed2EcefMatrices = new Float32Array(2 * CITY_NED2ECEF_MATRIX_STRIDE);
	for (let cityIndex = 0; cityIndex < 2; cityIndex += 1) {
		const offset = cityIndex * CITY_NED2ECEF_MATRIX_STRIDE;
		cityNed2EcefMatrices[offset] = 1;
		cityNed2EcefMatrices[offset + 5] = 1;
		cityNed2EcefMatrices[offset + 10] = 1;
		cityNed2EcefMatrices[offset + 15] = 1;
	}
	cityNed2EcefMatrices[CITY_NED2ECEF_MATRIX_STRIDE + 12] = 5;

	return {
		cityCount: 2,
		cityNed2EcefMatrices,
		neighborLimit: 1,
		overlapCandidates: new Uint32Array([1, UNUSED_INDEX]),
		overlapCandidateCounts: new Uint32Array([1, 0]),
	};
}

function createRawCones(): RawConePrecompute {
	const rimPoints = [
		[10, 1, 1, 1],
		[0, 10, 0, 1],
		[0, 0, 10, 1],
		[-10, 0, 0, 1],
		[5, 2, 0, 1],
		[5, 0, 2, 1],
		[5, -2, 0, 1],
		[5, 0, -2, 1],
	].flat();
	return {
		cityCount: 2,
		azimuthSampleCount: 4,
		shape: 'road',
		coneLengthMeters: 10,
		coneAlphaRadians: new Float32Array(8),
		rawConeRimEcef: new Float32Array(rimPoints),
	};
}

function assertClose(actual: number, expected: number, epsilon = 1e-5): void {
	assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}
