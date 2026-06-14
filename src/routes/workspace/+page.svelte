<script lang="ts">
	import { onMount } from 'svelte';
	import WorkspaceControls from '$lib/components/workspace/WorkspaceControls.svelte';
	import WorkspaceNoticePanel from '$lib/components/workspace/WorkspaceNoticePanel.svelte';
	import WorkspaceSummaryGrid from '$lib/components/workspace/WorkspaceSummaryGrid.svelte';
	import WorkspaceComputePanel from '$lib/components/workspace/WorkspaceComputePanel.svelte';
	import WorkspaceSyntheticHeuristicPanel from '$lib/components/workspace/WorkspaceSyntheticHeuristicPanel.svelte';
	import WorkspaceDatasetDetails from '$lib/components/workspace/WorkspaceDatasetDetails.svelte';
	import WorkspaceQueryPanel from '$lib/components/workspace/WorkspaceQueryPanel.svelte';
	import {
		createQueryWorkerClient,
		createQueryController,
		type QueryDatasetSnapshot,
		type QueryExecutionResult,
		type QueryWorkerClient,
	} from '$lib/application/query';
	import {
		type WorkspaceDatasetSnapshot,
		type WorkspaceDatasetSummary,
		type WorkspaceComputeResult,
		type WorkspaceCitySummary,
		type WorkspaceModeSummary,
		loadWorkspacePageState,
		computeWorkspacePageState,
	} from '$lib/application/workspace';
	import { createReplayScheduler } from '$lib/application/replay';
	import { primeComputeRuntime } from '$lib/application/runtime';
	import { installWorkspaceE2eApi } from '$lib/application/workspace/testing';
	import { createWorkspaceComputeSession } from '$lib/application/workspace';
	import type { DatasetDiagnostic, QueryableField } from '$lib/domain/data';
	import type { QueryNode } from '$lib/domain/query';
	import type { ComputeConeIntersectionStrategy, ComputeProfile } from '$lib/compute';

	export let data: {
		datasets: string[];
	};

	let selectedDataset = '';
	let workspace: WorkspaceDatasetSnapshot | null = null;
	let summary: WorkspaceDatasetSummary | null = null;
	let modes: WorkspaceModeSummary[] = [];
	let cities: WorkspaceCitySummary[] = [];
	let fieldPreview: QueryableField[] = [];
	let querySnapshot: QueryDatasetSnapshot | null = null;
	let queryTree: QueryNode | null = null;
	let queryResult: QueryExecutionResult | null = null;
	let queryWorker: QueryWorkerClient | null = null;
	let workspaceCompute: WorkspaceComputeResult | null = null;
	let selectedComputeProfile: ComputeProfile = 'cpu';
	let selectedConeIntersectionStrategy: ComputeConeIntersectionStrategy = 'oracle';
	let selectedComputeDiagnosticProfile: ComputeProfile | 'all' = 'all';
	let loading = false;
	let computeLoading = false;
	let queryLoading = false;
	let errorMessage = '';
	let computeError = '';
	let queryError = '';
	let computeDiagnostics: readonly DatasetDiagnostic[] = [];
	let computeSession = createWorkspaceComputeSession();
	let workspaceComputeReplay = createReplayScheduler(() => reloadCompute());
	let workspaceQueryController = createQueryController({
		getQueryWorker: () => queryWorker,
		getQuerySnapshot: () => querySnapshot,
		getQueryTree: () => queryTree,
		setQueryTree: (next: QueryNode | null) => {
			queryTree = next;
		},
		setQueryResult: (next: QueryExecutionResult | null) => {
			queryResult = next;
		},
		setQueryError: (next: string) => {
			queryError = next;
		},
	});

	function clearWorkspaceState(): void {
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
	}

	onMount(() => {
		queryWorker = createQueryWorkerClient();
		void primeComputeRuntime(computeSession);
		const disposeWorkspaceE2e = installWorkspaceE2eApi({
			setDataset: async (dataset: string) => {
				selectedDataset = dataset;
				clearWorkspaceState();
				await reloadWorkspace(dataset);
			},
			setComputeProfile: async (profile: ComputeProfile) => {
				selectedComputeProfile = profile;
				if (workspace) {
					await reloadCompute(selectedDataset, selectedComputeProfile, selectedConeIntersectionStrategy);
				}
			},
			setConeIntersectionStrategy: async (strategy: ComputeConeIntersectionStrategy) => {
				selectedConeIntersectionStrategy = strategy;
				if (workspace) {
					await reloadCompute(selectedDataset, selectedComputeProfile, selectedConeIntersectionStrategy);
				}
			},
			reloadWorkspace: async () => {
				await reloadWorkspace(selectedDataset);
			},
			reloadCompute: async () => {
				await reloadCompute(selectedDataset, selectedComputeProfile, selectedConeIntersectionStrategy);
			},
		});

		return () => {
			workspaceComputeReplay.dispose();
			void computeSession.dispose();
			disposeWorkspaceE2e();
			workspaceQueryController.dispose();
			queryWorker?.terminate();
			queryWorker = null;
		};
	});

	async function reloadWorkspace(nextDataset: string = selectedDataset): Promise<void> {
		if (!nextDataset) {
			return;
		}

		selectedDataset = nextDataset;
		loading = true;
		errorMessage = '';
		try {
			const loaded = await loadWorkspacePageState(fetch, nextDataset);
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
			workspaceComputeReplay.request();
			workspaceQueryController.scheduleExecute();
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

	async function reloadCompute(
		nextDataset: string = selectedDataset,
		nextComputeProfile: ComputeProfile = selectedComputeProfile,
		nextConeIntersectionStrategy: ComputeConeIntersectionStrategy = selectedConeIntersectionStrategy,
	): Promise<void> {
		const currentWorkspace = workspace;
		if (!currentWorkspace) {
			return;
		}

		selectedDataset = nextDataset;
		selectedComputeProfile = nextComputeProfile;
		selectedConeIntersectionStrategy = nextConeIntersectionStrategy;
		computeLoading = true;
		computeError = '';
		try {
			workspaceCompute = await computeWorkspacePageState(currentWorkspace, {
				profile: nextComputeProfile,
				coneIntersectionStrategy: nextConeIntersectionStrategy,
			}, computeSession);
		} catch (error) {
			workspaceCompute = null;
			computeError = error instanceof Error ? error.message : String(error);
		} finally {
			computeLoading = false;
		}
	}

	function handleDatasetChange(_next: string): void {
		clearWorkspaceState();
		void reloadWorkspace(_next);
	}

	function handleComputeProfileChange(_next: ComputeProfile): void {
		selectedComputeProfile = _next;
		workspaceCompute = null;
		computeDiagnostics = [];
		computeError = '';
		if (workspace) {
			workspaceComputeReplay.request();
		}
	}

	function handleConeIntersectionStrategyChange(_next: ComputeConeIntersectionStrategy): void {
		selectedConeIntersectionStrategy = _next;
		workspaceCompute = null;
		computeDiagnostics = [];
		computeError = '';
		if (workspace) {
			workspaceComputeReplay.request();
		}
	}

	async function runQuery(): Promise<void> {
		queryLoading = true;
		queryError = '';
		try {
			await workspaceQueryController.execute();
		} catch (error) {
			queryResult = null;
			queryError = error instanceof Error ? error.message : String(error);
		} finally {
			queryLoading = false;
		}
	}

	function resetQuery(): void {
		workspaceQueryController.reset();
	}

	function updateQueryNode(path: number[], nextNode: QueryNode): void {
		workspaceQueryController.update(path, nextNode);
	}

	function deleteQueryNode(path: number[]): void {
		workspaceQueryController.remove(path);
	}

	function insertQueryNode(path: number[], child: QueryNode): void {
		workspaceQueryController.insert(path, child);
	}

	function moveQueryNode(path: number[], direction: -1 | 1): void {
		workspaceQueryController.move(path, direction);
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
		onDatasetChange={handleDatasetChange}
		onComputeProfileChange={handleComputeProfileChange}
		onConeIntersectionStrategyChange={handleConeIntersectionStrategyChange}
		onReloadWorkspace={(nextDataset) => void reloadWorkspace(nextDataset)}
		onReloadCompute={(nextDataset, nextProfile, nextStrategy) => {
			selectedDataset = nextDataset;
			selectedComputeProfile = nextProfile;
			selectedConeIntersectionStrategy = nextStrategy;
			workspaceComputeReplay.request();
		}}
	/>

{#if !workspace && !loading && !errorMessage}
	<WorkspaceNoticePanel
		title="No dataset loaded"
		message="Choose a bundled dataset, then click Reload workspace to start the CPU or GPU pipeline on demand."
		kind="info"
	/>
{/if}

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

	<WorkspaceSyntheticHeuristicPanel />

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
