import {
	listWorkspaceCities,
	loadWorkspaceDataset,
	summarizeWorkspaceDataset,
	type WorkspaceDatasetSnapshot,
	type WorkspaceDatasetSummary,
	type WorkspaceCitySummary,
} from '$lib/application/workspace';
import type { ComputeProfile } from '$lib/compute';
import { buildAppQueryState, type AppQueryState } from './query';

/** Canonical camera modes exposed by the application shell. */
export const APP_CAMERA_MODES = ['orbit', 'inspect', 'free'] as const;

/** Application camera modes supported by the first interaction layer. */
export type AppCameraMode = (typeof APP_CAMERA_MODES)[number];

/** Application projection modes exposed at the ends of the display variator. */
export const APP_PROJECTION_MODES = [
	'none',
	'equirectangular',
	'Mercator',
	'Winkel',
	'Eckert',
	'vanDerGrinten',
	'conicEquidistant',
] as const;

/** Application projection modes used by the display variator. */
export type AppProjectionMode = (typeof APP_PROJECTION_MODES)[number];

/** Compute profiles exposed by the application shell. */
export const APP_COMPUTE_PROFILES = ['cpu', 'webgl2', 'webgpu'] as const satisfies readonly ComputeProfile[];

/** Labels used for the application compute profile select. */
export const APP_COMPUTE_PROFILE_LABELS: Record<ComputeProfile, string> = {
	cpu: 'CPU',
	webgl2: 'WebGL2',
	webgpu: 'WebGPU',
};

/** Labels used for the application projection selects. */
export const APP_PROJECTION_LABELS: Record<AppProjectionMode, string> = {
	none: 'Globe 3D',
	equirectangular: 'Equirectangular',
	Mercator: 'Mercator',
	Winkel: 'Winkel Tripel',
	Eckert: 'Eckert VI',
	vanDerGrinten: 'van der Grinten I',
	conicEquidistant: 'Conic Equidistant',
};

/** Selection state for the operational app shell. */
export interface AppSelectionState {
	readonly datasetName: string;
	readonly year: number;
	readonly cityIndex: number;
	readonly cameraMode: AppCameraMode;
	readonly computeProfile: ComputeProfile;
	readonly projectionStart: AppProjectionMode;
	readonly projectionEnd: AppProjectionMode;
	readonly projectionPercent: number;
	readonly showCityLabels: boolean;
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
	readonly querySnapshot: AppQueryState['querySnapshot'];
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
	const queryState = buildAppQueryState(workspace);
	const yearOptions = buildYearOptions(
		workspace.pipeline.preparedDataset.speedTimeline.span.beginYear,
		workspace.pipeline.preparedDataset.speedTimeline.span.endYear,
	);

	return {
		workspace,
		summary,
		cities: listWorkspaceCities(workspace, 24),
		yearOptions,
		querySnapshot: queryState.querySnapshot,
		selection: {
			datasetName: selectedDataset,
			year: yearOptions[0] ?? summary.yearBegin,
			cityIndex: 0,
			cameraMode: 'orbit',
			computeProfile: 'cpu',
			projectionStart: 'none',
			projectionEnd: 'equirectangular',
			projectionPercent: 50,
			showCityLabels: false,
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
