import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
	CITY_NED2ECEF_MATRIX_STRIDE,
	CITY_PAIR_INVARIANT_STRIDE,
	CURVE_CONTROL_POINT_STRIDE,
	UNUSED_INDEX,
	CityInvariantView,
	CityPairInvariantView,
	CurveControlView,
	OverlapCandidateView,
	CpuStaticTownInvariantBackend,
	computeAzimuthSectorIndex,
	buildCurveEdgePairsCpu,
	computeCurveControlPointsCpu,
	computeCityInvariantsCpu,
	computeStaticTownInvariantsCpu,
	computeStaticTownPrecomputeCpu,
	benchmarkStaticTownInvariantsCpu,
	getComputeProfileFallbackChain,
	getCityPairIndex,
	selectOverlapCandidatesCpu,
	summarizeBenchmarkSamples,
	type CityPairInvariantBuffers,
} from '../../../src/lib/domain/precompute';
import { EARTH_RADIUS_METERS, PI, TWO_PI } from '../../../src/lib/shared';
import { degreesToRadians } from '../../../src/lib/domain/geojson';

const EPSILON = 1e-5;

function assertClose(actual: number, expected: number, epsilon = EPSILON): void {
	assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}

test('computeStaticTownInvariantsCpu preserves city order and buffer contracts', () => {
	const result = computeStaticTownInvariantsCpu(
		{
			cityLonLatRadians: new Float32Array([
				degreesToRadians(0),
				degreesToRadians(0),
				degreesToRadians(90),
				degreesToRadians(0),
			]),
		},
		{ sectorCount: 4 },
	);

	assert.equal(result.cityCount, 2);
	assert.equal(result.cityNed2EcefMatrices.length, 2 * CITY_NED2ECEF_MATRIX_STRIDE);
	assert.equal(result.cityPairInvariants.length, 4 * CITY_PAIR_INVARIANT_STRIDE);
	assert.equal(result.cityPairSectorIndexes.length, 4);

	const cityA = new CityInvariantView(result, 0);
	const cityB = new CityInvariantView(result, 1);
	assertClose(cityA.ecefMeters[0], EARTH_RADIUS_METERS, 1);
	assertClose(cityB.ecefMeters[1], EARTH_RADIUS_METERS, 1);
});

test('ordered pair invariants contain forward and reverse bearings, distance, and sector', () => {
	const result = computeStaticTownInvariantsCpu(
		{
			cityLonLatRadians: new Float32Array([
				0, 0,
				degreesToRadians(90), 0,
			]),
		},
		{ sectorCount: 4 },
	);

	const eastbound = new CityPairInvariantView(result, 0, 1);
	const westbound = new CityPairInvariantView(result, 1, 0);

	assertClose(eastbound.forwardAzimuthRadians, PI / 2);
	assertClose(eastbound.reverseAzimuthRadians, (3 * PI) / 2);
	assertClose(eastbound.angularDistanceRadians, PI / 2);
	assert.equal(eastbound.sectorIndex, 1);

	assertClose(westbound.forwardAzimuthRadians, (3 * PI) / 2);
	assertClose(westbound.reverseAzimuthRadians, PI / 2);
	assertClose(westbound.angularDistanceRadians, PI / 2);
	assert.equal(westbound.sectorIndex, 3);
});

test('diagonal pairs remain directly addressable and zero-filled', () => {
	const result = computeStaticTownInvariantsCpu(
		{ cityLonLatRadians: new Float32Array([0, 0, 1, 0]) },
		{ sectorCount: 8 },
	);
	const diagonal = new CityPairInvariantView(result, 1, 1);

	assert.equal(diagonal.pairIndex, getCityPairIndex(1, 1, 2));
	assert.equal(diagonal.forwardAzimuthRadians, 0);
	assert.equal(diagonal.reverseAzimuthRadians, 0);
	assert.equal(diagonal.angularDistanceRadians, 0);
	assert.equal(diagonal.sectorIndex, 0);
});

test('computeAzimuthSectorIndex classifies exact boundaries deterministically', () => {
	assert.equal(computeAzimuthSectorIndex(0, 4), 0);
	assert.equal(computeAzimuthSectorIndex(PI / 2, 4), 1);
	assert.equal(computeAzimuthSectorIndex(PI, 4), 2);
	assert.equal(computeAzimuthSectorIndex((3 * PI) / 2, 4), 3);
	assert.equal(computeAzimuthSectorIndex(TWO_PI - 1e-12, 4), 3);
});

