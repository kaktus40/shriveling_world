import type GeoJSON from 'geojson';
import {
	assembleBaseNetwork,
	inspectDatasetFiles,
	prepareDataset,
	resolveDatasetManifest,
	toStaticTownInput,
	type DatasetDiagnostic,
	type InspectedDatasetFile,
	type PreparedDataset,
	type SourceFile,
} from '../../domain/data';
import {
	buildAzimuthIntervals,
	buildCityNed2EcefMatrices,
	computeTownBoundaryLimitsCpu,
	packAzimuthIntervals,
	prepareBoundaryPrecompute,
	type BoundaryDiagnostic,
	type BoundaryPrecompute,
	type BoundaryPrecomputeOptions,
	type BoundaryRaycastResult,
	type TownBoundaryInput,
} from '../../domain/geojson';
import {
	computeConeIntersectionOracleCpu,
	computeDynamicTownPrecomputeForYearCpu,
	computeRawConePrecomputeCpu,
	computeStaticTownPrecomputeCpu,
	type ConeIntersectionOraclePrecompute,
	type DynamicTownPrecompute,
	type RawConePrecompute,
	type RawConePrecomputeOptions,
	type StaticTownPrecompute,
	type StaticTownPrecomputeOptions,
} from '../../domain/precompute';
import { EARTH_RADIUS_METERS } from '../../shared';
import type {
	ComputeBenchmarkReport,
	ComputeCapabilities,
	ComputeProfileSelection,
	ComputeWorkflowBackendDescriptor,
	ComputeWorkflowBackendRegistry,
	ComputeWorkflowBackend,
	ComputeWorkflowInput,
	ComputeWorkflowOptions,
	ComputeWorkflowResult,
	StageTiming,
} from '../core/types';
import { measureStage, sumStageDurations } from '../core/timing';

interface GeojsonRunBuffer {
	fileName: string;
	geojson: GeoJSON.FeatureCollection;
}

/** CPU reference backend for the whole migration workflow. */
export class CpuComputeWorkflowBackend implements ComputeWorkflowBackend {
	readonly profile = 'cpu' as const;

