import assert from 'node:assert/strict';
import test from 'node:test';
import {
	CITY_NED2ECEF_MATRIX_STRIDE,
	CITY_PAIR_INVARIANT_STRIDE,
	CityInvariantView,
	CityPairInvariantView,
	CpuStaticTownInvariantBackend,
	computeAzimuthSectorIndex,
	computeStaticTownInvariantsCpu,
	benchmarkStaticTownInvariantsCpu,
	getComputeProfileFallbackChain,
	getCityPairIndex,
	summarizeBenchmarkSamples,
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
	const result = await backend.compute({ cityLonLatRadians: new Float32Array([0, 0]) }, { sectorCount: 4 });
	assert.equal(backend.profile, 'cpu');
	assert.equal(result.cityCount, 1);
});

test('CPU benchmark reports every implemented phase and total execution', () => {
	let clockValue = 0;
	const report = benchmarkStaticTownInvariantsCpu(
		{ cityLonLatRadians: new Float32Array([0, 0, 1, 0]) },
		{ sectorCount: 4 },
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
		['city-invariants', 'city-pair-invariants', 'total'],
	);
	for (const phase of report.phases) {
		assert.equal(phase.wallClock.medianMilliseconds, 1);
		assert.equal(phase.device, undefined);
	}
});

test('benchmark statistics expose median and p95 without imposing machine thresholds', () => {
	assert.deepEqual(summarizeBenchmarkSamples([10, 1, 5, 2]), {
		minMilliseconds: 1,
		medianMilliseconds: 2,
		p95Milliseconds: 10,
		maxMilliseconds: 10,
	});
});
