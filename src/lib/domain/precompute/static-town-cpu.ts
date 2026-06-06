import { TWO_PI } from '../../shared/constants';
import {
	angularDistanceRadians,
	buildNed2EcefMatrix,
	initialBearingRadians,
	readMatrixColumn3,
	readNVectorFromNed2Ecef,
} from '../../shared/spherical';
import {
	CITY_LON_LAT_STRIDE,
	CITY_NED2ECEF_MATRIX_STRIDE,
	CITY_PAIR_INVARIANT_STRIDE,
	type CityInvariantBuffers,
	type CityPairInvariantBuffers,
	type CityPairPrecomputeOptions,
	type StaticCityInput,
	type StaticTownInvariantPrecompute,
	type StaticTownPrecompute,
	type StaticTownPrecomputeOptions,
} from './types';
import { selectOverlapCandidatesCpu } from './overlap-cpu';

/** Returns the dense index of an ordered pair `(cityAIndex, cityBIndex)`. */
export function getCityPairIndex(cityAIndex: number, cityBIndex: number, cityCount: number): number {
	assertIntegerInRange(cityAIndex, cityCount, 'cityAIndex');
	assertIntegerInRange(cityBIndex, cityCount, 'cityBIndex');
	return cityAIndex * cityCount + cityBIndex;
}

/**
 * Computes one equal-width azimuth sector index.
 *
 * @param forwardAzimuthRadians - Normalized azimuth in `[0, 2 PI)`.
 * @param sectorCount - Strictly positive number of sectors.
 */
export function computeAzimuthSectorIndex(forwardAzimuthRadians: number, sectorCount: number): number {
	assertSectorCount(sectorCount);
	if (!Number.isFinite(forwardAzimuthRadians) || forwardAzimuthRadians < 0 || forwardAzimuthRadians >= TWO_PI) {
		throw new RangeError('forwardAzimuthRadians must be finite and belong to [0, 2 PI)');
	}
	return Math.min(Math.floor((forwardAzimuthRadians * sectorCount) / TWO_PI), sectorCount - 1);
}

/**
 * Computes the reusable NED-to-ECEF matrix of every city on the CPU.
 *
 * This function is the reference implementation for the future WebGPU city
 * invariant dispatch. Input order is preserved exactly.
 */
export function computeCityInvariantsCpu(input: StaticCityInput): CityInvariantBuffers {
	const cityCount = validateStaticCityInput(input);
	const cityNed2EcefMatrices = new Float32Array(cityCount * CITY_NED2ECEF_MATRIX_STRIDE);

	for (let cityIndex = 0; cityIndex < cityCount; cityIndex += 1) {
		const offset = cityIndex * CITY_LON_LAT_STRIDE;
		const matrix = buildNed2EcefMatrix([
			input.cityLonLatRadians[offset],
			input.cityLonLatRadians[offset + 1],
		]);
		cityNed2EcefMatrices.set(matrix, cityIndex * CITY_NED2ECEF_MATRIX_STRIDE);
	}

	return { cityCount, cityNed2EcefMatrices };
}

/**
 * Computes dense ordered-pair invariants from the shared city matrix buffer.
 *
 * Diagonal pairs are preserved as zero-filled records so every pair remains
 * directly addressable with {@link getCityPairIndex}.
 */
