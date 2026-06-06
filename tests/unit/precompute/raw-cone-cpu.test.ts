import assert from 'node:assert/strict';
import test from 'node:test';
import {
	RAW_CONE_RIM_ECEF_STRIDE,
	RawConeRimView,
	benchmarkRawConePrecomputeCpu,
	computeConeAlphaSamplesCpu,
	computeRawConePrecomputeCpu,
	computeStaticTownPrecomputeCpu,
	type DynamicTownPrecompute,
} from '../../../src/lib/domain/precompute';
import { EARTH_RADIUS_METERS, PI } from '../../../src/lib/shared';

const FAST_ALPHA = 0.4;
const ROAD_ALPHA = 1.2;

function dynamicTownWithOneLink(): DynamicTownPrecompute {
	return {
		year: 2000,
		roadAlphaRadians: ROAD_ALPHA,
		cityLinkOffsets: new Uint32Array([0, 1]),
		cityLinkCounts: new Uint32Array([1, 0]),
		cityLinkDestinationIndexes: new Uint32Array([1]),
		cityLinkAzimuthRadians: new Float32Array([0]),
		cityLinkAlphaRadians: new Float32Array([FAST_ALPHA]),
		cityFastestTerrestrialAlphaRadians: new Float32Array([FAST_ALPHA, ROAD_ALPHA]),
	};
}

test('raw cone alpha samples support Road and fastest-terrestrial variants', () => {
	const dynamicTown = dynamicTownWithOneLink();
	const road = computeConeAlphaSamplesCpu(dynamicTown, { shape: 'road', azimuthSampleCount: 4 });
	const fastest = computeConeAlphaSamplesCpu(dynamicTown, { shape: 'fastest-terrestrial', azimuthSampleCount: 4 });

	assertArrayClose(Array.from(road.coneAlphaRadians), Array(8).fill(ROAD_ALPHA));
	assertArrayClose(Array.from(fastest.coneAlphaRadians.slice(0, 4)), Array(4).fill(FAST_ALPHA));
	assertArrayClose(Array.from(fastest.coneAlphaRadians.slice(4)), Array(4).fill(ROAD_ALPHA));
});

test('complex raw cone alpha is exact on a link and returns to Road outside attenuation influence', () => {
	const dynamicTown = dynamicTownWithOneLink();
	const complex = computeConeAlphaSamplesCpu(dynamicTown, {
		shape: 'complex',
		azimuthSampleCount: 16,
		attenuationRadians: PI / 8,
	});

	assertClose(complex.coneAlphaRadians[0], FAST_ALPHA);
	assert.ok(complex.coneAlphaRadians[1] > FAST_ALPHA);
	assert.ok(complex.coneAlphaRadians[1] < ROAD_ALPHA);
	assertClose(complex.coneAlphaRadians[2], ROAD_ALPHA);
	assertClose(complex.coneAlphaRadians[8], ROAD_ALPHA);
	assertClose(complex.coneAlphaRadians[15], complex.coneAlphaRadians[1]);
	assertArrayClose(Array.from(complex.coneAlphaRadians.slice(16)), Array(16).fill(ROAD_ALPHA));
});

test('complex raw cone uses circular lower and upper links with smooth interpolation', () => {
	const dynamicTown: DynamicTownPrecompute = {
		...dynamicTownWithOneLink(),
		cityLinkOffsets: new Uint32Array([0, 2]),
		cityLinkCounts: new Uint32Array([2, 0]),
		cityLinkDestinationIndexes: new Uint32Array([1, 1]),
		cityLinkAzimuthRadians: new Float32Array([0, PI]),
		cityLinkAlphaRadians: new Float32Array([0.2, 0.6]),
	};
	const complex = computeConeAlphaSamplesCpu(dynamicTown, {
		shape: 'complex',
		azimuthSampleCount: 4,
		attenuationRadians: PI,
	});

	assertClose(complex.coneAlphaRadians[0], 0.2);
	assertClose(complex.coneAlphaRadians[1], 0.4);
	assertClose(complex.coneAlphaRadians[2], 0.6);
	assertClose(complex.coneAlphaRadians[3], 0.4);
});

test('complex raw cone retains the minimum alpha when distinct links share one direction', () => {
	const dynamicTown: DynamicTownPrecompute = {
		...dynamicTownWithOneLink(),
		cityLinkOffsets: new Uint32Array([0, 2]),
		cityLinkCounts: new Uint32Array([2, 0]),
		cityLinkDestinationIndexes: new Uint32Array([1, 2]),
		cityLinkAzimuthRadians: new Float32Array([0, 0]),
		cityLinkAlphaRadians: new Float32Array([0.7, 0.2]),
	};
	const complex = computeConeAlphaSamplesCpu(dynamicTown, {
		shape: 'complex',
		azimuthSampleCount: 4,
		attenuationRadians: PI / 4,
	});

	assertClose(complex.coneAlphaRadians[0], 0.2);
});

