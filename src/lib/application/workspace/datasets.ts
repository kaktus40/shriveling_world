import type GeoJSON from 'geojson';
import type { SourceFile } from '$lib/domain/data';
import {
	extractGeoJsonFeatureCollections,
	loadBundledDatasetFiles,
	loadBundledDatasetNames,
	runDatasetPipeline,
	type DatasetPipelineResult,
} from '$lib/application/validation';

/** Common dataset workspace snapshot shared by future application routes. */
export interface DatasetWorkspaceSnapshot {
	datasetName: string;
	files: SourceFile[];
	pipeline: DatasetPipelineResult;
	geojsonEntries: Array<{ fileName: string; geojson: GeoJSON.FeatureCollection }>;
}

/**
 * Loads the bundled dataset catalog for application routes.
 *
 * @param fetchFn Fetch implementation provided by SvelteKit or the browser.
 * @returns Sorted dataset archive names.
 */
export async function loadDatasetCatalog(fetchFn: typeof fetch): Promise<string[]> {
	return loadBundledDatasetNames(fetchFn);
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
export async function loadDatasetWorkspace(
	fetchFn: typeof fetch,
	datasetName: string,
): Promise<DatasetWorkspaceSnapshot> {
	const files = await loadBundledDatasetFiles(fetchFn, datasetName);
	return {
		datasetName,
		files,
		pipeline: runDatasetPipeline(files),
		geojsonEntries: extractGeoJsonFeatureCollections(files),
	};
}