export function computeCityPairInvariantsCpu(
	cityInvariants: CityInvariantBuffers,
	options: CityPairPrecomputeOptions,
): CityPairInvariantBuffers {
	validateCityInvariantBuffers(cityInvariants);
	assertSectorCount(options.sectorCount);

	const { cityCount, cityNed2EcefMatrices } = cityInvariants;
	const pairCount = cityCount * cityCount;
	const cityPairInvariants = new Float32Array(pairCount * CITY_PAIR_INVARIANT_STRIDE);
	const cityPairSectorIndexes = new Uint32Array(pairCount);

	for (let cityAIndex = 0; cityAIndex < cityCount; cityAIndex += 1) {
		const northA = readMatrixColumn3(cityNed2EcefMatrices, cityAIndex, 0);
		const eastA = readMatrixColumn3(cityNed2EcefMatrices, cityAIndex, 1);
		const nVectorA = readNVectorFromNed2Ecef(cityNed2EcefMatrices, cityAIndex);

		for (let cityBIndex = 0; cityBIndex < cityCount; cityBIndex += 1) {
			if (cityAIndex === cityBIndex) {
				continue;
			}

			const pairIndex = cityAIndex * cityCount + cityBIndex;
			const pairOffset = pairIndex * CITY_PAIR_INVARIANT_STRIDE;
			const northB = readMatrixColumn3(cityNed2EcefMatrices, cityBIndex, 0);
			const eastB = readMatrixColumn3(cityNed2EcefMatrices, cityBIndex, 1);
			const nVectorB = readNVectorFromNed2Ecef(cityNed2EcefMatrices, cityBIndex);
			const forwardAzimuthRadians = initialBearingRadians(northA, eastA, nVectorB);
			const reverseAzimuthRadians = initialBearingRadians(northB, eastB, nVectorA);

			cityPairInvariants[pairOffset] = forwardAzimuthRadians;
			cityPairInvariants[pairOffset + 1] = reverseAzimuthRadians;
			cityPairInvariants[pairOffset + 2] = angularDistanceRadians(nVectorA, nVectorB);
			cityPairSectorIndexes[pairIndex] = computeAzimuthSectorIndex(forwardAzimuthRadians, options.sectorCount);
		}
	}

	return {
		cityCount,
		sectorCount: options.sectorCount,
		cityPairInvariants,
		cityPairSectorIndexes,
	};
}

/**
 * Runs the first CPU tranche of static-town precomputation.
 *
 * The returned buffers define the contract that the first two WebGPU
 * dispatches must reproduce.
 */
export function computeStaticTownInvariantsCpu(
	input: StaticCityInput,
	options: CityPairPrecomputeOptions,
): StaticTownInvariantPrecompute {
	const cityInvariants = computeCityInvariantsCpu(input);
	const pairInvariants = computeCityPairInvariantsCpu(cityInvariants, options);
	return { ...cityInvariants, ...pairInvariants };
}

/**
 * Runs every currently implemented CPU static-town phase.
 *
 * The result includes city invariants, ordered-pair invariants, and the
 * angularly distributed neighbor selection used by later cone intersections.
 */
export function computeStaticTownPrecomputeCpu(
	input: StaticCityInput,
	options: StaticTownPrecomputeOptions,
): StaticTownPrecompute {
	const invariants = computeStaticTownInvariantsCpu(input, options);
	const overlaps = selectOverlapCandidatesCpu(invariants, options.neighborLimit);
	return { ...invariants, ...overlaps };
}

function validateStaticCityInput(input: StaticCityInput): number {
	if (input.cityLonLatRadians.length % CITY_LON_LAT_STRIDE !== 0) {
		throw new RangeError(`cityLonLatRadians length must be a multiple of ${CITY_LON_LAT_STRIDE}`);
	}

	for (let offset = 0; offset < input.cityLonLatRadians.length; offset += CITY_LON_LAT_STRIDE) {
		const longitudeRadians = input.cityLonLatRadians[offset];
		const latitudeRadians = input.cityLonLatRadians[offset + 1];
		if (!Number.isFinite(longitudeRadians) || !Number.isFinite(latitudeRadians)) {
			throw new RangeError('city longitude and latitude must be finite radians');
		}
		if (latitudeRadians < -Math.PI / 2 || latitudeRadians > Math.PI / 2) {
			throw new RangeError('city latitude must belong to [-PI / 2, PI / 2]');
		}
	}

	return input.cityLonLatRadians.length / CITY_LON_LAT_STRIDE;
}

function validateCityInvariantBuffers(cityInvariants: CityInvariantBuffers): void {
	if (!Number.isSafeInteger(cityInvariants.cityCount) || cityInvariants.cityCount < 0) {
		throw new RangeError('cityCount must be a non-negative safe integer');
	}
	const expectedLength = cityInvariants.cityCount * CITY_NED2ECEF_MATRIX_STRIDE;
	if (cityInvariants.cityNed2EcefMatrices.length !== expectedLength) {
		throw new RangeError(`cityNed2EcefMatrices length must equal ${expectedLength}`);
	}
}

function assertSectorCount(sectorCount: number): void {
	if (!Number.isSafeInteger(sectorCount) || sectorCount <= 0) {
		throw new RangeError('sectorCount must be a strictly positive safe integer');
	}
}

function assertIntegerInRange(value: number, upperBound: number, name: string): void {
	if (!Number.isSafeInteger(value) || value < 0 || value >= upperBound) {
		throw new RangeError(`${name} must be a valid city index`);
	}
}
