import { buildQueryDatasetSnapshot, createDefaultQueryTree } from '$lib/application/query';
import type { QueryDatasetSnapshot, QueryExecutionResult } from '$lib/application/query';
import type { WorkspaceDatasetSnapshot } from '$lib/application/workspace';
import type { QueryNode } from '$lib/domain/query';

/** App-side query state derived from the workspace snapshot. */
export interface AppQueryState {
	readonly querySnapshot: QueryDatasetSnapshot;
	readonly queryTree: QueryNode;
}

/**
 * Builds the initial query snapshot used by the operational app shell.
 *
 * The app reuses the same worker contract as the workspace while keeping the
 * state setup localized to the app surface.
 */
export function buildAppQueryState(workspace: WorkspaceDatasetSnapshot): AppQueryState {
	const querySnapshot = buildQueryDatasetSnapshot(workspace);
	return {
		querySnapshot,
		queryTree: createDefaultQueryTree(querySnapshot.fields),
	};
}

/** Returns the list of matched city indexes for the current query result. */
export function collectAppQueryMatchedCityIndexes(
	queryResult: QueryExecutionResult | null,
): readonly number[] {
	return queryResult ? Array.from(queryResult.matchedCityIndexes) : [];
}