test('CPU invariant computation rejects malformed inputs', () => {
	assert.throws(
		() => computeStaticTownInvariantsCpu({ cityLonLatRadians: new Float32Array([0]) }, { sectorCount: 4 }),
		/multiple of 2/,
	);
	assert.throws(
		() => computeStaticTownInvariantsCpu({ cityLonLatRadians: new Float32Array([0, PI]) }, { sectorCount: 4 }),
		/latitude/,
	);
	assert.throws(
		() => computeStaticTownInvariantsCpu({ cityLonLatRadians: new Float32Array([0, 0]) }, { sectorCount: 0 }),
		/sectorCount/,
	);
});

test('compute profiles follow WebGPU, WebGL2, then CPU fallback order', async () => {
	assert.deepEqual(getComputeProfileFallbackChain(), ['webgpu', 'webgl2', 'cpu']);
	assert.deepEqual(getComputeProfileFallbackChain('webgl2'), ['webgl2', 'cpu']);
	assert.deepEqual(getComputeProfileFallbackChain('cpu'), ['cpu']);

	const backend = new CpuStaticTownInvariantBackend();
	const result = await backend.compute(
		{ cityLonLatRadians: new Float32Array([0, 0]) },
		{ sectorCount: 4, neighborLimit: 100 },
	);
	assert.equal(backend.profile, 'cpu');
	assert.equal(result.cityCount, 1);
	assert.equal(result.neighborLimit, 0);
});

test('CPU benchmark reports every implemented phase and total execution', () => {
	let clockValue = 0;
	const report = benchmarkStaticTownInvariantsCpu(
		{ cityLonLatRadians: new Float32Array([0, 0, 1, 0]) },
		{ sectorCount: 4, neighborLimit: 1 },
		{
			warmupIterations: 0,
			measurementIterations: 3,
			clock: () => clockValue++,
		},
	);

	assert.equal(report.profile, 'cpu');
	assert.equal(report.measurementIterations, 3);
	assert.deepEqual(
		report.phases.map(({ phase }) => phase),
		['city-invariants', 'city-pair-invariants', 'overlap-reduction', 'curve-controls', 'total'],
	);
	for (const phase of report.phases) {
		assert.equal(phase.wallClock.medianMilliseconds, 1);
		assert.equal(phase.device, undefined);
	}
});

test('overlap reduction redistributes quotas from empty and sparse sectors', () => {
	const pairInvariants = createPairInvariantFixture(6, 4, [
		{ from: 0, to: 1, azimuth: 0.1, distance: 0.1, sector: 0 },
		{ from: 0, to: 2, azimuth: 0.2, distance: 0.2, sector: 0 },
		{ from: 0, to: 3, azimuth: 0.3, distance: 0.3, sector: 0 },
		{ from: 0, to: 4, azimuth: 2, distance: 0.4, sector: 1 },
		{ from: 0, to: 5, azimuth: 5, distance: 0.5, sector: 3 },
	]);

	const result = selectOverlapCandidatesCpu(pairInvariants, 4);

	assert.equal(result.neighborLimit, 4);
	assert.equal(result.overlapCandidateCounts[0], 4);
	assert.deepEqual(Array.from(result.overlapCandidates.slice(0, 4)), [1, 2, 4, 5]);
});

test('overlap reduction keeps the nearest candidates per sector then orders by azimuth', () => {
	const pairInvariants = createPairInvariantFixture(5, 2, [
		{ from: 0, to: 1, azimuth: 0.8, distance: 0.4, sector: 0 },
		{ from: 0, to: 2, azimuth: 0.2, distance: 0.1, sector: 0 },
		{ from: 0, to: 3, azimuth: 4.5, distance: 0.2, sector: 1 },
		{ from: 0, to: 4, azimuth: 4, distance: 0.3, sector: 1 },
	]);

	const result = selectOverlapCandidatesCpu(pairInvariants, 2);

	assert.deepEqual(Array.from(result.overlapCandidates.slice(0, 2)), [2, 3]);
});

test('overlap reduction caps neighborLimit to available non-diagonal cities', () => {
	const result = computeStaticTownPrecomputeCpu(
		{ cityLonLatRadians: new Float32Array([0, 0, 1, 0]) },
		{ sectorCount: 4, neighborLimit: 100 },
	);

	assert.equal(result.neighborLimit, 1);
	assert.deepEqual(Array.from(result.overlapCandidateCounts), [1, 1]);
	assert.ok(Array.from(result.overlapCandidates).every((index) => index !== UNUSED_INDEX));
});

test('overlap candidate views resolve non-duplicated pair invariants', () => {
	const result = computeStaticTownPrecomputeCpu(
		{ cityLonLatRadians: new Float32Array([0, 0, degreesToRadians(90), 0]) },
		{ sectorCount: 4, neighborLimit: 1 },
	);
	const overlap = new OverlapCandidateView(result, result, 0, 0);

	assert.equal(overlap.cityIndex, 0);
	assert.equal(overlap.neighborCityIndex, 1);
	assertClose(overlap.forwardAzimuthRadians, PI / 2);
	assertClose(overlap.reverseAzimuthRadians, (3 * PI) / 2);
	assertClose(overlap.halfAngularDistanceRadians, PI / 4);
});

