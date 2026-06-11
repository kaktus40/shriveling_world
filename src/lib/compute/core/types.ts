import type GeoJSON from 'geojson';
import type {
	BoundaryPrecompute,
	BoundaryPrecomputeOptions,
	BoundaryRaycastResult,
} from '../../domain/geojson';
import type {
	BaseNetwork,
	DatasetDiagnostic,
	InspectedDatasetFile,
	PreparedDataset,
	SourceFile,
} from '../../domain/data';
import type {
	AlphaAwareBlockPrunedConeIntersectionPrecompute,
	AlphaAwareConeIntersectionPrecompute,
	ConeIntersectionOraclePrecompute,
	ConeShape,
	AlphaAwareConeIntersectionOptions,
	AlphaAwareBlockPrunedConeIntersectionOptions,
	DynamicTownPrecompute,
	RawConePrecompute,
	RawConePrecomputeOptions,
	SymmetricConeIntersectionPrecompute,
	StaticTownPrecompute,
	StaticTownPrecomputeOptions,
} from '../../domain/precompute';

/** Compute backends supported by the migration framework. */
export type ComputeProfile = 'webgpu' | 'webgl2' | 'cpu';

/** Available cone-intersection strategies supported by the compute workflow. */
export type ComputeConeIntersectionStrategy =
	| 'oracle'
	| 'symmetric-order'
	| 'alpha-aware-order'
	| 'alpha-aware-block-pruned';

/** Stable pipeline stage names used for benchmark comparison. */
export type ComputeStage =
	| 'csv-ingestion'
	| 'geojson-ingestion'
	| 'dataset-manifest'
	| 'base-network-assembly'
	| 'prepared-dataset'
	| 'geojson-boundary-precompute'
	| 'geojson-boundary-raycast'
	| 'static-town-precompute'
	| 'dynamic-town-precompute'
	| 'raw-cones-precompute'
	| 'cone-intersections-precompute'
	| 'total';

/** Phase family used to classify benchmark timings. */
export type ComputeStageScope = 'ingestion' | 'precompute' | 'interactive';

/** Request used to choose a compute profile. */
export interface ComputeProfileRequest {
	/** Preferred profile when several backends are available. */
	preferred?: ComputeProfile;
	/** Forced profile. When unavailable, the selection may fallback explicitly. */
	forced?: ComputeProfile;
	/** Whether the selector may fallback to the next available profile. */
	allowFallback?: boolean;
}

/** Capability snapshot observed while selecting a profile. */
export interface ComputeCapabilities {
	readonly webgpuAvailable: boolean;
	readonly webgl2Available: boolean;
	readonly cpuAvailable: true;
	readonly notes: readonly string[];
}

/** Result of one profile selection decision. */
export interface ComputeProfileSelection {
	readonly requested?: ComputeProfile;
	readonly forced?: ComputeProfile;
	readonly selected: ComputeProfile;
	readonly fallbackUsed: boolean;
	readonly fallbackFrom?: ComputeProfile;
	readonly reason?: string;
	readonly capabilities: ComputeCapabilities;
}

/** One measured stage timing. */
export interface StageTiming {
	readonly stage: ComputeStage;
	readonly scope: ComputeStageScope;
	readonly profile: ComputeProfile;
	readonly startedAtMs: number;
	readonly endedAtMs: number;
	readonly durationMs: number;
}

/** Comparable benchmark report emitted by a compute workflow execution. */
export interface ComputeBenchmarkReport {
	readonly profile: ComputeProfile;
	readonly timings: readonly StageTiming[];
	readonly totalDurationMs: number;
	readonly notes: readonly string[];
}

/** Compute workflow input shared by every profile backend. */
export interface ComputeWorkflowInput {
	/** Source files provided by a dataset archive or a user import. */
	readonly sourceFiles: readonly SourceFile[];
	/** Optional GeoJSON source files already extracted by the caller. */
	readonly geojsonSources?: readonly {
		fileName: string;
		geojson: GeoJSON.FeatureCollection;
	}[];
}

