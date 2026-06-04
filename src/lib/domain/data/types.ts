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
 * This corresponds to the source-oriented part of `ICity` in the `toBabylon`
 * merger interfaces. Optional user columns remain in the referenced
 * `SourceRecord`.
 */
export interface BaseCityCharacteristic {
	cityCode: number;
	latitude: number;
	longitude: number;
	/**
	 * Optional local radius. Some historical datasets use `NA`; the value is
	 * therefore nullable while the column remains characteristic.
	 */
	radius: number | null;
}

/**
 * Base city entity assembled from the `cities` source file.
 *
 * This is not the final prepared city used by render or compute. It is the
 * lossless network-level equivalent of the source-oriented subset of
 * `toBabylon`'s `ICity`.
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
 * This maps to the source-oriented part of `IEdge` in the `toBabylon`
 * interfaces. Optional date columns and user columns remain available through
 * the referenced `SourceRecord`.
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
 * This maps to `ITranspMode` in the `toBabylon` interfaces, excluding derived
 * speed tables that are built during preparation.
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
 * `BaseNetwork` is lower-level than `toBabylon`'s `IMergerData`: it keeps
 * source records and relation indexes, but it does not produce prepared static
 * or dynamic geometry. Those structures belong to the next preparation phase.
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

