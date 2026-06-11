import { inflate } from 'pako';
import type GeoJSON from 'geojson';
import {
	assembleBaseNetwork,
	inspectDatasetFiles,
	prepareDataset,
	resolveDatasetManifest,
	toStaticTownInput,
	type BaseNetwork,
	type DatasetManifest,
	type InspectedDatasetFile,
	type PreparedDataset,
	type SourceFile,
} from '$lib/domain/data';
import {
	buildAzimuthIntervals,
	buildCityNed2EcefMatrices,
	computeTownBoundaryLimitsCpu,
	packAzimuthIntervals,
	prepareBoundaryPrecompute,
	type BoundaryPrecompute,
	type BoundaryRaycastResult,
	type TownBoundaryInput,
} from '$lib/domain/geojson';
import {
	computeConeIntersectionOracleCpu,
	computeDynamicTownPrecomputeForYearCpu,
	computeRawConePrecomputeCpu,
	computeStaticTownPrecomputeCpu,
	type ConeIntersectionOraclePrecompute,
	type ConeShape,
	type DynamicTownPrecompute,
	type RawConePrecompute,
	type StaticTownPrecompute,
} from '$lib/domain/precompute';
import { EARTH_RADIUS_METERS, PI } from '$lib/shared';

/** Result of the order-independent dataset pipeline used by the validation routes. */
export interface DatasetPipelineResult {
	inspectedFiles: InspectedDatasetFile[];
	manifest: DatasetManifest;
	baseNetwork: BaseNetwork;
	preparedDataset: PreparedDataset;
}

/** Result of the GeoJSON-specific validation pipeline. */
export interface BoundaryPipelineResult {
	geojson: GeoJSON.FeatureCollection;
	townInputs: TownBoundaryInput[];
	boundaryPrecompute: BoundaryPrecompute;
	boundaryRaycast: BoundaryRaycastResult;
}

/** Options controlling the CPU cone-validation route. */
export interface ConePipelineOptions {
	year: number;
	shape: ConeShape;
	azimuthSampleCount: number;
	neighborLimit: number;
	sectorCount: number;
	coneLengthMeters: number;
	attenuationRadians: number;
}

/** Result of the CPU cone-validation pipeline. */
export interface ConePipelineResult {
	staticTown: StaticTownPrecompute;
	dynamicTown: DynamicTownPrecompute;
	rawCones: RawConePrecompute;
	coneIntersections: ConeIntersectionOraclePrecompute;
}

interface BundledDatasetEntry {
	name: string;
	text: string;
}

/**
 * Loads the list of bundled compressed datasets generated in `static/datasets`.
 *
 * This service is application-facing: routes and interactive validation pages
 * use it to discover the catalog without importing data-domain internals.
 *
 * @param fetchFn Fetch implementation provided by SvelteKit or the browser.
 * @returns Sorted dataset archive names.
 */
export async function loadBundledDatasetNames(fetchFn: typeof fetch): Promise<string[]> {
	const response = await fetchFn('/datasets/datasets.json');
	if (!response.ok) {
		throw new Error(`Unable to list bundled datasets: ${response.status} ${response.statusText}`);
	}
	return (await response.json()) as string[];
}

/**
 * Loads one compressed dataset archive and returns its source files.
 *
 * @param fetchFn Fetch implementation provided by SvelteKit or the browser.
 * @param datasetName Archive name present in `static/datasets`.
 * @returns Source files preserving their original names and contents.
 */
export async function loadBundledDatasetFiles(fetchFn: typeof fetch, datasetName: string): Promise<SourceFile[]> {
	const response = await fetchFn(`/datasets/${datasetName}`);
	if (!response.ok) {
		throw new Error(`Unable to load dataset "${datasetName}": ${response.status} ${response.statusText}`);
	}

	const compressed = new Uint8Array(await response.arrayBuffer());
	const decoded = new TextDecoder('utf8').decode(inflate(compressed));
	const entries = JSON.parse(decoded) as BundledDatasetEntry[];
	return entries.map(({ name, text }) => ({ name, text }));
}

/**
 * Runs the modern order-independent dataset pipeline on a source-file array.
 *
 * This function bridges the application layer and the data domain. Routes call
 * one orchestrator instead of importing inspection, manifest resolution,
 * assembly, and prepared-buffer generation separately.
 *
 * @param files Source files coming from a bundled dataset or another provider.
 * @returns Inspection, manifest, lossless network, and compact prepared dataset.
 */
export function runDatasetPipeline(files: SourceFile[]): DatasetPipelineResult {
	const inspectedFiles = inspectDatasetFiles(files);
	const manifest = resolveDatasetManifest(inspectedFiles);
	if (!manifest.valid) {
		throw new Error(`Dataset manifest is invalid: ${JSON.stringify(manifest.diagnostics, null, 2)}`);
	}
	const baseNetwork = assembleBaseNetwork({ files, manifest });
	const preparedDataset = prepareDataset(baseNetwork);
	return { inspectedFiles, manifest, baseNetwork, preparedDataset };
}

