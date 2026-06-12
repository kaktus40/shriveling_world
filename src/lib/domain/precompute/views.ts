import { nVectorToLonLat, readMatrixColumn3 } from '../../shared/spherical';
import type { Vec3 } from '../../shared/vector3';
import {
	CITY_NED2ECEF_MATRIX_STRIDE,
	CITY_PAIR_INVARIANT_STRIDE,
	CURVE_CONTROL_POINT_STRIDE,
	CURVE_EDGE_PAIR_STRIDE,
	type RawConePrecompute,
	type CityInvariantBuffers,
	type CityPairInvariantBuffers,
	type CurveControlBuffers,
	type DynamicTownPrecompute,
	type OverlapCandidateBuffers,
} from './types';
import { RAW_CONE_RIM_ECEF_STRIDE, getCityPairIndex } from './cpu';

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

/**
 * Read-only view over one retained overlap candidate.
 *
 * The view resolves azimuths and distance from the shared dense pair buffer;
 * these values are deliberately not duplicated in the overlap index buffer.
 */
export class OverlapCandidateView {
	readonly #cityIndex: number;
	readonly #candidateIndex: number;
	readonly #neighborCityIndex: number;
	readonly #pairOffset: number;
	readonly #pairInvariants: CityPairInvariantBuffers;

	constructor(
		pairInvariants: CityPairInvariantBuffers,
		overlaps: OverlapCandidateBuffers,
		cityIndex: number,
		candidateIndex: number,
	) {
		if (!Number.isSafeInteger(cityIndex) || cityIndex < 0 || cityIndex >= pairInvariants.cityCount) {
			throw new RangeError('cityIndex must be a valid city index');
		}
		if (
			!Number.isSafeInteger(candidateIndex) ||
			candidateIndex < 0 ||
			candidateIndex >= overlaps.overlapCandidateCounts[cityIndex]
		) {
			throw new RangeError('candidateIndex must reference a retained overlap candidate');
		}
		const neighborCityIndex = overlaps.overlapCandidates[cityIndex * overlaps.neighborLimit + candidateIndex];
		this.#cityIndex = cityIndex;
		this.#candidateIndex = candidateIndex;
		this.#neighborCityIndex = neighborCityIndex;
		this.#pairOffset = getCityPairIndex(cityIndex, neighborCityIndex, pairInvariants.cityCount) * CITY_PAIR_INVARIANT_STRIDE;
		this.#pairInvariants = pairInvariants;
	}

	/** Dense index of the origin city. */
	get cityIndex(): number {
		return this.#cityIndex;
	}

	/** Position of this neighbor in the origin city's azimuth-sorted list. */
	get candidateIndex(): number {
		return this.#candidateIndex;
	}

	/** Dense index of the retained neighbor city. */
	get neighborCityIndex(): number {
		return this.#neighborCityIndex;
	}

	/** Initial azimuth from the origin city to the neighbor, in radians. */
	get forwardAzimuthRadians(): number {
		return this.#pairInvariants.cityPairInvariants[this.#pairOffset];
	}

	/** Initial azimuth from the neighbor back to the origin city, in radians. */
	get reverseAzimuthRadians(): number {
		return this.#pairInvariants.cityPairInvariants[this.#pairOffset + 1];
	}

	/** Half of the great-circle angular distance, in radians. */
	get halfAngularDistanceRadians(): number {
		return this.#pairInvariants.cityPairInvariants[this.#pairOffset + 2] / 2;
	}
}

/** Read-only view over one known curve edge and its four ECEF control points. */
export class CurveControlView {
	readonly #curveIndex: number;
	readonly #curves: CurveControlBuffers;

	constructor(curves: CurveControlBuffers, curveIndex: number) {
		const curveCount = curves.curveEdgePairs.length / CURVE_EDGE_PAIR_STRIDE;
		if (!Number.isSafeInteger(curveIndex) || curveIndex < 0 || curveIndex >= curveCount) {
			throw new RangeError('curveIndex must be a valid curve index');
		}
		this.#curveIndex = curveIndex;
		this.#curves = curves;
	}

	/** Dense curve index preserving the prepared edge order. */
	get curveIndex(): number {
		return this.#curveIndex;
	}

	/** Dense origin city index. */
	get originCityIndex(): number {
		return this.#curves.curveEdgePairs[this.#curveIndex * CURVE_EDGE_PAIR_STRIDE];
	}

	/** Dense destination city index. */
	get destinationCityIndex(): number {
		return this.#curves.curveEdgePairs[this.#curveIndex * CURVE_EDGE_PAIR_STRIDE + 1];
	}

	/** Curve start point A in ECEF meters. */
	get pointAEcefMeters(): Vec3 {
		return this.#readPoint(0);
	}

	/** First intermediate point P in ECEF meters. */
	get pointPEcefMeters(): Vec3 {
		return this.#readPoint(4);
	}

	/** Second intermediate point Q in ECEF meters. */
	get pointQEcefMeters(): Vec3 {
		return this.#readPoint(8);
	}

	/** Curve end point B in ECEF meters. */
	get pointBEcefMeters(): Vec3 {
		return this.#readPoint(12);
	}

