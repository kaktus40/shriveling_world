/** Number of float values used by one longitude/latitude pair. */
export const CITY_LON_LAT_STRIDE = 2;

/** Number of float values used by one column-major NED-to-ECEF matrix. */
export const CITY_NED2ECEF_MATRIX_STRIDE = 16;

/** Number of float values used by one ordered city-pair invariant record. */
export const CITY_PAIR_INVARIANT_STRIDE = 4;

/** Number of unsigned integer values used by one known curve edge pair. */
export const CURVE_EDGE_PAIR_STRIDE = 2;

/** Number of float values used by the four ECEF curve control points. */
export const CURVE_CONTROL_POINT_STRIDE = 16;

/** Sentinel used by unused slots in dense unsigned integer buffers. */
export const UNUSED_INDEX = 0xffffffff;

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

/** Complete static-town input consumed by the profile backends. */
export interface StaticTownInput extends StaticCityInput {
	/**
	 * Known curve edges with stride {@link CURVE_EDGE_PAIR_STRIDE}.
	 *
	 * The order is preserved in the curve control-point output. Multiple
	 * business edges may intentionally reference the same city pair.
	 */
	curveEdgePairs?: Uint32Array;
}

/** Object-oriented input accepted when constructing compact curve edge pairs. */
export interface KnownCurveEdge {
	/** Dense origin city index. */
	originCityIndex: number;
	/** Dense destination city index. */
	destinationCityIndex: number;
}

/** Options controlling ordered city-pair invariant computation. */
export interface CityPairPrecomputeOptions {
	/** Number of equal azimuth sectors covering `[0, 2 PI)`. */
	sectorCount: number;
}

