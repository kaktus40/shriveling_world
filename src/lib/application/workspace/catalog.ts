import type GeoJSON from 'geojson';
import { inflate } from 'pako';
import {
	assembleBaseNetwork,
	inspectDatasetFiles,
	prepareDataset,
	resolveDatasetManifest,
	type BaseNetwork,
	type DatasetManifest,
	type InspectedDatasetFile,
	type PreparedDataset,
	type SourceFile,
} from '$lib/domain/data';

interface BundledDatasetEntry {
	name: string;
	text: string;
}

/** Common dataset workspace snapshot shared by future application routes. */
export interface WorkspaceDatasetSnapshot {
	datasetName: string;
	files: SourceFile[];
	pipeline: {
		inspectedFiles: InspectedDatasetFile[];
		manifest: DatasetManifest;
		baseNetwork: BaseNetwork;
		preparedDataset: PreparedDataset;
	};
	geojsonEntries: Array<{ fileName: string; geojson: GeoJSON.FeatureCollection }>;
}

/**
 * Loads the bundled dataset catalog for application routes.
 *
 * @param fetchFn Fetch implementation provided by SvelteKit or the browser.
 * @returns Sorted dataset archive names.
 */
export async function loadDatasetCatalog(fetchFn: typeof fetch): Promise<string[]> {
	const response = await fetchFn('/datasets/datasets.json');
	if (!response.ok) {
		throw new Error(`Unable to list bundled datasets: ${response.status} ${response.statusText}`);
	}
	return (await response.json()) as string[];
}

/**
 * Loads and prepares one dataset workspace snapshot for application routes.
 *
 * The snapshot keeps the lossless source files, the prepared domain pipeline,
 * and the parsed GeoJSON entries together so routes can build interactive
 * screens without re-implementing orchestration glue.
 *
 * @param fetchFn Fetch implementation provided by SvelteKit or the browser.
 * @param datasetName Archive name present in `static/datasets`.
 * @returns Workspace snapshot ready for UI consumption.
 */
export async function loadWorkspaceDataset(
	fetchFn: typeof fetch,
	datasetName: string,
): Promise<WorkspaceDatasetSnapshot> {
	const files = await loadBundledDatasetFiles(fetchFn, datasetName);
	return {
		datasetName,
		files,
		pipeline: runDatasetPipeline(files),
		geojsonEntries: extractGeoJsonFeatureCollections(files),
	};
}

/** Loads one compressed dataset archive and returns its source files. */
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

/** Runs the modern order-independent dataset pipeline on a source-file array. */
export function runDatasetPipeline(files: SourceFile[]) {
	const inspectedFiles = inspectDatasetFiles(files);
	const manifest = resolveDatasetManifest(inspectedFiles);
	if (!manifest.valid) {
		throw new Error(`Dataset manifest is invalid: ${JSON.stringify(manifest.diagnostics, null, 2)}`);
	}
	const baseNetwork = assembleBaseNetwork({ files, manifest });
	const preparedDataset = prepareDataset(baseNetwork);
	return { inspectedFiles, manifest, baseNetwork, preparedDataset };
}

/** Extracts every GeoJSON feature collection from a dataset source array. */
export function extractGeoJsonFeatureCollections(
	files: SourceFile[],
): Array<{ fileName: string; geojson: GeoJSON.FeatureCollection }> {
	return files
		.filter((file) => file.name.toLowerCase().endsWith('.geojson') || file.name.toLowerCase().endsWith('.json'))
		.map((file) => ({ fileName: file.name, geojson: JSON.parse(file.text) as GeoJSON.FeatureCollection }))
		.filter((entry) => entry.geojson.type === 'FeatureCollection');
}