test('curve edge pairs preserve prepared edge order and duplicates', () => {
	const pairs = buildCurveEdgePairsCpu(
		[
			{ originCityIndex: 2, destinationCityIndex: 0 },
			{ originCityIndex: 0, destinationCityIndex: 1 },
			{ originCityIndex: 0, destinationCityIndex: 1 },
		],
		3,
	);

	assert.deepEqual(Array.from(pairs), [2, 0, 0, 1, 0, 1]);
});

test('curve controls produce aligned quarter points A P Q B in ECEF meters', () => {
	const cityInvariants = computeCityInvariantsCpu({
		cityLonLatRadians: new Float32Array([0, 0, degreesToRadians(90), 0]),
	});
	const curves = computeCurveControlPointsCpu(cityInvariants, new Uint32Array([0, 1]));
	const curve = new CurveControlView(curves, 0);

	assert.equal(curves.curveControlPointsEcef.length, CURVE_CONTROL_POINT_STRIDE);
	assert.deepEqual(Array.from(curves.curveControlPointsEcef.filter((_, index) => index % 4 === 3)), [1, 1, 1, 1]);
	assert.equal(curve.originCityIndex, 0);
	assert.equal(curve.destinationCityIndex, 1);
	assertClose(Math.atan2(curve.pointAEcefMeters[1], curve.pointAEcefMeters[0]), 0);
	assertClose(Math.atan2(curve.pointPEcefMeters[1], curve.pointPEcefMeters[0]), PI / 8);
	assertClose(Math.atan2(curve.pointQEcefMeters[1], curve.pointQEcefMeters[0]), (3 * PI) / 8);
	assertClose(Math.atan2(curve.pointBEcefMeters[1], curve.pointBEcefMeters[0]), PI / 2);
});

test('complete CPU static precompute includes controls only for known curve edges', () => {
	const result = computeStaticTownPrecomputeCpu(
		{
			cityLonLatRadians: new Float32Array([0, 0, degreesToRadians(45), 0, degreesToRadians(90), 0]),
			curveEdgePairs: new Uint32Array([0, 2]),
		},
		{ sectorCount: 4, neighborLimit: 2 },
	);

	assert.deepEqual(Array.from(result.curveEdgePairs), [0, 2]);
	assert.equal(result.curveControlPointsEcef.length, CURVE_CONTROL_POINT_STRIDE);
});

test('curve controls reject invalid, diagonal, and antipodal edges', () => {
	assert.throws(() => buildCurveEdgePairsCpu([{ originCityIndex: 0, destinationCityIndex: 0 }], 1), /distinct/);

	const cityInvariants = computeCityInvariantsCpu({
		cityLonLatRadians: new Float32Array([0, 0, PI, 0]),
	});
	assert.throws(() => computeCurveControlPointsCpu(cityInvariants, new Uint32Array([0, 2])), /valid city index/);
	assert.throws(() => computeCurveControlPointsCpu(cityInvariants, new Uint32Array([0, 0])), /distinct/);
	assert.throws(() => computeCurveControlPointsCpu(cityInvariants, new Uint32Array([0, 1])), /antipodal/);
});

test('benchmark statistics expose median and p95 without imposing machine thresholds', () => {
	assert.deepEqual(summarizeBenchmarkSamples([10, 1, 5, 2]), {
		minMilliseconds: 1,
		medianMilliseconds: 2,
		p95Milliseconds: 10,
		maxMilliseconds: 10,
	});
});

interface PairFixtureValue {
	from: number;
	to: number;
	azimuth: number;
	distance: number;
	sector: number;
}

function createPairInvariantFixture(
	cityCount: number,
	sectorCount: number,
	values: PairFixtureValue[],
): CityPairInvariantBuffers {
	const cityPairInvariants = new Float32Array(cityCount * cityCount * CITY_PAIR_INVARIANT_STRIDE);
	const cityPairSectorIndexes = new Uint32Array(cityCount * cityCount);
	for (const value of values) {
		const pairIndex = value.from * cityCount + value.to;
		const offset = pairIndex * CITY_PAIR_INVARIANT_STRIDE;
		cityPairInvariants[offset] = value.azimuth;
		cityPairInvariants[offset + 2] = value.distance;
		cityPairSectorIndexes[pairIndex] = value.sector;
	}
	return { cityCount, sectorCount, cityPairInvariants, cityPairSectorIndexes };
}
