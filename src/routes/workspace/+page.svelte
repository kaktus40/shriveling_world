<script lang="ts">
	import { onMount } from 'svelte';
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
		if (!querySnapshot) {
			return;
		}

		queryTree = createDefaultQueryTree(querySnapshot.fields);
		queryResult = null;
		queryError = '';
		scheduleQueryRun();
	}

	function updateQueryNode(path: number[], nextNode: QueryNode): void {
		if (!queryTree) {
			return;
		}

		queryTree = updateQueryNodeAtPath(queryTree, path, () => nextNode);
		queryResult = null;
		queryError = '';
		scheduleQueryRun();
	}

	function deleteQueryNode(path: number[]): void {
		if (!queryTree) {
			return;
		}

		queryTree = removeQueryNodeAtPath(queryTree, path);
		queryResult = null;
		queryError = '';
		scheduleQueryRun();
	}

	function insertQueryNode(path: number[], child: QueryNode): void {
		if (!queryTree) {
			return;
		}

		queryTree = insertQueryNodeAtPath(queryTree, path, child);
		queryResult = null;
		queryError = '';
		scheduleQueryRun();
	}

	function moveQueryNode(path: number[], direction: -1 | 1): void {
		if (!queryTree) {
			return;
		}

		queryTree = moveQueryNodeAtPath(queryTree, path, direction);
		queryResult = null;
		queryError = '';
		scheduleQueryRun();
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

<section class="controls panel">
	<label>
		<span>Bundled dataset</span>
		<select bind:value={selectedDataset} on:change={() => void reloadWorkspace()}>
			{#each data.datasets as datasetName}
				<option value={datasetName}>{datasetName}</option>
			{/each}
		</select>
	</label>

	<label>
		<span>Compute profile</span>
		<select bind:value={selectedComputeProfile} on:change={() => void reloadCompute()}>
			<option value="cpu">CPU</option>
			<option value="webgl2">WebGL2</option>
			<option value="webgpu">WebGPU</option>
		</select>
	</label>

	<label>
		<span>Cone strategy</span>
		<select bind:value={selectedConeIntersectionStrategy} on:change={() => void reloadCompute()}>
			<option value="oracle">Oracle</option>
			<option value="symmetric-order">Symmetric order</option>
			<option value="alpha-aware-order">Alpha-aware order</option>
			<option value="alpha-aware-block-pruned">Alpha-aware block-pruned</option>
		</select>
	</label>

	<button on:click={() => void reloadWorkspace()} disabled={loading}>
		{loading ? 'Loading...' : 'Reload workspace'}
	</button>

	<a class="nav-link" href="/test">Open validation routes</a>
</section>

{#if errorMessage}
	<section class="panel error">
		<h2>Workspace error</h2>
		<pre>{errorMessage}</pre>
	</section>
{/if}

{#if computeError}
	<section class="panel error">
		<h2>Compute error</h2>
		<pre>{computeError}</pre>
	</section>
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

<style>
	.page-head {
		padding: 1.1rem 1.2rem;
		margin-bottom: 1rem;
		background: rgba(12, 19, 26, 0.8);
		border: 1px solid rgba(138, 168, 178, 0.2);
		border-radius: 1rem;
	}

	.panel {
		padding: 1.1rem 1.2rem;
		background: rgba(12, 19, 26, 0.8);
		border: 1px solid rgba(138, 168, 178, 0.2);
		border-radius: 1rem;
		overflow: auto;
		min-width: 0;
	}

	.controls {
		padding: 1.1rem 1.2rem;
		margin-bottom: 1rem;
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.eyebrow {
		margin: 0 0 0.4rem;
		font-size: 0.74rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #8ae0dc;
	}

	.lede {
		max-width: 70ch;
	}

	label {
		display: grid;
		gap: 0.4rem;
		min-width: 16rem;
	}

	select,
	button {
		padding: 0.7rem 0.8rem;
		border: 1px solid rgba(138, 168, 178, 0.22);
		border-radius: 0.8rem;
		background: rgba(9, 14, 20, 0.9);
		color: #d7e2e4;
	}

	button {
		cursor: pointer;
		font-weight: 700;
	}

	.nav-link {
		align-self: end;
		color: #8ae0dc;
		font-weight: 700;
	}

	@media (max-width: 960px) {
		.controls {
			flex-direction: column;
		}
	}
</style>