	async run(
		input: ComputeWorkflowInput,
		options: ComputeWorkflowOptions = {},
		selection?: ComputeProfileSelection,
	): Promise<ComputeWorkflowResult> {
		const timings: StageTiming[] = [];
		const notes: string[] = [];
		const diagnostics: DatasetDiagnostic[] = [];
		const boundaryDiagnostics: BoundaryDiagnostic[] = [];
		const sourceFiles = [...input.sourceFiles];

		const { value: inspectedFiles, timing: csvTiming } = measureStage(
			'csv-ingestion',
			'ingestion',
			this.profile,
			() => inspectDatasetFiles(sourceFiles),
		);
		timings.push(csvTiming);

		const geojsonSources = resolveGeojsonSources(sourceFiles, inspectedFiles, input.geojsonSources);
		const { value: manifest, timing: manifestTiming } = measureStage(
			'dataset-manifest',
			'ingestion',
			this.profile,
			() => resolveDatasetManifest(inspectedFiles),
		);
		timings.push(manifestTiming);
		diagnostics.push(...manifest.diagnostics);

		if (!manifest.valid) {
			throw new Error(`Dataset manifest is invalid: ${JSON.stringify(manifest.diagnostics, null, 2)}`);
		}

		const { value: baseNetwork, timing: assemblyTiming } = measureStage(
			'base-network-assembly',
			'ingestion',
			this.profile,
			() => assembleBaseNetwork({ files: sourceFiles, manifest }),
		);
		timings.push(assemblyTiming);
		diagnostics.push(...baseNetwork.diagnostics);

		const { value: preparedDataset, timing: preparedTiming } = measureStage(
			'prepared-dataset',
			'precompute',
			this.profile,
			() => prepareDataset(baseNetwork),
		);
		timings.push(preparedTiming);
		diagnostics.push(...preparedDataset.diagnostics);

		const geojsonRuns = geojsonSources.map((source) => {
			const geojsonRun = runBoundaryWorkflow(
				source.fileName,
				source.geojson,
				preparedDataset,
				options,
				boundaryDiagnostics,
			);
			timings.push(geojsonRun.precomputeTiming, geojsonRun.raycastTiming);
			return geojsonRun;
		});

		const staticTownOptions = resolveStaticTownOptions(preparedDataset, options.staticTown);
		const { value: staticTown, timing: staticTiming } = measureStage(
			'static-town-precompute',
			'precompute',
			this.profile,
			() => computeStaticTownPrecomputeCpu(toStaticTownInput(preparedDataset), staticTownOptions),
		);
		timings.push(staticTiming);

		let dynamicTown: DynamicTownPrecompute | undefined;
		let rawCones: RawConePrecompute | undefined;
		let coneIntersections: ConeIntersectionOraclePrecompute | undefined;

		const dynamicYear = options.dynamicYear ?? preparedDataset.speedTimeline.span.beginYear;
		if (Number.isFinite(dynamicYear)) {
			const dynamicTiming = measureStage(
				'dynamic-town-precompute',
				'precompute',
				this.profile,
				() => computeDynamicTownPrecomputeForYearCpu(preparedDataset, staticTown, dynamicYear),
			);
			dynamicTown = dynamicTiming.value;
			timings.push(dynamicTiming.timing);
		}

		if (options.rawCone && dynamicTown) {
			const rawConeTiming = measureStage(
				'raw-cones-precompute',
				'precompute',
				this.profile,
				() => computeRawConePrecomputeCpu(staticTown, dynamicTown as DynamicTownPrecompute, options.rawCone as RawConePrecomputeOptions),
			);
			rawCones = rawConeTiming.value;
			timings.push(rawConeTiming.timing);
		}

		if (options.coneIntersection?.enabled !== false && rawCones) {
			const coneTiming = measureStage(
				'cone-intersections-precompute',
				'interactive',
				this.profile,
				() => computeConeIntersectionOracleCpu(staticTown, rawCones as RawConePrecompute),
			);
			coneIntersections = coneTiming.value;
			timings.push(coneTiming.timing);
		}

		const benchmark: ComputeBenchmarkReport = {
			profile: this.profile,
			timings,
			totalDurationMs: sumStageDurations(timings),
			notes,
		};

		return {
			selection: selection ?? cpuSelection(),
			inspectedFiles,
			baseNetwork,
			preparedDataset,
			geojsonRuns,
			staticTown,
			dynamicTown,
			rawCones,
			coneIntersections,
		diagnostics: [
			...tagDiagnostics(diagnostics, this.profile),
			...tagDiagnostics(boundaryDiagnostics, this.profile),
		],
			benchmark,
		};
	}

	async dispose(): Promise<void> {
		// CPU backend owns no external resource yet.
	}
}

/** Returns a CPU-only selection snapshot for standalone backend use. */
export function cpuSelection(): ComputeProfileSelection {
	return {
		selected: 'cpu',
		fallbackUsed: false,
		capabilities: cpuCapabilities(),
	};
}

/** Returns the capability snapshot of the CPU backend. */
export function cpuCapabilities(): ComputeCapabilities {
	return {
		webgpuAvailable: false,
		webgl2Available: false,
		cpuAvailable: true,
		notes: ['CPU reference backend'],
	};
}

/** Creates the default CPU backend descriptor. */
export function createCpuWorkflowBackend(): CpuComputeWorkflowBackend {
	return new CpuComputeWorkflowBackend();
}

/** Creates a CPU-only registry that is always available. */
export function createDefaultComputeWorkflowRegistry(): ComputeWorkflowBackendRegistry {
	return {
		cpu: createCpuWorkflowBackendDescriptor(),
	};
}

/** Creates a CPU backend descriptor suitable for profile selection. */
export function createCpuWorkflowBackendDescriptor(): ComputeWorkflowBackendDescriptor {
	return {
		profile: 'cpu',
		isAvailable: () => true,
		create: async () => createCpuWorkflowBackend(),
	};
}

function resolveStaticTownOptions(
	preparedDataset: PreparedDataset,
	override?: Partial<StaticTownPrecomputeOptions>,
): StaticTownPrecomputeOptions {
	return {
		sectorCount: override?.sectorCount ?? 360,
		neighborLimit: override?.neighborLimit ?? Math.min(Math.max(preparedDataset.cityCount - 1, 0), 16),
	};
}

