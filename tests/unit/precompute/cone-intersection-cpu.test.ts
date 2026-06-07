import assert from 'node:assert/strict';
import test from 'node:test';
import {
	CITY_NED2ECEF_MATRIX_STRIDE,
	RAW_CONE_RIM_ECEF_STRIDE,
	UNUSED_INDEX,
	benchmarkConeIntersectionOracleCpu,
	benchmarkConeIntersectionSymmetricOrderCpu,
	buildSymmetricFaceTraversal,
	computeConeIntersectionOracleCpu,
	computeConeIntersectionSymmetricOrderCpu,
	intersectRayTriangleDoubleSided,
	type ConeIntersectionStaticInput,
	type RawConePrecompute,
	type SymmetricConeIntersectionStaticInput,
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

test('symmetric face traversal starts at phiB0 and follows the shortest direction toward gammaBA', () => {
	assert.deepEqual(Array.from(buildSymmetricFaceTraversal(Math.PI, Math.PI * 1.25, 8)), [4, 5, 6, 7, 0, 1, 2, 3]);
	assert.deepEqual(Array.from(buildSymmetricFaceTraversal(Math.PI, Math.PI * 0.75, 8)), [4, 3, 2, 1, 0, 7, 6, 5]);
	assert.deepEqual(Array.from(buildSymmetricFaceTraversal(-Math.PI / 8, 0, 8)), [7, 0, 1, 2, 3, 4, 5, 6]);
});

test('symmetric-order intersection remains exhaustive and matches the oracle', () => {
	const staticInput = createStaticInput();
	const rawCones = createRawCones();
	const oracle = computeConeIntersectionOracleCpu(staticInput, rawCones);
	const ordered = computeConeIntersectionSymmetricOrderCpu(staticInput, rawCones);

	assert.deepEqual(ordered.coneIntersectionDistanceMeters, oracle.coneIntersectionDistanceMeters);
	assert.deepEqual(ordered.ciseledConeRimEcef, oracle.ciseledConeRimEcef);
	assert.deepEqual(ordered.winningNeighborCityIndexes, oracle.winningNeighborCityIndexes);
	assert.deepEqual(ordered.winningFaceIndexes, oracle.winningFaceIndexes);
	assert.deepEqual(ordered.testedFaceCounts, oracle.testedFaceCounts);
	assert.equal(ordered.winningFaceVisitOrders[0], 3);
	assert.equal(ordered.winningFaceVisitOrders[1], UNUSED_INDEX);
});

test('symmetric-order intersection keeps deterministic diagnostics on a shared cone summit', () => {
	const staticInput = createStaticInput();
	const rawCones = createRawCones();
	rawCones.rawConeRimEcef.set([10, 0, 0, 1], 0);
	const oracle = computeConeIntersectionOracleCpu(staticInput, rawCones);
	const ordered = computeConeIntersectionSymmetricOrderCpu(staticInput, rawCones);

	assert.equal(oracle.winningFaceIndexes[0], 0);
	assert.equal(ordered.winningFaceIndexes[0], 0);
	assert.deepEqual(ordered.coneIntersectionDistanceMeters, oracle.coneIntersectionDistanceMeters);
});

test('symmetric-order benchmark reports winning face discovery order', () => {
	let clockValue = 0;
	const report = benchmarkConeIntersectionSymmetricOrderCpu(createStaticInput(), createRawCones(), {
		warmupIterations: 0,
		measurementIterations: 2,
		clock: () => clockValue++,
	});

	assert.equal(report.testedFaceCount, 16);
	assert.deepEqual(report.winningFaceVisitOrder, { intersectionCount: 1, mean: 3, p95: 3, max: 3 });
	assert.equal(report.phases[0].phase, 'cone-intersection-symmetric-order');
	assert.equal(report.phases[0].wallClock.medianMilliseconds, 1);
});

function createStaticInput(): SymmetricConeIntersectionStaticInput {
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
		sectorCount: 4,
		cityPairInvariants: new Float32Array([
			0, 0, 0, 0,
			0, Math.PI, 1, 0,
			Math.PI, 0, 1, 0,
			0, 0, 0, 0,
		]),
		cityPairSectorIndexes: new Uint32Array(4),
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
