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
	loadDatasetWorkspace,
	summarizeDatasetWorkspace,
	runDatasetWorkspaceCompute,
	type DatasetWorkspaceCompute,
	type DatasetWorkspaceSnapshot,
	type DatasetWorkspaceSummary,
	type WorkspaceCitySummary,
	type WorkspaceModeSummary,
} from './datasets';
import type { ComputeConeIntersectionStrategy, ComputeProfile } from '$lib/compute';

export interface WorkspacePageDatasetState {
	workspace: DatasetWorkspaceSnapshot;
	summary: DatasetWorkspaceSummary;
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

export async function loadWorkspacePageDataset(
	fetcher: typeof fetch,
	selectedDataset: string,
): Promise<WorkspacePageDatasetState> {
	const workspace = await loadDatasetWorkspace(fetcher, selectedDataset);
	const querySnapshot = buildQueryDatasetSnapshot(workspace);
	return {
		workspace,
		summary: summarizeDatasetWorkspace(workspace),
		modes: listWorkspaceModes(workspace),
		cities: listWorkspaceCities(workspace, 18),
		fieldPreview: listWorkspaceFields(workspace, 20),
		querySnapshot,
		queryTree: createDefaultQueryTree(querySnapshot.fields),
	};
}

export async function runWorkspacePageCompute(
	workspace: DatasetWorkspaceSnapshot,
	request: WorkspacePageComputeRequest,
): Promise<DatasetWorkspaceCompute> {
	return runDatasetWorkspaceCompute(workspace, {
		profile: request.profile,
		forced: request.profile,
		allowFallback: true,
		benchmark: true,
		coneIntersectionStrategy: request.coneIntersectionStrategy,
	});
}

export async function runWorkspacePageQuery(
	queryWorker: QueryWorkerClient,
	querySnapshot: QueryDatasetSnapshot,
	queryTree: QueryNode,
): Promise<QueryExecutionResult> {
	return queryWorker.execute({
		dataset: querySnapshot,
		query: queryTree,
	});
}