function resolveGeojsonSources(
	sourceFiles: readonly SourceFile[],
	inspectedFiles: readonly InspectedDatasetFile[],
	overrideSources?: readonly GeojsonRunBuffer[],
): GeojsonRunBuffer[] {
	if (overrideSources && overrideSources.length > 0) {
		return [...overrideSources];
	}

	const sourceFilesByName = new Map(sourceFiles.map((file) => [file.name, file]));
	return inspectedFiles
		.filter((file) => file.kind === 'geojson')
		.map((file) => {
			const sourceFile = sourceFilesByName.get(file.originalName);
			if (!sourceFile) {
				throw new Error(`Missing GeoJSON source file: ${file.originalName}`);
			}
			return {
				fileName: file.originalName,
				geojson: JSON.parse(sourceFile.text) as GeoJSON.FeatureCollection,
			};
	});
}

function tagDiagnostics<T extends { severity: 'warning' | 'error'; code: string; profile?: string }>(
	diagnostics: readonly T[],
	profile: string,
): T[] {
	return diagnostics.map((diagnostic) =>
		diagnostic.profile === profile ? diagnostic : { ...diagnostic, profile },
	);
}

function runBoundaryWorkflow(
	fileName: string,
	geojson: GeoJSON.FeatureCollection,
	preparedDataset: PreparedDataset,
	options: ComputeWorkflowOptions,
	diagnostics: BoundaryDiagnostic[],
): {
	fileName: string;
	geojson: GeoJSON.FeatureCollection;
	boundaryPrecompute: BoundaryPrecompute;
	boundaryRaycast: BoundaryRaycastResult;
	precomputeTiming: StageTiming;
	raycastTiming: StageTiming;
} {
	const townInputs = buildTownBoundaryInputs(preparedDataset);
	const boundaryOptions: Partial<BoundaryPrecomputeOptions> = {
		azimuthSampleCount: options.boundaryRaycast?.azimuthSampleCount ?? 360,
		...options.boundaryPrecompute,
	};
	const precomputeTimed = measureStage(
		'geojson-boundary-precompute',
		'precompute',
		'cpu',
		() => prepareBoundaryPrecompute(geojson, townInputs, boundaryOptions),
	);
	diagnostics.push(...precomputeTimed.value.diagnostics);
	const boundaryPrecompute = precomputeTimed.value;
	const raycastTimed = measureStage(
		'geojson-boundary-raycast',
		'precompute',
		'cpu',
		() =>
			computeTownBoundaryLimitsCpu({
				cityNed2EcefMatrices: buildCityNed2EcefMatrices(townInputs, EARTH_RADIUS_METERS),
				cityContourIndexes: boundaryPrecompute.cityContourIndexes,
				countryContourNVectorBuffer: boundaryPrecompute.countryContourNVectorBuffer,
				countryContourOffsets: boundaryPrecompute.countryContourOffsets,
				countryContourSizes: boundaryPrecompute.countryContourSizes,
				azimuthIntervals: packAzimuthIntervals(buildAzimuthIntervals(boundaryPrecompute.azimuthSampleCount)),
				earthRadiusMeters: EARTH_RADIUS_METERS,
			}),
	);
	diagnostics.push(...raycastTimed.value.diagnostics);

	return {
		fileName,
		geojson,
		boundaryPrecompute,
		boundaryRaycast: raycastTimed.value,
		precomputeTiming: precomputeTimed.timing,
		raycastTiming: raycastTimed.timing,
	};
}

function buildTownBoundaryInputs(preparedDataset: PreparedDataset): TownBoundaryInput[] {
	return Array.from({ length: preparedDataset.cityCount }, (_, cityIndex) => ({
		cityId: preparedDataset.cityIds[cityIndex],
		cityCode: preparedDataset.cityCodes[cityIndex],
		longitudeRadians: preparedDataset.cityLonLatRadians[cityIndex * 2],
		latitudeRadians: preparedDataset.cityLonLatRadians[cityIndex * 2 + 1],
	}));
}
