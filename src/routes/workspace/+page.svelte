<script lang="ts">
	import { onMount } from 'svelte';
	import WorkspaceControls from '$lib/components/workspace/WorkspaceControls.svelte';
	import WorkspaceNoticePanel from '$lib/components/workspace/WorkspaceNoticePanel.svelte';
	import WorkspaceSummaryGrid from '$lib/components/workspace/WorkspaceSummaryGrid.svelte';
	import WorkspaceComputePanel from '$lib/components/workspace/WorkspaceComputePanel.svelte';
	import WorkspaceDatasetDetails from '$lib/components/workspace/WorkspaceDatasetDetails.svelte';
	import WorkspaceQueryPanel from '$lib/components/workspace/WorkspaceQueryPanel.svelte';
	import {
		createDefaultQueryTree,
		createQueryWorkerClient,
		insertQueryNodeAtPath,
		moveQueryNodeAtPath,
		removeQueryNodeAtPath,
		updateQueryNodeAtPath,
		type QueryDatasetSnapshot,
		type QueryExecutionResult,
		type QueryWorkerClient,
	} from '$lib/application/query';
	import {
		type DatasetWorkspaceSnapshot,
		type DatasetWorkspaceSummary,
		type DatasetWorkspaceCompute,
		type WorkspaceCitySummary,
		type WorkspaceModeSummary,
		loadWorkspacePageDataset,
		runWorkspacePageCompute,
		runWorkspacePageQuery,
	} from '$lib/application/workspace';
	import type { DatasetDiagnostic, QueryableField } from '$lib/domain/data';
	import type { QueryNode } from '$lib/domain/query';
	import type { ComputeConeIntersectionStrategy, ComputeProfile } from '$lib/compute';

	export let data: {
		datasets: string[];
	};

	let selectedDataset = data.datasets[0] ?? '';
	let workspace: DatasetWorkspaceSnapshot | null = null;
	let summary: DatasetWorkspaceSummary | null = null;
	let modes: WorkspaceModeSummary[] = [];
	let cities: WorkspaceCitySummary[] = [];
	let fieldPreview: QueryableField[] = [];
	let querySnapshot: QueryDatasetSnapshot | null = null;
	let queryTree: QueryNode | null = null;
	let queryResult: QueryExecutionResult | null = null;
	let queryWorker: QueryWorkerClient | null = null;
	let workspaceCompute: DatasetWorkspaceCompute | null = null;
	let selectedComputeProfile: ComputeProfile = 'cpu';
	let selectedConeIntersectionStrategy: ComputeConeIntersectionStrategy = 'oracle';
	let selectedComputeDiagnosticProfile: ComputeProfile | 'all' = 'all';
	let loading = false;
	let computeLoading = false;
	let queryLoading = false;
	let errorMessage = '';
	let computeError = '';
	let queryError = '';
	let queryRunTimer: ReturnType<typeof setTimeout> | null = null;
	let computeDiagnostics: readonly DatasetDiagnostic[] = [];

	onMount(() => {
		queryWorker = createQueryWorkerClient();
		if (selectedDataset) {
			void reloadWorkspace();
		}

		return () => {
			if (queryRunTimer) {
				clearTimeout(queryRunTimer);
				queryRunTimer = null;
			}
			queryWorker?.terminate();
			queryWorker = null;
		};
	});

	async function reloadWorkspace(): Promise<void> {
		if (!selectedDataset) {
			return;
		}

		loading = true;
		errorMessage = '';
		try {
			const loaded = await loadWorkspacePageDataset(fetch, selectedDataset);
			workspace = loaded.workspace;
			summary = loaded.summary;
			modes = loaded.modes;
			cities = loaded.cities;
			fieldPreview = loaded.fieldPreview;
			querySnapshot = loaded.querySnapshot;
			queryTree = loaded.queryTree;
			queryResult = null;
			queryError = '';
			computeError = '';
			await reloadCompute();
			scheduleQueryRun();
		} catch (error) {
			workspace = null;
			summary = null;
			modes = [];
			cities = [];
			fieldPreview = [];
			querySnapshot = null;
			queryTree = null;
			queryResult = null;
			workspaceCompute = null;
			computeDiagnostics = [];
			computeError = '';
			queryError = '';
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			loading = false;
		}
	}

	$: computeDiagnostics = workspaceCompute?.result.diagnostics ?? [];

	function refreshWorkspaceQueryTree(): void {
		if (!querySnapshot) {
			return;
		}

		queryTree = createDefaultQueryTree(querySnapshot.fields);
		queryResult = null;
		queryError = '';
		scheduleQueryRun();
	}

	function clearWorkspaceQueryMutationState(): void {
		queryResult = null;
		queryError = '';
	}

	function applyQueryMutation(mutator: () => void): void {
		mutator();
		clearWorkspaceQueryMutationState();
		scheduleQueryRun();
	}

	async function reloadCompute(): Promise<void> {
		const currentWorkspace = workspace;
		if (!currentWorkspace) {
			return;
		}

		computeLoading = true;
		computeError = '';
		try {
			workspaceCompute = await runWorkspacePageCompute(currentWorkspace, {
				profile: selectedComputeProfile,
				coneIntersectionStrategy: selectedConeIntersectionStrategy,
			});
		} catch (error) {
			workspaceCompute = null;
			computeError = error instanceof Error ? error.message : String(error);
		} finally {
			computeLoading = false;
		}
	}

	async function runQuery(): Promise<void> {
		if (!workspace || !querySnapshot || !queryTree || !queryWorker) {
			return;
		}

		queryLoading = true;
		queryError = '';
		try {
			queryResult = await runWorkspacePageQuery(queryWorker, querySnapshot, queryTree);
		} catch (error) {
			queryResult = null;
			queryError = error instanceof Error ? error.message : String(error);
		} finally {
			queryLoading = false;
		}
	}

	function scheduleQueryRun(): void {
		if (!workspace || !querySnapshot || !queryTree || !queryWorker) {
			return;
		}

		if (queryRunTimer) {
			clearTimeout(queryRunTimer);
		}

		queryRunTimer = setTimeout(() => {
			queryRunTimer = null;
			void runQuery();
		}, 80);
	}

	function resetQuery(): void {
		refreshWorkspaceQueryTree();
	}

	function updateQueryNode(path: number[], nextNode: QueryNode): void {
		if (!queryTree) {
			return;
		}

		applyQueryMutation(() => {
			queryTree = updateQueryNodeAtPath(queryTree as QueryNode, path, () => nextNode);
		});
	}

	function deleteQueryNode(path: number[]): void {
		if (!queryTree) {
			return;
		}

		applyQueryMutation(() => {
			queryTree = removeQueryNodeAtPath(queryTree as QueryNode, path);
		});
	}

	function insertQueryNode(path: number[], child: QueryNode): void {
		if (!queryTree) {
			return;
		}

		applyQueryMutation(() => {
			queryTree = insertQueryNodeAtPath(queryTree as QueryNode, path, child);
		});
	}

	function moveQueryNode(path: number[], direction: -1 | 1): void {
		if (!queryTree) {
			return;
		}

		applyQueryMutation(() => {
			queryTree = moveQueryNodeAtPath(queryTree as QueryNode, path, direction);
		});
	}
