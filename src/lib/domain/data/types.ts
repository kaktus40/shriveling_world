/**
 * Supported high-level dataset file kinds.
 *
 * File names are deliberately excluded from the contract. A file kind is
 * resolved from characteristic columns, then the original file name is only
 * kept for diagnostics and source tracing.
 */
export type DatasetFileKind =
	| 'cities'
	| 'cityLinkedAttributes'
	| 'transportNetwork'
	| 'transportModes'
	| 'transportModeSpeeds'
	| 'geojson'
	| 'unknown';

/**
 * A file provided by a dataset source.
 *
 * The same shape can be produced by drag and drop, compressed application
 * datasets, a local Tauri folder picker, or tests. Consumers must not assume
 * any stable ordering in arrays of source files.
 */
export interface SourceFile {
	/** Original file name, used for diagnostics and source traceability. */
	name: string;
	/** Full text content of the source file. */
	text: string;
}

/** Severity attached to a dataset inspection or assembly diagnostic. */
export type DatasetDiagnosticSeverity = 'error' | 'warning';

/**
 * Diagnostic emitted while inspecting or assembling a dataset.
 *
 * Diagnostics are intentionally structured but open-ended so that later
 * migration steps can add precise data-quality warnings without breaking the
 * public contract of the data layer.
 */
export interface DatasetDiagnostic {
	/** Whether this diagnostic blocks the current phase. */
	severity: DatasetDiagnosticSeverity;
	/** Stable machine-readable diagnostic code. */
	code: string;
	/** Optional origin profile used by compute and workspace diagnostics. */
	profile?: string;
	/** Additional diagnostic context. */
	[key: string]: unknown;
}

/**
 * Result of schema-based inspection for one source file.
 *
 * `extraHeaders` are not interpreted by the core model. They remain available
 * for user-defined queries and semantic mappings.
 */
export interface InspectedDatasetFile {
	/** Original file name. */
	originalName: string;
	/** Resolved file kind. */
	kind: DatasetFileKind;
	/** Heuristic confidence. Primary signatures currently use `1`. */
	confidence: number;
	/** CSV headers when the source file is tabular. */
	headers: string[];
	/** Candidate kinds matched during inspection, ordered by precedence. */
	candidateKinds: DatasetFileKind[];
	/** Characteristic headers found in the source. */
	requiredHeadersFound: string[];
	/** Characteristic headers missing from the source. */
	missingHeaders: string[];
	/** Non-characteristic headers preserved as user data. */
	extraHeaders: string[];
	/** File-local inspection errors. */
	errors: string[];
}

/**
 * Resolved dataset manifest.
 *
 * This manifest is resolved after all files have been inspected. It makes the
 * data pipeline independent from source-file ordering.
 */
export interface DatasetManifest {
	/** Required unique files used by the base network. */
	primary: {
		cities: InspectedDatasetFile;
		transportNetwork: InspectedDatasetFile;
		transportModes: InspectedDatasetFile;
		transportModeSpeeds: InspectedDatasetFile;
	};
	/** Optional user-enrichment tables attached to cities by `cityCode`. */
	cityLinkedAttributes: InspectedDatasetFile[];
	/** Optional GeoJSON files. */
	geojson: InspectedDatasetFile[];
	/** Files not recognized by the structural dataset contract. */
	unknown: InspectedDatasetFile[];
	/** Manifest-level diagnostics. */
	diagnostics: DatasetDiagnostic[];
	/** True when no manifest-level error is present. */
	valid: boolean;
}

/**
 * One parsed source row preserved without loss.
 *
 * `SourceRecord` is the bridge between a compact network entity and the full
 * user-provided row. It keeps the system queryable without copying every free
 * column into `BaseCity`, `BaseEdge`, or `BaseTransportMode`.
 */
export interface SourceRecord {
	/** Stable id in `BaseNetwork.sourceRecords`. */
	id: number;
	/** Original file name. */
	sourceFileName: string;
	/** Source file kind resolved during inspection. */
	sourceKind: DatasetFileKind;
	/** Zero-based row index in the parsed source file, excluding header. */
	rowIndex: number;
	/** Characteristic values extracted from the row. */
	characteristic: Record<string, unknown>;
	/** Non-characteristic values preserved for user queries. */
	extra: Record<string, unknown>;
	/** Full parsed row, including characteristic and extra values. */
	raw: Record<string, unknown>;
}

/**
 * Characteristic city fields required by the base network.
 *
 * Optional user columns remain in the referenced `SourceRecord`.
 */
