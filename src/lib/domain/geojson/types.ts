import type GeoJSON from 'geojson';

/** A longitude/latitude pair expressed in radians, the internal angular unit. */
export type LonLatRadians = readonly [longitude: number, latitude: number];

/** Inclusive/exclusive range inside a flat vertex array. */
export interface MarkedRange {
	/** Inclusive start offset. */
	begin: number;
	/** Exclusive end offset. */
	end: number;
}

/** Options controlling country mesh and boundary precomputation. */
export interface BoundaryPrecomputeOptions {
	/** Maximum contour segment angular length before inserting intermediate contour points, in radians. */
	contourMaxSegmentRadians: number;
	/** Approximate angular spacing used to generate interior Fibonacci points, in radians. */
	interiorPointSpacingRadians: number;
	/** Number of azimuth samples around each town for future boundary clipping buffers. */
	azimuthSampleCount: number;
	/** Height used for the duplicated extruded country surface, in meters. */
	countryExtrusionHeightMeters: number;
}

/** One external GeoJSON contour retained by the precompute pipeline. */
export interface CountryContour {
	/** Index of the source GeoJSON feature. */
	featureIndex: number;
	/** Index of the external contour inside the feature. */
	contourIndex: number;
	/** Source feature properties preserved for picking and queries. */
	properties: GeoJSON.GeoJsonProperties;
	/** External contour coordinates in radians. Holes are deliberately excluded. */
	ring: LonLatRadians[];
}

/** Renderable pre-geometry for one country or country part. */
export interface CountryRenderPreGeometry {
	/** Index of the source GeoJSON feature. */
	sourceFeatureId: number;
	/** Index of the retained external contour inside the source feature. */
	sourceContourId: number;
	/** Cartographic vertex triples `[longitudeRad, latitudeRad, heightMeters]`. */
	vertices: Float32Array;
	/** UV pairs generated from longitude/latitude. */
	uvs: Float32Array;
	/** Triangle indices. */
	indexes: Uint32Array;
	/** Range of the extruded top-surface vertices inside `vertices`. */
	extruded: MarkedRange;
	/** Number of bottom-surface vertices before extrusion duplication. */
	bottomVertexCount: number;
}

/** Minimal city input required to associate cities to GeoJSON contours. */
export interface TownBoundaryInput {
	/** Stable dense city id in the prepared dataset. */
	cityId: number;
	/** Source city code. */
	cityCode: number;
	/** Longitude in radians. */
	longitudeRadians: number;
	/** Latitude in radians. */
	latitudeRadians: number;
	/** Optional city name, used only for diagnostics. */
	cityName?: string;
}

/** Result of one city-to-contour association. */
export interface TownCountryAssociation {
	/** Dense city id. */
	cityId: number;
	/** Source city code. */
	cityCode: number;
	/** Associated contour id, or `-1` when no contour contains the city. */
	countryContourId: number;
}

/** Diagnostic emitted while preparing GeoJSON boundaries. */
export interface BoundaryDiagnostic {
	/** Whether the diagnostic blocks safe use of the generated precompute. */
	severity: 'warning' | 'error';
	/** Stable machine-readable diagnostic code. */
	code: string;
	/** Additional context. */
	[key: string]: unknown;
}

/** CPU precompute result for country rendering and future cone clipping. */
export interface BoundaryPrecompute {
	/** External contours retained from the GeoJSON. */
	contours: CountryContour[];
	/** Country render meshes generated from contours and interior points. */
	countryGeometries: CountryRenderPreGeometry[];
	/** Compact contour buffer, stride 2: `[longitudeRadians, latitudeRadians]`. */
	countryContourBuffer: Float32Array;
	/** Compact contour buffer converted to n-vectors, stride 4: `[x, y, z, padding]`. */
	countryContourNVectorBuffer: Float32Array;
	/** Start point offset per contour inside `countryContourBuffer` and `countryContourNVectorBuffer`. */
	countryContourOffsets: Int32Array;
	/** Number of contour points per retained contour. */
	countryContourSizes: Int32Array;
	/** Per-city contour association, indexed by dense city index. */
	cityContourIndexes: Int32Array;
	/** Per-city contour association, indexed by dense `cityId`. */
	townCountryIndexes: Int32Array;
	/** Detailed city association records. */
	townCountryAssociations: TownCountryAssociation[];
	/** Azimuth sample count reserved for CPU reference and future WebGPU boundary generation. */
	azimuthSampleCount: number;
	/** Diagnostics collected during extraction, meshing, and association. */
	diagnostics: BoundaryDiagnostic[];
}

/** Continuous azimuth interval expressed in radians. */
export interface AzimuthInterval {
	/** Inclusive lower bound in radians. May be negative to avoid modular discontinuities. */
	minRadians: number;
	/** Inclusive upper bound in radians. May be greater than `2 * PI`. */
	maxRadians: number;
}

/** Inputs consumed by the CPU reference implementation of boundary clipping. */
export interface BoundaryRaycastInput {
	/** NED-to-ECEF matrices in city order, column-major, stride 16. */
	cityNed2EcefMatrices: Float32Array;
	/** Associated contour index for each city, in the same order as `cityNed2EcefMatrices`. */
	cityContourIndexes: Int32Array;
	/** Country contour points converted to n-vectors, stride 4: `[x, y, z, padding]`. */
	countryContourNVectorBuffer: Float32Array;
	/** Start point offset per contour inside `countryContourNVectorBuffer`. */
	countryContourOffsets: Int32Array;
	/** Number of points per contour. */
	countryContourSizes: Int32Array;
	/** Packed azimuth intervals, stride 2: `[minRadians, maxRadians]`. */
	azimuthIntervals: Float32Array;
	/** Earth radius used for ECEF outputs, in meters. */
	earthRadiusMeters: number;
}

/** CPU reference result for city boundary limits. */
export interface BoundaryRaycastResult {
	/** Per city and azimuth interval, stride 4: `[longitudeRadians, latitudeRadians, angularDistanceRadians, validIntersection]`. */
	townBoundaryAngular: Float32Array;
	/** Per city and azimuth interval, stride 4: `[xMeters, yMeters, zMeters, validIntersection]`. */
	townBoundaryEcef: Float32Array;
	/** Number of azimuth intervals used per city. */
	azimuthIntervalCount: number;
	/** Diagnostics emitted while raycasting. */
	diagnostics: BoundaryDiagnostic[];
}
