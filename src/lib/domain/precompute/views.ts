import { nVectorToLonLat, readMatrixColumn3 } from '../../shared/spherical';
import type { Vec3 } from '../../shared/vector3';
import {
	CITY_NED2ECEF_MATRIX_STRIDE,
	CITY_PAIR_INVARIANT_STRIDE,
	type CityInvariantBuffers,
	type CityPairInvariantBuffers,
} from './types';
import { getCityPairIndex } from './static-town-cpu';

/**
 * Allocation-light view over one city in a shared invariant buffer.
 *
 * Vector getters allocate tuples for non-intensive application code. Compute
 * loops should read the underlying typed array directly.
 */
export class CityInvariantView {
	readonly #cityIndex: number;
	readonly #matrices: Float32Array;

	constructor(cityInvariants: CityInvariantBuffers, cityIndex: number) {
		if (!Number.isSafeInteger(cityIndex) || cityIndex < 0 || cityIndex >= cityInvariants.cityCount) {
			throw new RangeError('cityIndex must be a valid city index');
		}
		this.#cityIndex = cityIndex;
		this.#matrices = cityInvariants.cityNed2EcefMatrices;
	}

	/** Dense city index shared by every prepared buffer. */
	get cityIndex(): number {
		return this.#cityIndex;
	}

	/** Offset of this city's matrix in the shared float buffer. */
	get matrixOffset(): number {
		return this.#cityIndex * CITY_NED2ECEF_MATRIX_STRIDE;
	}

	/** City ECEF position in meters. */
	get ecefMeters(): Vec3 {
		return readMatrixColumn3(this.#matrices, this.#cityIndex, 3);
	}

	/** City longitude/latitude in radians, derived from its ECEF position. */
	get lonLatRadians(): readonly [longitude: number, latitude: number] {
		return nVectorToLonLat(this.ecefMeters);
	}
}

/** Read-only view over one ordered pair in shared invariant buffers. */
export class CityPairInvariantView {
	readonly #pairIndex: number;
	readonly #pairOffset: number;
	readonly #pairInvariants: CityPairInvariantBuffers;

	constructor(pairInvariants: CityPairInvariantBuffers, cityAIndex: number, cityBIndex: number) {
		this.#pairIndex = getCityPairIndex(cityAIndex, cityBIndex, pairInvariants.cityCount);
		this.#pairOffset = this.#pairIndex * CITY_PAIR_INVARIANT_STRIDE;
		this.#pairInvariants = pairInvariants;
	}

	/** Dense ordered-pair index. */
	get pairIndex(): number {
		return this.#pairIndex;
	}

	/** Initial azimuth from city A to city B, in radians. */
	get forwardAzimuthRadians(): number {
		return this.#pairInvariants.cityPairInvariants[this.#pairOffset];
	}

	/** Initial azimuth from city B to city A, in radians. */
	get reverseAzimuthRadians(): number {
		return this.#pairInvariants.cityPairInvariants[this.#pairOffset + 1];
	}

	/** Great-circle angular distance between both cities, in radians. */
	get angularDistanceRadians(): number {
		return this.#pairInvariants.cityPairInvariants[this.#pairOffset + 2];
	}

	/** Equal-width azimuth sector containing the forward azimuth. */
	get sectorIndex(): number {
		return this.#pairInvariants.cityPairSectorIndexes[this.#pairIndex];
	}
}
