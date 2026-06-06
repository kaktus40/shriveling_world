import { FLOAT32_ANGULAR_EPSILON_RADIANS, TWO_PI } from '../../shared';
import {
	CITY_NED2ECEF_MATRIX_STRIDE,
	type ConeAlphaSampleBuffers,
	type DynamicTownPrecompute,
	type RawConePrecompute,
	type RawConePrecomputeOptions,
	type StaticTownPrecompute,
} from './types';

/** Number of float values used by one aligned raw cone ECEF rim point. */
export const RAW_CONE_RIM_ECEF_STRIDE = 4;

/**
 * Computes the directional alpha selected for every city and azimuth sample.
 *
 * Complex cones reproduce the intended historical `rawCones.frag` law:
 * nearest lower and upper directional links are selected circularly; a side
 * farther than `attenuationRadians` is replaced by Road alpha; smoothstep
 * interpolates between both sides.
 */
export function computeConeAlphaSamplesCpu(
	dynamicTown: DynamicTownPrecompute,
	options: Pick<RawConePrecomputeOptions, 'shape' | 'azimuthSampleCount' | 'attenuationRadians'>,
): ConeAlphaSampleBuffers {
	validateAlphaOptions(dynamicTown, options);
	const cityCount = dynamicTown.cityLinkCounts.length;
	const coneAlphaRadians = new Float32Array(cityCount * options.azimuthSampleCount);

	for (let cityIndex = 0; cityIndex < cityCount; cityIndex += 1) {
		for (let sampleIndex = 0; sampleIndex < options.azimuthSampleCount; sampleIndex += 1) {
			const azimuthRadians = (sampleIndex * TWO_PI) / options.azimuthSampleCount;
			const alphaOffset = cityIndex * options.azimuthSampleCount + sampleIndex;
			coneAlphaRadians[alphaOffset] = selectConeAlpha(dynamicTown, cityIndex, azimuthRadians, options);
		}
	}

	return { cityCount, azimuthSampleCount: options.azimuthSampleCount, coneAlphaRadians };
}

/**
 * Generates raw non-intersected cone rims using the CPU reference profile.
 *
 * Each local NED ray is transformed by the city's shared NED-to-ECEF matrix.
 * The city summit remains available in that matrix and is not duplicated in
 * the rim buffer.
 */
export function computeRawConePrecomputeCpu(
	staticTown: StaticTownPrecompute,
	dynamicTown: DynamicTownPrecompute,
	options: RawConePrecomputeOptions,
): RawConePrecompute {
	if (staticTown.cityCount !== dynamicTown.cityLinkCounts.length) {
		throw new RangeError('static and dynamic city counts must match');
	}
	if (!Number.isFinite(options.coneLengthMeters) || options.coneLengthMeters <= 0) {
		throw new RangeError('coneLengthMeters must be finite and strictly positive');
	}

	const alphaSamples = computeConeAlphaSamplesCpu(dynamicTown, options);
	const rawConeRimEcef = new Float32Array(
		alphaSamples.cityCount * alphaSamples.azimuthSampleCount * RAW_CONE_RIM_ECEF_STRIDE,
	);

	for (let cityIndex = 0; cityIndex < alphaSamples.cityCount; cityIndex += 1) {
		const matrixOffset = cityIndex * CITY_NED2ECEF_MATRIX_STRIDE;
		for (let sampleIndex = 0; sampleIndex < alphaSamples.azimuthSampleCount; sampleIndex += 1) {
			const sampleOffset = cityIndex * alphaSamples.azimuthSampleCount + sampleIndex;
			const alphaRadians = alphaSamples.coneAlphaRadians[sampleOffset];
			const azimuthRadians = (sampleIndex * TWO_PI) / alphaSamples.azimuthSampleCount;
			const horizontalLength = options.coneLengthMeters * Math.cos(alphaRadians);
			const northMeters = horizontalLength * Math.cos(azimuthRadians);
			const eastMeters = horizontalLength * Math.sin(azimuthRadians);
			const downMeters = options.coneLengthMeters * Math.sin(alphaRadians);
			const outputOffset = sampleOffset * RAW_CONE_RIM_ECEF_STRIDE;

			rawConeRimEcef[outputOffset] =
				staticTown.cityNed2EcefMatrices[matrixOffset] * northMeters +
				staticTown.cityNed2EcefMatrices[matrixOffset + 4] * eastMeters +
				staticTown.cityNed2EcefMatrices[matrixOffset + 8] * downMeters +
				staticTown.cityNed2EcefMatrices[matrixOffset + 12];
			rawConeRimEcef[outputOffset + 1] =
				staticTown.cityNed2EcefMatrices[matrixOffset + 1] * northMeters +
				staticTown.cityNed2EcefMatrices[matrixOffset + 5] * eastMeters +
				staticTown.cityNed2EcefMatrices[matrixOffset + 9] * downMeters +
				staticTown.cityNed2EcefMatrices[matrixOffset + 13];
			rawConeRimEcef[outputOffset + 2] =
				staticTown.cityNed2EcefMatrices[matrixOffset + 2] * northMeters +
				staticTown.cityNed2EcefMatrices[matrixOffset + 6] * eastMeters +
				staticTown.cityNed2EcefMatrices[matrixOffset + 10] * downMeters +
				staticTown.cityNed2EcefMatrices[matrixOffset + 14];
			rawConeRimEcef[outputOffset + 3] = 1;
		}
	}

	return { ...alphaSamples, shape: options.shape, coneLengthMeters: options.coneLengthMeters, rawConeRimEcef };
}

