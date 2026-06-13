import {
	buildQueryDatasetSnapshot,
	createDefaultQueryTree,
	type QueryDatasetSnapshot,
	type QueryExecutionResult,
	type QueryWorkerClient,
} from '$lib/application/query';
import type { QueryNode } from '$lib/domain/query';
import {
	listWorkspaceCities,
	listWorkspaceFields,
	listWorkspaceModes,
	loadWorkspaceDataset,
	summarizeWorkspaceDataset,
	computeWorkspaceDataset,
	type WorkspaceComputeResult,
	type WorkspaceDatasetSnapshot,
	type WorkspaceDatasetSummary,
	type WorkspaceCitySummary,
	type WorkspaceModeSummary,
} from './datasets';
import type { ComputeConeIntersectionStrategy, ComputeProfile } from '$lib/compute';
import type { ComputeSession } from '$lib/compute';

export interface WorkspacePageState {
	workspace: WorkspaceDatasetSnapshot;
	summary: WorkspaceDatasetSummary;
	modes: WorkspaceModeSummary[];
	cities: WorkspaceCitySummary[];
	fieldPreview: ReturnType<typeof listWorkspaceFields>;
	querySnapshot: QueryDatasetSnapshot;
	queryTree: QueryNode;
}

export interface WorkspacePageComputeRequest {
	profile: ComputeProfile;
	coneIntersectionStrategy: ComputeConeIntersectionStrategy;
}

export async function loadWorkspacePageState(
	fetcher: typeof fetch,
	selectedDataset: string,
): Promise<WorkspacePageState> {
	const workspace = await loadWorkspaceDataset(fetcher, selectedDataset);
	const querySnapshot = buildQueryDatasetSnapshot(workspace);
	return {
		workspace,
		summary: summarizeWorkspaceDataset(workspace),
		modes: listWorkspaceModes(workspace),
		cities: listWorkspaceCities(workspace, 18),
		fieldPreview: listWorkspaceFields(workspace, 20),
		querySnapshot,
		queryTree: createDefaultQueryTree(querySnapshot.fields),
	};
}

export async function computeWorkspacePageState(
	workspace: WorkspaceDatasetSnapshot,
	request: WorkspacePageComputeRequest,
	session?: ComputeSession,
): Promise<WorkspaceComputeResult> {
	return computeWorkspaceDataset(
		workspace,
		{
			profile: request.profile,
			forced: request.profile,
			allowFallback: true,
			benchmark: true,
			coneIntersectionStrategy: request.coneIntersectionStrategy,
		},
		session,
	);
}

export async function executeWorkspaceQuery(
	queryWorker: QueryWorkerClient,
	querySnapshot: QueryDatasetSnapshot,
	queryTree: QueryNode,
): Promise<QueryExecutionResult> {
	return queryWorker.execute({
		dataset: querySnapshot,
		query: queryTree,
	});
}
