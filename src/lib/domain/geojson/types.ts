import type GeoJSON from 'geojson';

/** A longitude/latitude pair expressed in degrees. */
export type LonLatDegrees = readonly [longitude: number, latitude: number];

/** Inclusive/exclusive range inside a flat vertex array. */
export interface MarkedRange {
	/** Inclusive start offset. */
	begin: number;
	/** Exclusive end offset. */
	end: number;
}

/** Options controlling country mesh and boundary precomputation. */
export interface BoundaryPrecomputeOptions {
	/** Maximum contour segment length before inserting intermediate contour points, in degrees. */
	contourMaxSegmentDegrees: number;
	/** Approximate spacing used to generate interior Fibonacci points, in degrees. */
	interiorPointSpacingDegrees: number;
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
	/** External contour coordinates in degrees. Holes are deliberately excluded. */
	ring: LonLatDegrees[];
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
	/** Longitude in degrees. */
	longitude: number;
	/** Latitude in degrees. */
	latitude: number;
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
	/** Compact contour buffer, stride 2: `[longitudeDeg, latitudeDeg]`. */
	countryContourBuffer: Float32Array;
	/** Number of contour points per retained contour. */
	countryContourSizes: Int32Array;
	/** Per-city contour association, indexed by dense `cityId`. */
	townCountryIndexes: Int32Array;
	/** Detailed city association records. */
	townCountryAssociations: TownCountryAssociation[];
	/** Azimuth sample count reserved for CPU reference and future WebGPU boundary generation. */
	azimuthSampleCount: number;
	/** Diagnostics collected during extraction, meshing, and association. */
	diagnostics: BoundaryDiagnostic[];
}