export interface BaseCityCharacteristic {
	cityCode: number;
	latitude: number;
	longitude: number;
	/**
	 * Optional local radius. Some source datasets use `NA`; the value is
	 * therefore nullable while the column remains characteristic.
	 */
	radius: number | null;
}

/**
 * Base city entity assembled from the `cities` source file.
 *
 * This is not the final prepared city used by render or compute. It is the
 * lossless network-level city entity.
 */
export interface BaseCity {
	id: number;
	characteristic: BaseCityCharacteristic;
	sourceRecordId: number;
	/** Source records from `cityLinkedAttributes`, grouped by original file. */
	linkedRecords: Record<string, number[]>;
	inEdgeIds: number[];
	outEdgeIds: number[];
}

/**
 * Characteristic edge fields from the transport network.
 *
 * Optional date columns and user columns remain available through the
 * referenced `SourceRecord`.
 */
export interface BaseEdgeCharacteristic {
	cityCodeOri: number;
	cityCodeDes: number;
	transportModeCode: number;
}

/** Base transport-network edge with stable references to related entities. */
export interface BaseEdge {
	id: number;
	characteristic: BaseEdgeCharacteristic;
	sourceRecordId: number;
	originCityId?: number;
	destinationCityId?: number;
	transportModeId?: number;
	derived: {
		/** Great-circle distance in kilometers when both endpoint cities exist. */
		distCrowKM?: number;
	};
}

/**
 * Characteristic transport mode fields.
 *
 * Derived speed tables are built during preparation.
 */
export interface BaseTransportModeCharacteristic {
	code: number;
	name: string;
	terrestrial: unknown;
}

/** Base transport mode assembled from the `transportModes` source file. */
export interface BaseTransportMode {
	id: number;
	characteristic: BaseTransportModeCharacteristic;
	sourceRecordId: number;
	speedRecordIds: number[];
}

/**
 * Base-network indexes.
 *
 * They intentionally store ids instead of object references to remain
 * serializable and ready for workers, caching, and later GPU-oriented buffers.
 */
export interface BaseNetworkIndexes {
	cityByCode: Record<string, number>;
	modeByCode: Record<string, number>;
	speedByModeAndYear: Record<string, number[]>;
	edgesByOrigin: Record<string, number[]>;
	edgesByDestination: Record<string, number[]>;
}

/**
 * One field available for user query mapping.
 *
 * This is a technical catalog only. It does not claim that a free column means
 * "population", "surface", or any other business concept until the user or a
 * dataset profile maps it explicitly.
 */
export interface QueryableField {
	sourceKind: DatasetFileKind;
	column: string;
	occurrences: number;
	characteristic: boolean;
}

/**
 * Lossless assembled base network.
 *
 * It keeps source records and relation indexes, but it does not produce
 * prepared static or dynamic geometry. Those structures belong to the next
 * preparation phase.
 */
export interface BaseNetwork {
	cities: BaseCity[];
	edges: BaseEdge[];
	transportModes: BaseTransportMode[];
	sourceRecords: SourceRecord[];
	indexes: BaseNetworkIndexes;
	fields: QueryableField[];
	diagnostics: DatasetDiagnostic[];
}

/** Options controlling preparation of speed timelines from a lossless base network. */
export interface PrepareSpeedTimelineOptions {
	/**
	 * Reference road mode name used by the differential model.
	 *
	 * Matching is case-insensitive and trimmed. The default value follows the
	 * dataset contract documented by the project.
	 */
	roadModeName?: string;
}

/** Unique reference to the road mode that defines the cone surface. */
export interface RoadModeReference {
	/** Dense mode id inside `BaseNetwork.transportModes`. */
	roadModeId: number;
	/** Source mode code found in the transport modes table. */
	roadModeCode: number;
}

/** Time validity bounds computed for one transport mode. */
export interface PreparedTransportModeTimeline {
	/** Dense mode id inside `BaseNetwork.transportModes`. */
	modeId: number;
	/** Source mode code. */
	modeCode: number;
	/** Source mode name. */
	name: string;
	/** True when the mode contributes to cone slopes rather than curves. */
	terrestrial: boolean;
	/** First year found in the speed table. */
	speedYearBegin: number | null;
	/** Last year found in the speed table. */
	speedYearEnd: number | null;
	/** First edge opening year, or `null` when edge dates do not constrain the mode. */
	edgeYearBegin: number | null;
	/** Last edge closing year, or `null` when edge dates do not constrain the mode. */
	edgeYearEnd: number | null;
	/** First year where both speed and edge availability make the mode valid. */
	yearBegin: number | null;
	/** Last year where both speed and edge availability make the mode valid. */
	yearEnd: number | null;
}

/** Inclusive time span where the differential model is computable. */
export interface PreparedTimeSpan {
	beginYear: number;
	endYear: number;
}

