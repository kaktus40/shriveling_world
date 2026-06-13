import {
	listWorkspaceCities,
	loadWorkspaceDataset,
	summarizeWorkspaceDataset,
	type WorkspaceDatasetSnapshot,
	type WorkspaceDatasetSummary,
	type WorkspaceCitySummary,
} from '$lib/application/workspace';

/** Canonical camera modes exposed by the application shell. */
export const APP_CAMERA_MODES = ['orbit', 'inspect', 'free'] as const;

/** Application camera modes supported by the first interaction layer. */
export type AppCameraMode = (typeof APP_CAMERA_MODES)[number];

/** Selection state for the operational app shell. */
export interface AppSelectionState {
	readonly datasetName: string;
	readonly year: number;
	readonly cityIndex: number;
	readonly cameraMode: AppCameraMode;
}

/**
 * Minimal operational snapshot consumed by the Babylon shell.
 *
 * The shell keeps the precomputed workspace snapshot intact and only adds the
 * selection state required by the first interaction layer.
 */
export interface AppPageState {
	readonly workspace: WorkspaceDatasetSnapshot;
	readonly summary: WorkspaceDatasetSummary;
	readonly cities: readonly WorkspaceCitySummary[];
	readonly yearOptions: readonly number[];
	readonly selection: AppSelectionState;
}

/**
 * Loads one application snapshot from the shared dataset catalog.
 *
 * The snapshot is intentionally small: it exposes the shared workspace data,
 * a reusable summary, the top cities, and the default selection used by the
 * first Babylon application shell.
 */
export async function loadAppPageState(
	fetcher: typeof fetch,
	selectedDataset: string,
): Promise<AppPageState> {
	const workspace = await loadWorkspaceDataset(fetcher, selectedDataset);
	const summary = summarizeWorkspaceDataset(workspace);
	const yearOptions = buildYearOptions(
		workspace.pipeline.preparedDataset.speedTimeline.span.beginYear,
		workspace.pipeline.preparedDataset.speedTimeline.span.endYear,
	);

	return {
		workspace,
		summary,
		cities: listWorkspaceCities(workspace, 24),
		yearOptions,
		selection: {
			datasetName: selectedDataset,
			year: yearOptions[0] ?? summary.yearBegin,
			cityIndex: 0,
			cameraMode: 'orbit',
		},
	};
}

function buildYearOptions(beginYear: number, endYear: number): readonly number[] {
	const years: number[] = [];
	for (let year = beginYear; year <= endYear; year += 1) {
		years.push(year);
	}
	return years;
}