/**
 * Extracts every GeoJSON feature collection from a dataset source array.
 *
 * @param files Source files read from a dataset archive.
 * @returns Parsed GeoJSON feature collections with their original file names.
 */
export function extractGeoJsonFeatureCollections(
	files: SourceFile[],
): Array<{ fileName: string; geojson: GeoJSON.FeatureCollection }> {
	return files
		.filter((file) => file.name.toLowerCase().endsWith('.geojson') || file.name.toLowerCase().endsWith('.json'))
		.map((file) => ({ fileName: file.name, geojson: JSON.parse(file.text) as GeoJSON.FeatureCollection }))
		.filter((entry) => entry.geojson.type === 'FeatureCollection');
}

/**
 * Adapts the compact prepared dataset to the GeoJSON boundary-input contract.
 *
 * @param preparedDataset Dataset prepared in stable city order.
 * @returns City positions expressed in radians and keyed by dense city ids/codes.
 */
export function buildTownBoundaryInputs(preparedDataset: PreparedDataset): TownBoundaryInput[] {
	return Array.from({ length: preparedDataset.cityCount }, (_, cityIndex) => ({
		cityId: preparedDataset.cityIds[cityIndex],
		cityCode: preparedDataset.cityCodes[cityIndex],
		longitudeRadians: preparedDataset.cityLonLatRadians[cityIndex * 2],
		latitudeRadians: preparedDataset.cityLonLatRadians[cityIndex * 2 + 1],
	}));
}

/**
 * Runs the modern GeoJSON preparation plus the CPU raycast reference.
 *
 * @param geojson GeoJSON feature collection retained for the dataset.
 * @param preparedDataset Compact prepared dataset in stable city order.
 * @param azimuthSampleCount Number of azimuth intervals used to sample boundaries.
 * @returns Country pre-geometry, town-to-contour association, and CPU limits.
 */
export function runBoundaryPipeline(
	geojson: GeoJSON.FeatureCollection,
	preparedDataset: PreparedDataset,
	azimuthSampleCount = 360,
): BoundaryPipelineResult {
	const townInputs = buildTownBoundaryInputs(preparedDataset);
	const boundaryPrecompute = prepareBoundaryPrecompute(geojson, townInputs, {
		azimuthSampleCount,
	});
	const boundaryRaycast = computeTownBoundaryLimitsCpu({
		cityNed2EcefMatrices: buildCityNed2EcefMatrices(townInputs),
		cityContourIndexes: boundaryPrecompute.cityContourIndexes,
		countryContourNVectorBuffer: boundaryPrecompute.countryContourNVectorBuffer,
		countryContourOffsets: boundaryPrecompute.countryContourOffsets,
		countryContourSizes: boundaryPrecompute.countryContourSizes,
		azimuthIntervals: packAzimuthIntervals(buildAzimuthIntervals(azimuthSampleCount)),
		earthRadiusMeters: EARTH_RADIUS_METERS,
	});

	return {
		geojson,
		townInputs,
		boundaryPrecompute,
		boundaryRaycast,
	};
}

/**
 * Runs the current CPU cone-precompute tranche used by the migration tests.
 *
 * @param preparedDataset Compact prepared dataset.
 * @param options Parameters controlling the CPU reference stages.
 * @returns Static invariants, one-year dynamic links, raw cones, and cone intersections.
 */
export function runConePipeline(
	preparedDataset: PreparedDataset,
	options: ConePipelineOptions,
): ConePipelineResult {
	const staticTown = computeStaticTownPrecomputeCpu(toStaticTownInput(preparedDataset), {
		sectorCount: options.sectorCount,
		neighborLimit: options.neighborLimit,
	});
	const dynamicTown = computeDynamicTownPrecomputeForYearCpu(preparedDataset, staticTown, options.year);
	const rawCones = computeRawConePrecomputeCpu(staticTown, dynamicTown, {
		shape: options.shape,
		azimuthSampleCount: options.azimuthSampleCount,
		coneLengthMeters: options.coneLengthMeters,
		attenuationRadians: options.shape === 'complex' ? options.attenuationRadians : undefined,
	});
	const coneIntersections = computeConeIntersectionOracleCpu(staticTown, rawCones);
	return { staticTown, dynamicTown, rawCones, coneIntersections };
}

/** Returns a conservative default cone-validation configuration for one dataset. */
export function createDefaultConePipelineOptions(preparedDataset: PreparedDataset): ConePipelineOptions {
	return {
		year: preparedDataset.speedTimeline.span.beginYear,
		shape: 'complex',
		azimuthSampleCount: 360,
		neighborLimit: Math.min(Math.max(preparedDataset.cityCount - 1, 0), 16),
		sectorCount: 360,
		coneLengthMeters: EARTH_RADIUS_METERS * 0.25,
		attenuationRadians: PI / 6,
	};
}