/** Options controlling the complete static-town CPU precompute. */
export interface StaticTownPrecomputeOptions extends CityPairPrecomputeOptions {
	/** Maximum number of overlap candidates retained for each city. */
	neighborLimit: number;
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

/** Neighbor indexes retained for later cone-intersection calculations. */
export interface OverlapCandidateBuffers {
	/** Maximum number of dense candidate slots reserved for each city. */
	neighborLimit: number;
	/**
	 * Neighbor city indexes with dense layout
	 * `cityIndex * neighborLimit + candidateIndex`.
	 *
	 * Valid candidates are ordered by forward azimuth. Unused slots contain
	 * {@link UNUSED_INDEX}.
	 */
	overlapCandidates: Uint32Array;
	/** Number of valid candidates retained for each city. */
	overlapCandidateCounts: Uint32Array;
}

/** Static control-point buffers for curves associated with known edges. */
export interface CurveControlBuffers {
	/** Known origin/destination pairs with stride {@link CURVE_EDGE_PAIR_STRIDE}. */
	curveEdgePairs: Uint32Array;
	/**
	 * ECEF control points with stride {@link CURVE_CONTROL_POINT_STRIDE}.
	 *
	 * Each curve stores `[A, P, Q, B]` as four aligned `vec4<f32>` values in
	 * meters. The fourth component of every point is `1`.
	 */
	curveControlPointsEcef: Float32Array;
}

/** First CPU tranche of the static-town precompute contract. */
export interface StaticTownInvariantPrecompute extends CityInvariantBuffers, CityPairInvariantBuffers {}

/** Static-town precompute buffers currently produced by the CPU backend. */
export interface StaticTownPrecompute extends StaticTownInvariantPrecompute, OverlapCandidateBuffers, CurveControlBuffers {}

/**
 * Compact dynamic cone inputs computed for one year.
 *
 * Link lists use `offset + count` with an exclusive upper bound. One link is
 * retained per origin/destination pair and lists are sorted by azimuth.
 */
export interface DynamicTownPrecompute {
	/** Year represented by these buffers. */
	year: number;
	/** Alpha of the reference Road surface, in radians. */
	roadAlphaRadians: number;
	/** First link index for every city. */
	cityLinkOffsets: Uint32Array;
	/** Number of links for every city. */
	cityLinkCounts: Uint32Array;
	/** Destination city index for every compact link. */
	cityLinkDestinationIndexes: Uint32Array;
	/** Forward azimuth of every compact link, in radians. */
	cityLinkAzimuthRadians: Float32Array;
	/** Selected terrestrial alpha of every compact link, in radians. */
	cityLinkAlphaRadians: Float32Array;
	/** Minimum connected terrestrial alpha per city, bounded by Road alpha. */
	cityFastestTerrestrialAlphaRadians: Float32Array;
}

/** Dynamic cone inputs indexed by their decimal year. */
export type DynamicTownPrecomputeByYear = Record<string, DynamicTownPrecompute>;

/** Supported scientific variants for raw cone slope generation. */
export type ConeShape = 'road' | 'fastest-terrestrial' | 'complex';

/** Options controlling CPU/GPU-equivalent raw cone generation. */
export interface RawConePrecomputeOptions {
	/** Scientific cone variant to generate. */
	shape: ConeShape;
	/** Number of uniformly spaced azimuth samples covering `[0, 2 PI)`. */
	azimuthSampleCount: number;
	/** Maximum slant length of every raw cone ray, in meters. */
	coneLengthMeters: number;
	/**
	 * Maximum angular influence distance around a complex-cone link, in radians.
	 *
	 * Required only for the `complex` shape.
	 */
	attenuationRadians?: number;
}

/** Directional alpha samples shared by raw cone geometry backends. */
export interface ConeAlphaSampleBuffers {
	/** Number of represented cities. */
	cityCount: number;
	/** Number of uniformly spaced azimuth samples per city. */
	azimuthSampleCount: number;
	/** Selected alpha for each dense `[cityIndex, azimuthSampleIndex]` pair. */
	coneAlphaRadians: Float32Array;
}

/** Raw, non-intersected cone rims generated before cone/country clipping. */
export interface RawConePrecompute extends ConeAlphaSampleBuffers {
	/** Scientific cone variant represented by the buffers. */
	shape: ConeShape;
	/** Maximum slant length used for every ray, in meters. */
	coneLengthMeters: number;
	/**
	 * ECEF rim positions with one aligned `vec4<f32>` per city/azimuth sample.
	 *
	 * Layout is dense by city then azimuth. XYZ values are in meters and W is
	 * always `1`.
	 */
	rawConeRimEcef: Float32Array;
}

/**
 * Static inputs required by cone-intersection compute backends.
 *
 * The contract deliberately references existing shared buffers instead of
 * duplicating city summits or neighbor information.
 */
export interface ConeIntersectionStaticInput extends CityInvariantBuffers, OverlapCandidateBuffers {}

/** Static inputs additionally required by symmetric-ray ordered intersections. */
export interface SymmetricConeIntersectionStaticInput
	extends ConeIntersectionStaticInput,
		CityPairInvariantBuffers {}

/**
 * Exhaustive CPU reference output for cone/cone intersections.
 *
 * Every dense output uses `[cityIndex, azimuthSampleIndex]` ordering. Debug
 * indexes and face counts are retained because this implementation is the
 * oracle used to validate and benchmark future heuristics and GPU kernels.
 */
export interface ConeIntersectionOraclePrecompute {
	/** Number of represented cities. */
	cityCount: number;
	/** Number of uniformly spaced azimuth samples per city. */
	azimuthSampleCount: number;
	/** Minimum distance from each city summit, in meters. */
	coneIntersectionDistanceMeters: Float32Array;
	/** Ciseled ECEF rim positions as aligned `vec4<f32>` values in meters. */
	ciseledConeRimEcef: Float32Array;
	/** Winning neighbor city index, or {@link UNUSED_INDEX} when no cone clips the ray. */
	winningNeighborCityIndexes: Uint32Array;
	/** Winning neighbor face index, or {@link UNUSED_INDEX} when no cone clips the ray. */
	winningFaceIndexes: Uint32Array;
	/** Number of neighbor faces tested for every ray. */
	testedFaceCounts: Uint32Array;
}

/**
 * Exhaustive intersection output produced with symmetric-ray face ordering.
 *
 * The geometry remains identical to the oracle because every retained face is
 * still tested. Visit orders characterize how quickly the preferred ordering
 * discovers the final winning face before any pruning strategy is introduced.
 */
export interface SymmetricConeIntersectionPrecompute extends ConeIntersectionOraclePrecompute {
	/**
	 * One-based visit order of the final winning face across all neighbor faces.
	 *
	 * Rays without a cone intersection contain {@link UNUSED_INDEX}.
	 */
	winningFaceVisitOrders: Uint32Array;
}

/** Options controlling the CPU alpha-aware priority-window characterization. */
export interface AlphaAwareConeIntersectionOptions {
	/** Alpha of the reference Road surface for the represented year, in radians. */
	roadAlphaRadians: number;
	/**
	 * Number of faces inspected on both sides of `phiB0` for nearby fast supports.
	 *
	 * This parameter changes only visit priority. It never removes a face.
	 */
	bilateralNeighborhoodFaceCount: number;
	/** Tolerance used when comparing sampled alpha values with Road alpha. */
	alphaEpsilonRadians?: number;
}

/**
 * Exhaustive intersection output produced with an alpha-aware priority window.
 *
 * Every retained face is still tested. The additional buffers characterize
 * the size and usefulness of the priority window before conservative pruning
 * is introduced.
 */
export interface AlphaAwareConeIntersectionPrecompute extends SymmetricConeIntersectionPrecompute {
	/** Total number of priority-window faces accumulated across neighbors for each ray. */
	priorityFaceCounts: Uint32Array;
	/** Priority-window faces classified as touching a fast alpha sample. */
	priorityFastFaceCounts: Uint32Array;
	/** `1` when the final winning face belonged to its neighbor's priority window. */
	winningFacePriorityFlags: Uint8Array;
}