/** Prepared speed and cone angle for one mode and one year. */
export interface PreparedSpeedYear {
	/** Interpolated speed in meters per second. */
	speedMetersPerSecond: number;
	/** Cone slope angle in radians, derived from the speed ratio with the yearly maximum speed. */
	alphaRadians: number;
}

/** Prepared speed timeline used by later city, cone, curve, and GPU precomputes. */
export interface PreparedSpeedTimeline {
	/** Dense mode id for the reference road mode. */
	roadModeId: number;
	/** Source mode code for the reference road mode. */
	roadModeCode: number;
	/** Time span where the differential model is computable. */
	span: PreparedTimeSpan;
	/** Per-mode validity bounds. */
	modes: PreparedTransportModeTimeline[];
	/** Mode ids split by graphical role. */
	transportTypes: {
		/** Terrestrial modes affecting cone slopes. */
		cones: number[];
		/** Non-terrestrial modes represented as curves. */
		curves: number[];
	};
	/** Per-mode, per-year interpolated speed and alpha values. */
	speedByModeByYear: Record<string, Record<string, PreparedSpeedYear>>;
	/** Maximum available speed per year, in meters per second. */
	maxSpeedMetersPerSecondByYear: Record<string, number>;
	/** Minimum terrestrial alpha per year, in radians. */
	terrestrialMinAlphaRadiansByYear: Record<string, number>;
	/** Diagnostics emitted during preparation. */
	diagnostics: DatasetDiagnostic[];
}

/** Number of unsigned integer values used by one prepared directed edge. */
export const PREPARED_EDGE_STRIDE = 3;

/** Inclusive lower-year sentinel used when an edge has no opening bound. */
export const UNBOUNDED_EDGE_YEAR_BEGIN = -0x80000000;

/** Inclusive upper-year sentinel used when an edge has no closing bound. */
export const UNBOUNDED_EDGE_YEAR_END = 0x7fffffff;

/**
 * Compact, compute-ready dataset derived from a lossless {@link BaseNetwork}.
 *
 * The dataset preserves the stable order of base cities and modes. It keeps
 * source ids for traceability while measured values use internal SI units.
 */
export interface PreparedDataset {
	/** Number of cities represented by the compact buffers. */
	cityCount: number;
	/** Base-city ids in stable prepared city order. */
	cityIds: Uint32Array;
	/** City source-record ids in stable prepared city order. */
	citySourceRecordIds: Uint32Array;
	/** City codes in stable prepared city order. */
	cityCodes: Float64Array;
	/** Longitude/latitude pairs in radians with stride 2. */
	cityLonLatRadians: Float32Array;
	/** Dense city index keyed by source city code. */
	cityIndexByCode: Record<string, number>;
	/** Number of valid prepared directed edges. */
	edgeCount: number;
	/** Base-edge ids in prepared edge order. */
	edgeIds: Uint32Array;
	/** Edge source-record ids in prepared edge order. */
	edgeSourceRecordIds: Uint32Array;
	/**
	 * Directed edge tuples with stride {@link PREPARED_EDGE_STRIDE}.
	 *
	 * Each tuple is `[originCityIndex, destinationCityIndex, modeIndex]`.
	 */
	edges: Uint32Array;
	/** Inclusive opening year for each prepared edge, or {@link UNBOUNDED_EDGE_YEAR_BEGIN}. */
	edgeYearBegins: Int32Array;
	/** Inclusive closing year for each prepared edge, or {@link UNBOUNDED_EDGE_YEAR_END}. */
	edgeYearEnds: Int32Array;
	/** Number of transport modes in stable base-network order. */
	modeCount: number;
	/** Base-mode ids in stable prepared mode order. */
	modeIds: Uint32Array;
	/** Source transport-mode codes in stable prepared mode order. */
	modeCodes: Float64Array;
	/** Source-record ids for prepared transport modes. */
	modeSourceRecordIds: Uint32Array;
	/** Prepared speed timeline and graphical mode classification. */
	speedTimeline: PreparedSpeedTimeline;
	/**
	 * Known non-road edge pairs with stride 2.
	 *
	 * Order and duplicates follow prepared edge order.
	 */
	curveEdgePairs: Uint32Array;
	/** Base-edge ids corresponding one-to-one with `curveEdgePairs`. */
	curveEdgeIds: Uint32Array;
	/** Dense mode indexes corresponding one-to-one with `curveEdgePairs`. */
	curveEdgeModeIndexes: Uint32Array;
	/** Diagnostics emitted while preparing compact compute buffers. */
	diagnostics: DatasetDiagnostic[];
}