</script>

<section class="page-head">
	<p class="eyebrow">Application workspace</p>
	<h1>Dataset workspace</h1>
	<p class="lede">
		First non-test application screen built on the shared workspace orchestration. It exposes the
		loaded dataset as a business object: files, prepared entities, transport modes, city previews,
		free queryable fields, and diagnostics.
	</p>
</section>

<WorkspaceControls
	datasets={data.datasets}
	bind:selectedDataset
	bind:selectedComputeProfile
	bind:selectedConeIntersectionStrategy
	{loading}
	onReloadWorkspace={() => void reloadWorkspace()}
	onReloadCompute={() => void reloadCompute()}
/>

{#if errorMessage}
	<WorkspaceNoticePanel title="Workspace error" message={errorMessage} kind="error" />
{/if}

{#if computeError}
	<WorkspaceNoticePanel title="Compute error" message={computeError} kind="error" />
{/if}

{#if summary && workspace}
	<WorkspaceSummaryGrid
		{summary}
		{workspaceCompute}
		selectedComputeProfile={selectedComputeProfile}
		selectedConeIntersectionStrategy={selectedConeIntersectionStrategy}
		{computeLoading}
	/>

	<WorkspaceComputePanel
		{workspaceCompute}
		{selectedComputeDiagnosticProfile}
		{computeDiagnostics}
		onDiagnosticProfileChange={(profile) => (selectedComputeDiagnosticProfile = profile)}
	/>

	<WorkspaceDatasetDetails
		{modes}
		{cities}
		{fieldPreview}
		preparedDatasetDiagnostics={workspace.pipeline.preparedDataset.diagnostics}
	/>

	<WorkspaceQueryPanel
		{querySnapshot}
		{queryTree}
		{queryResult}
		{queryLoading}
		{queryError}
		onChange={updateQueryNode}
		onDelete={deleteQueryNode}
		onInsert={insertQueryNode}
		onMove={moveQueryNode}
		onRun={() => void runQuery()}
		onReset={resetQuery}
		cityIds={Array.from(workspace.pipeline.preparedDataset.cityIds)}
		cityCodes={Array.from(workspace.pipeline.preparedDataset.cityCodes)}
	/>
{/if}
