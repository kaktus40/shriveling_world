import type GeoJSON from 'geojson';
import {
	PreparedCityView,
	type DatasetDiagnostic,
	type PreparedTransportModeTimeline,
	type QueryableField,
	type SourceFile,
} from '$lib/domain/data';
import {
	createDefaultComputeWorkflowRegistry,
	selectComputeProfile,
	type ComputeBenchmarkReport,
	type ComputeProfile,
	type ComputeProfileSelection,
	type ComputeWorkflowResult,
} from '$lib/compute';
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

/** Compute profile and benchmark exposed by the dataset workspace. */
export interface DatasetWorkspaceCompute {
	selection: ComputeProfileSelection;
	benchmark: ComputeBenchmarkReport;
	result: ComputeWorkflowResult;
}

/** Aggregated counts exposed by the workspace route. */
export interface DatasetWorkspaceSummary {
	datasetName: string;
	sourceFileCount: number;
	inspectedFileCount: number;
	geojsonFileCount: number;
	cityCount: number;
	edgeCount: number;
	modeCount: number;
	queryableFieldCount: number;
	diagnosticCount: number;
	errorCount: number;
	warningCount: number;
	yearBegin: number;
	yearEnd: number;
}

/** Profile request supported by the workspace compute preview. */
export interface WorkspaceComputeRequest {
	profile?: ComputeProfile;
	forced?: ComputeProfile;
	allowFallback?: boolean;
	benchmark?: boolean;
}

/** Prepared transport mode exposed by the workspace route. */
export interface WorkspaceModeSummary {
	modeIndex: number;
	modeCode: number;
	name: string;
	terrestrial: boolean;
	yearBegin: number | null;
	yearEnd: number | null;
	speedYearBegin: number | null;
	speedYearEnd: number | null;
	edgeYearBegin: number | null;
	edgeYearEnd: number | null;
}