	#readPoint(pointOffset: number): Vec3 {
		const offset = this.#curveIndex * CURVE_CONTROL_POINT_STRIDE + pointOffset;
		return [
			this.#curves.curveControlPointsEcef[offset],
			this.#curves.curveControlPointsEcef[offset + 1],
			this.#curves.curveControlPointsEcef[offset + 2],
		];
	}
}

/** Read-only view over one city's compact dynamic links for a selected year. */
export class DynamicCityLinksView {
	readonly #dynamicTown: DynamicTownPrecompute;
	readonly #cityIndex: number;

	constructor(dynamicTown: DynamicTownPrecompute, cityIndex: number) {
		if (!Number.isSafeInteger(cityIndex) || cityIndex < 0 || cityIndex >= dynamicTown.cityLinkCounts.length) {
			throw new RangeError('cityIndex must be a valid dynamic city index');
		}
		this.#dynamicTown = dynamicTown;
		this.#cityIndex = cityIndex;
	}

	/** First compact link index for this city. */
	get offset(): number {
		return this.#dynamicTown.cityLinkOffsets[this.#cityIndex];
	}

	/** Number of compact links for this city. */
	get count(): number {
		return this.#dynamicTown.cityLinkCounts[this.#cityIndex];
	}

	/** Minimum connected terrestrial alpha, or Road alpha without links. */
	get fastestTerrestrialAlphaRadians(): number {
		return this.#dynamicTown.cityFastestTerrestrialAlphaRadians[this.#cityIndex];
	}

	/** Resolves one link using a city-local index. */
	link(localLinkIndex: number): DynamicCityLinkView {
		if (!Number.isSafeInteger(localLinkIndex) || localLinkIndex < 0 || localLinkIndex >= this.count) {
			throw new RangeError('localLinkIndex must reference a dynamic city link');
		}
		return new DynamicCityLinkView(this.#dynamicTown, this.#cityIndex, this.offset + localLinkIndex);
	}
}

/** Read-only view over one compact dynamic directional influence. */
export class DynamicCityLinkView {
	readonly #dynamicTown: DynamicTownPrecompute;
	readonly #originCityIndex: number;
	readonly #linkIndex: number;

	constructor(dynamicTown: DynamicTownPrecompute, originCityIndex: number, linkIndex: number) {
		if (!Number.isSafeInteger(originCityIndex) || originCityIndex < 0 || originCityIndex >= dynamicTown.cityLinkCounts.length) {
			throw new RangeError('originCityIndex must be a valid dynamic city index');
		}
		if (!Number.isSafeInteger(linkIndex) || linkIndex < 0 || linkIndex >= dynamicTown.cityLinkDestinationIndexes.length) {
			throw new RangeError('linkIndex must be a valid compact dynamic link index');
		}
		const offset = dynamicTown.cityLinkOffsets[originCityIndex];
		const count = dynamicTown.cityLinkCounts[originCityIndex];
		if (linkIndex < offset || linkIndex >= offset + count) {
			throw new RangeError('linkIndex must belong to originCityIndex');
		}
		this.#dynamicTown = dynamicTown;
		this.#originCityIndex = originCityIndex;
		this.#linkIndex = linkIndex;
	}

	get originCityIndex(): number {
		return this.#originCityIndex;
	}

	get destinationCityIndex(): number {
		return this.#dynamicTown.cityLinkDestinationIndexes[this.#linkIndex];
	}

	get azimuthRadians(): number {
		return this.#dynamicTown.cityLinkAzimuthRadians[this.#linkIndex];
	}

	get alphaRadians(): number {
		return this.#dynamicTown.cityLinkAlphaRadians[this.#linkIndex];
	}
}

/** Read-only view over one raw cone rim sample in shared buffers. */
export class RawConeRimView {
	readonly #rawCone: RawConePrecompute;
	readonly #sampleOffset: number;

	constructor(rawCone: RawConePrecompute, cityIndex: number, azimuthSampleIndex: number) {
		if (!Number.isSafeInteger(cityIndex) || cityIndex < 0 || cityIndex >= rawCone.cityCount) {
			throw new RangeError('cityIndex must be a valid raw-cone city index');
		}
		if (
			!Number.isSafeInteger(azimuthSampleIndex) ||
			azimuthSampleIndex < 0 ||
			azimuthSampleIndex >= rawCone.azimuthSampleCount
		) {
			throw new RangeError('azimuthSampleIndex must be a valid raw-cone sample index');
		}
		this.#rawCone = rawCone;
		this.#sampleOffset = cityIndex * rawCone.azimuthSampleCount + azimuthSampleIndex;
	}

	/** Selected directional alpha in radians. */
	get alphaRadians(): number {
		return this.#rawCone.coneAlphaRadians[this.#sampleOffset];
	}

	/** Raw cone rim position in ECEF meters. */
	get ecefMeters(): Vec3 {
		const offset = this.#sampleOffset * RAW_CONE_RIM_ECEF_STRIDE;
		return [
			this.#rawCone.rawConeRimEcef[offset],
			this.#rawCone.rawConeRimEcef[offset + 1],
			this.#rawCone.rawConeRimEcef[offset + 2],
		];
	}
}