function selectConeAlpha(
	dynamicTown: DynamicTownPrecompute,
	cityIndex: number,
	azimuthRadians: number,
	options: Pick<RawConePrecomputeOptions, 'shape' | 'attenuationRadians'>,
): number {
	if (options.shape === 'road') {
		return dynamicTown.roadAlphaRadians;
	}
	if (options.shape === 'fastest-terrestrial') {
		return dynamicTown.cityFastestTerrestrialAlphaRadians[cityIndex];
	}

	const offset = dynamicTown.cityLinkOffsets[cityIndex];
	const count = dynamicTown.cityLinkCounts[cityIndex];
	if (count === 0) {
		return dynamicTown.roadAlphaRadians;
	}
	const attenuationRadians = options.attenuationRadians as number;
	let lowerDistance = Infinity;
	let upperDistance = Infinity;
	let lowerAlpha = dynamicTown.roadAlphaRadians;
	let upperAlpha = dynamicTown.roadAlphaRadians;

	for (let localIndex = 0; localIndex < count; localIndex += 1) {
		const linkIndex = offset + localIndex;
		const linkAzimuth = dynamicTown.cityLinkAzimuthRadians[linkIndex];
		const candidateLowerDistance = positiveAngle(azimuthRadians - linkAzimuth);
		const candidateUpperDistance = positiveAngle(linkAzimuth - azimuthRadians);
		if (
			candidateLowerDistance < lowerDistance - FLOAT32_ANGULAR_EPSILON_RADIANS ||
			(Math.abs(candidateLowerDistance - lowerDistance) <= FLOAT32_ANGULAR_EPSILON_RADIANS &&
				dynamicTown.cityLinkAlphaRadians[linkIndex] < lowerAlpha)
		) {
			lowerDistance = candidateLowerDistance;
			lowerAlpha = dynamicTown.cityLinkAlphaRadians[linkIndex];
		}
		if (
			candidateUpperDistance < upperDistance - FLOAT32_ANGULAR_EPSILON_RADIANS ||
			(Math.abs(candidateUpperDistance - upperDistance) <= FLOAT32_ANGULAR_EPSILON_RADIANS &&
				dynamicTown.cityLinkAlphaRadians[linkIndex] < upperAlpha)
		) {
			upperDistance = candidateUpperDistance;
			upperAlpha = dynamicTown.cityLinkAlphaRadians[linkIndex];
		}
	}

	if (lowerDistance > attenuationRadians + FLOAT32_ANGULAR_EPSILON_RADIANS) {
		lowerDistance = attenuationRadians;
		lowerAlpha = dynamicTown.roadAlphaRadians;
	} else {
		lowerDistance = Math.min(lowerDistance, attenuationRadians);
	}
	if (upperDistance > attenuationRadians + FLOAT32_ANGULAR_EPSILON_RADIANS) {
		upperDistance = attenuationRadians;
		upperAlpha = dynamicTown.roadAlphaRadians;
	} else {
		upperDistance = Math.min(upperDistance, attenuationRadians);
	}
	const span = lowerDistance + upperDistance;
	const interpolation = span === 0 ? 0 : smoothstep(0, span, lowerDistance);
	return lowerAlpha + interpolation * (upperAlpha - lowerAlpha);
}

function positiveAngle(angleRadians: number): number {
	const remainder = angleRadians % TWO_PI;
	return remainder < 0 ? remainder + TWO_PI : remainder;
}

function smoothstep(minimum: number, maximum: number, value: number): number {
	if (minimum === maximum) {
		return value < minimum ? 0 : 1;
	}
	const ratio = Math.min(1, Math.max(0, (value - minimum) / (maximum - minimum)));
	return ratio * ratio * (3 - 2 * ratio);
}

function validateAlphaOptions(
	dynamicTown: DynamicTownPrecompute,
	options: Pick<RawConePrecomputeOptions, 'shape' | 'azimuthSampleCount' | 'attenuationRadians'>,
): void {
	if (!['road', 'fastest-terrestrial', 'complex'].includes(options.shape)) {
		throw new RangeError('shape must be road, fastest-terrestrial, or complex');
	}
	if (!Number.isSafeInteger(options.azimuthSampleCount) || options.azimuthSampleCount < 3) {
		throw new RangeError('azimuthSampleCount must be a safe integer greater than or equal to 3');
	}
	if (options.shape === 'complex') {
		if (
			!Number.isFinite(options.attenuationRadians) ||
			(options.attenuationRadians as number) <= 0 ||
			(options.attenuationRadians as number) > TWO_PI
		) {
			throw new RangeError('attenuationRadians must belong to ]0, 2 PI] for complex cones');
		}
	}
	const cityCount = dynamicTown.cityLinkCounts.length;
	if (
		dynamicTown.cityLinkOffsets.length !== cityCount ||
		dynamicTown.cityFastestTerrestrialAlphaRadians.length !== cityCount ||
		dynamicTown.cityLinkAzimuthRadians.length !== dynamicTown.cityLinkAlphaRadians.length
	) {
		throw new RangeError('dynamic-town buffers are inconsistent');
	}
	const linkCount = dynamicTown.cityLinkAzimuthRadians.length;
	for (let cityIndex = 0; cityIndex < cityCount; cityIndex += 1) {
		const offset = dynamicTown.cityLinkOffsets[cityIndex];
		const count = dynamicTown.cityLinkCounts[cityIndex];
		if (offset > linkCount || count > linkCount - offset) {
			throw new RangeError('dynamic-town city link ranges are inconsistent');
		}
	}
}
