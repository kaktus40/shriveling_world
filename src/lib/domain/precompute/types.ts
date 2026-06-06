/** Number of float values used by one longitude/latitude pair. */
export const CITY_LON_LAT_STRIDE = 2;

/** Number of float values used by one column-major NED-to-ECEF matrix. */
export const CITY_NED2ECEF_MATRIX_STRIDE = 16;

/** Number of float values used by one ordered city-pair invariant record. */
export const CITY_PAIR_INVARIANT_STRIDE = 4;

/**
 * Compact static city input shared by CPU and GPU precompute backends.
 *
 * Cities use the stable order produced by dataset preparation. Longitudes and
 * latitudes are expressed in radians.
 */
export interface StaticCityInput {
	/** Longitude/latitude pairs with stride {@link CITY_LON_LAT_STRIDE}. */
	cityLonLatRadians: Float32Array;
}

/** Options controlling ordered city-pair invariant computation. */
export interface CityPairPrecomputeOptions {
	/** Number of equal azimuth sectors covering `[0, 2 PI)`. */
	sectorCount: number;
}

/** Invariants computed independently for every city. */
export interface CityInvariantBuffers {
	/** Number of cities represented by the buffers. */
	cityCount: number;
	/** Column-major NED-to-ECEF matrices with stride {@link CITY_NED2ECEF_MATRIX_STRIDE}. */
	cityNed2EcefMatrices: Float32Array;
}

/** Invariants computed for every ordered city pair. */
export interface CityPairInvariantBuffers {
	/** Number of cities used by the dense `N x N` pair indexing. */
	cityCount: number;
	/** Number of equal azimuth sectors used to classify ordered pairs. */
	sectorCount: number;
	/**
	 * Ordered-pair records with stride {@link CITY_PAIR_INVARIANT_STRIDE}.
	 *
	 * Each record is
	 * `[forwardAzimuthRadians, reverseAzimuthRadians, angularDistanceRadians, 0]`.
	 */
	cityPairInvariants: Float32Array;
	/** One sector index for every ordered pair. */
	cityPairSectorIndexes: Uint32Array;
}

/** First CPU tranche of the static-town precompute contract. */
export interface StaticTownInvariantPrecompute extends CityInvariantBuffers, CityPairInvariantBuffers {}