test('raw cone CPU transforms local NED rays into aligned ECEF rim points in meters', () => {
	const staticTown = computeStaticTownPrecomputeCpu(
		{ cityLonLatRadians: new Float32Array([0, 0, PI / 2, 0]) },
		{ sectorCount: 4, neighborLimit: 1 },
	);
	const result = computeRawConePrecomputeCpu(staticTown, dynamicTownWithOneLink(), {
		shape: 'road',
		azimuthSampleCount: 4,
		coneLengthMeters: 1000,
	});

	assert.equal(result.rawConeRimEcef.length, 2 * 4 * RAW_CONE_RIM_ECEF_STRIDE);
	assert.ok(Array.from(result.rawConeRimEcef).filter((_, index) => index % 4 === 3).every((value) => value === 1));

	const expectedNorth = 1000 * Math.cos(ROAD_ALPHA);
	const expectedDown = 1000 * Math.sin(ROAD_ALPHA);
	assertClose(result.rawConeRimEcef[0], EARTH_RADIUS_METERS - expectedDown, 1);
	assertClose(result.rawConeRimEcef[1], 0, 1);
	assertClose(result.rawConeRimEcef[2], expectedNorth, 1);
	const view = new RawConeRimView(result, 0, 0);
	assertClose(view.alphaRadians, ROAD_ALPHA);
	assertClose(view.ecefMeters[0], EARTH_RADIUS_METERS - expectedDown, 1);
});

test('raw cone CPU benchmark measures directional alpha selection and complete geometry', () => {
	const staticTown = computeStaticTownPrecomputeCpu(
		{ cityLonLatRadians: new Float32Array([0, 0, PI / 2, 0]) },
		{ sectorCount: 4, neighborLimit: 1 },
	);
	let clockValue = 0;
	const report = benchmarkRawConePrecomputeCpu(
		staticTown,
		dynamicTownWithOneLink(),
		{ shape: 'complex', azimuthSampleCount: 8, attenuationRadians: PI / 8, coneLengthMeters: 1000 },
		{ warmupIterations: 0, measurementIterations: 2, clock: () => clockValue++ },
	);

	assert.deepEqual(report.phases.map(({ phase }) => phase), ['raw-cone-alphas', 'raw-cone-total']);
	assert.ok(report.phases.every(({ wallClock }) => wallClock.medianMilliseconds === 1));
});

test('raw cone CPU rejects invalid sampling, attenuation, length, and mismatched cities', () => {
	const dynamicTown = dynamicTownWithOneLink();
	const staticTown = computeStaticTownPrecomputeCpu(
		{ cityLonLatRadians: new Float32Array([0, 0]) },
		{ sectorCount: 4, neighborLimit: 0 },
	);

	assert.throws(() => computeConeAlphaSamplesCpu(dynamicTown, { shape: 'road', azimuthSampleCount: 2 }), /azimuthSampleCount/);
	assert.throws(
		() => computeConeAlphaSamplesCpu(dynamicTown, { shape: 'invalid' as 'road', azimuthSampleCount: 4 }),
		/shape/,
	);
	assert.throws(
		() => computeConeAlphaSamplesCpu(dynamicTown, { shape: 'complex', azimuthSampleCount: 4 }),
		/attenuationRadians/,
	);
	assert.throws(
		() => computeRawConePrecomputeCpu(staticTown, dynamicTown, { shape: 'road', azimuthSampleCount: 4, coneLengthMeters: 0 }),
		/city counts/,
	);
	assert.throws(
		() =>
			computeRawConePrecomputeCpu(
				computeStaticTownPrecomputeCpu(
					{ cityLonLatRadians: new Float32Array([0, 0, PI / 2, 0]) },
					{ sectorCount: 4, neighborLimit: 1 },
				),
				dynamicTown,
				{ shape: 'road', azimuthSampleCount: 4, coneLengthMeters: 0 },
			),
		/coneLengthMeters/,
	);
	assert.throws(
		() =>
			computeConeAlphaSamplesCpu(
				{ ...dynamicTown, cityLinkCounts: new Uint32Array([2, 0]) },
				{ shape: 'road', azimuthSampleCount: 4 },
			),
		/link ranges/,
	);
});

function assertArrayClose(actual: number[], expected: number[], epsilon = 1e-6): void {
	assert.equal(actual.length, expected.length);
	actual.forEach((value, index) => assertClose(value, expected[index], epsilon));
}

function assertClose(actual: number, expected: number, epsilon = 1e-6): void {
	assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}