/** Dense city preview exposed by the workspace route. */
export interface WorkspaceCitySummary {
	cityIndex: number;
	cityId: number;
	cityCode: number;
	longitudeRadians: number;
	latitudeRadians: number;
	linkedRecordCount: number;
	inEdgeCount: number;
	outEdgeCount: number;
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

/**
 * Runs the compute backend on one workspace snapshot.
 *
 * The current migration ships the CPU reference backend first. The same
 * contract will later be used by WebGL2 and WebGPU without changing the
 * workspace API.
 *
 * @param workspace Prepared workspace snapshot.
 * @param request Optional profile request used to force or prefer a profile.
 * @returns Compute selection and benchmark report.
 */
export async function runDatasetWorkspaceCompute(
	workspace: DatasetWorkspaceSnapshot,
	request: WorkspaceComputeRequest = {},
): Promise<DatasetWorkspaceCompute> {
	const registry = createDefaultComputeWorkflowRegistry();
	const selection = await selectComputeProfile(
		{
			preferred: request.profile,
			forced: request.forced,
			allowFallback: request.allowFallback ?? true,
		},
		registry,
	);
	const backend = await registry.cpu.create();
	try {
		const result = await backend.run(
			{
				sourceFiles: workspace.files,
				geojsonSources: workspace.geojsonEntries,
			},
			{
				profileRequest: {
					preferred: request.profile,
					forced: request.forced,
					allowFallback: request.allowFallback ?? true,
				},
				benchmark: request.benchmark ?? true,
				boundaryRaycast: { azimuthSampleCount: 360 },
				staticTown: { sectorCount: 360, neighborLimit: Math.min(Math.max(workspace.pipeline.preparedDataset.cityCount - 1, 0), 16) },
				dynamicYear: workspace.pipeline.preparedDataset.speedTimeline.span.beginYear,
				rawCone: undefined,
				coneIntersection: { enabled: false },
			},
			selection,
		);
		return {
			selection,
			benchmark: result.benchmark,
			result,
		};
	} finally {
		await backend.dispose();
	}
}

/**
 * Summarizes one workspace snapshot for a dataset-oriented application screen.
 *
 * @param workspace Prepared workspace snapshot.
 * @returns High-level counts and diagnostic totals.
 */
export function summarizeDatasetWorkspace(workspace: DatasetWorkspaceSnapshot): DatasetWorkspaceSummary {
	const diagnostics = workspace.pipeline.preparedDataset.diagnostics;
	return {
		datasetName: workspace.datasetName,
		sourceFileCount: workspace.files.length,
		inspectedFileCount: workspace.pipeline.inspectedFiles.length,
		geojsonFileCount: workspace.geojsonEntries.length,
		cityCount: workspace.pipeline.preparedDataset.cityCount,
		edgeCount: workspace.pipeline.preparedDataset.edgeCount,
		modeCount: workspace.pipeline.preparedDataset.modeCount,
		queryableFieldCount: workspace.pipeline.baseNetwork.fields.length,
		diagnosticCount: diagnostics.length,
		errorCount: countDiagnostics(diagnostics, 'error'),
		warningCount: countDiagnostics(diagnostics, 'warning'),
		yearBegin: workspace.pipeline.preparedDataset.speedTimeline.span.beginYear,
		yearEnd: workspace.pipeline.preparedDataset.speedTimeline.span.endYear,
	};
}

/**
 * Returns stable prepared mode summaries for application pages.
 *
 * @param workspace Prepared workspace snapshot.
 * @returns One summary row per prepared transport mode.
 */
export function listWorkspaceModes(workspace: DatasetWorkspaceSnapshot): WorkspaceModeSummary[] {
	return workspace.pipeline.preparedDataset.speedTimeline.modes.map((mode, modeIndex) =>
		summarizeMode(mode, modeIndex),
	);
}

/**
 * Returns stable city previews suitable for dataset workspace pages.
 *
 * @param workspace Prepared workspace snapshot.
 * @param limit Maximum number of cities to expose.
 * @returns Dense city summaries in prepared order.
 */
export function listWorkspaceCities(
	workspace: DatasetWorkspaceSnapshot,
	limit = 24,
): WorkspaceCitySummary[] {
	const cityCount = Math.min(limit, workspace.pipeline.preparedDataset.cityCount);
	return Array.from({ length: cityCount }, (_, cityIndex) => {
		const preparedView = new PreparedCityView(workspace.pipeline.preparedDataset, cityIndex);
		const baseCity = workspace.pipeline.baseNetwork.cities[cityIndex];
		const linkedRecordCount = Object.values(baseCity.linkedRecords).reduce(
			(sum, recordIds) => sum + recordIds.length,
			0,
		);
		return {
			cityIndex,
			cityId: preparedView.cityId,
			cityCode: preparedView.cityCode,
			longitudeRadians: preparedView.longitudeRadians,
			latitudeRadians: preparedView.latitudeRadians,
			linkedRecordCount,
			inEdgeCount: baseCity.inEdgeIds.length,
			outEdgeCount: baseCity.outEdgeIds.length,
		};
	});
}

/**
 * Returns the most frequent queryable fields first.
 *
 * @param workspace Prepared workspace snapshot.
 * @param limit Maximum number of fields to expose.
 * @returns Sorted queryable-field summaries.
 */
export function listWorkspaceFields(
	workspace: DatasetWorkspaceSnapshot,
	limit = 24,
): QueryableField[] {
	return [...workspace.pipeline.baseNetwork.fields]
		.sort((left, right) => right.occurrences - left.occurrences || Number(left.characteristic) - Number(right.characteristic) || left.column.localeCompare(right.column))
		.slice(0, limit);
}

function summarizeMode(mode: PreparedTransportModeTimeline, modeIndex: number): WorkspaceModeSummary {
	return {
		modeIndex,
		modeCode: mode.modeCode,
		name: mode.name,
		terrestrial: mode.terrestrial,
		yearBegin: mode.yearBegin,
		yearEnd: mode.yearEnd,
		speedYearBegin: mode.speedYearBegin,
		speedYearEnd: mode.speedYearEnd,
		edgeYearBegin: mode.edgeYearBegin,
		edgeYearEnd: mode.edgeYearEnd,
	};
}

function countDiagnostics(diagnostics: DatasetDiagnostic[], severity: 'error' | 'warning'): number {
	return diagnostics.filter((diagnostic) => diagnostic.severity === severity).length;
}