/** Parameters controlling the boundary preprocessing phase. */
export interface ComputeBoundaryOptions {
	readonly boundaryPrecompute?: Partial<BoundaryPrecomputeOptions>;
	readonly boundaryRaycast?: {
		readonly azimuthSampleCount?: number;
	};
}

/** Parameters controlling the static-town and cone-precompute phases. */
export interface ComputePrecomputeOptions {
	readonly staticTown?: StaticTownPrecomputeOptions;
	readonly dynamicYear?: number;
	readonly rawCone?: RawConePrecomputeOptions;
	readonly coneIntersection?: {
		readonly enabled?: boolean;
		readonly strategy?: ComputeConeIntersectionStrategy;
		readonly alphaAware?: Partial<AlphaAwareConeIntersectionOptions> &
			Partial<Pick<AlphaAwareBlockPrunedConeIntersectionOptions, 'blockFaceCount' | 'pruningEnabled'>>;
	};
}

/** Whole workflow options. */
export interface ComputeWorkflowOptions extends ComputeBoundaryOptions, ComputePrecomputeOptions {
	readonly profileRequest?: ComputeProfileRequest;
	readonly benchmark?: boolean;
}

/** Result of one GeoJSON boundary run. */
export interface ComputeBoundaryRunResult {
	readonly fileName: string;
	readonly geojson: GeoJSON.FeatureCollection;
	readonly boundaryPrecompute: BoundaryPrecompute;
	readonly boundaryRaycast: BoundaryRaycastResult;
}

/** Result of the complete compute workflow. */
export interface ComputeWorkflowResult {
	readonly selection: ComputeProfileSelection;
	readonly inspectedFiles: readonly InspectedDatasetFile[];
	readonly baseNetwork: BaseNetwork;
	readonly preparedDataset: PreparedDataset;
	readonly geojsonRuns: readonly ComputeBoundaryRunResult[];
	readonly staticTown?: StaticTownPrecompute;
	readonly dynamicTown?: DynamicTownPrecompute;
	readonly rawCones?: RawConePrecompute;
	readonly coneIntersections?:
		| ConeIntersectionOraclePrecompute
		| SymmetricConeIntersectionPrecompute
		| AlphaAwareConeIntersectionPrecompute
		| AlphaAwareBlockPrunedConeIntersectionPrecompute;
	readonly diagnostics: readonly DatasetDiagnostic[];
	readonly benchmark: ComputeBenchmarkReport;
}

/** Lifecycle contract shared by every compute backend. */
export interface ComputeWorkflowBackend {
	readonly profile: ComputeProfile;
	run(
		input: ComputeWorkflowInput,
		options?: ComputeWorkflowOptions,
		selection?: ComputeProfileSelection,
	): Promise<ComputeWorkflowResult>;
	dispose(): Promise<void>;
}

/** Descriptor used to register a workflow backend in the selector. */
export interface ComputeWorkflowBackendDescriptor {
	readonly profile: ComputeProfile;
	isAvailable(): boolean | Promise<boolean>;
	create(): Promise<ComputeWorkflowBackend>;
}

/** Registry used to select the first usable backend in the fallback chain. */
export interface ComputeWorkflowBackendRegistry {
	readonly cpu: ComputeWorkflowBackendDescriptor;
	readonly webgl2?: ComputeWorkflowBackendDescriptor;
	readonly webgpu?: ComputeWorkflowBackendDescriptor;
}

/** Optional inputs for raw-cone and cone-intersection phases. */
export interface ComputeConeWorkflowOptions {
	readonly year: number;
	readonly shape: ConeShape;
	readonly azimuthSampleCount: number;
	readonly neighborLimit: number;
	readonly sectorCount: number;
	readonly coneLengthMeters: number;
	readonly attenuationRadians?: number;
}
