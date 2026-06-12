import {
	PreparedCityView,
	type DatasetDiagnostic,
	type PreparedTransportModeTimeline,
	type QueryableField,
} from '$lib/domain/data';
import type { DatasetWorkspaceSnapshot } from './catalog';

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
 * Summarizes one workspace snapshot for a dataset-oriented application screen.
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

/** Returns stable prepared mode summaries for application pages. */
export function listWorkspaceModes(workspace: DatasetWorkspaceSnapshot): WorkspaceModeSummary[] {
	return workspace.pipeline.preparedDataset.speedTimeline.modes.map((mode, modeIndex) =>
		summarizeMode(mode, modeIndex),
	);
}

/** Returns stable city previews suitable for dataset workspace pages. */
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

/** Returns the most frequent queryable fields first. */
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
