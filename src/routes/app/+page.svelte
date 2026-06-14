<script lang="ts">
	import { onMount } from 'svelte';
	import AppControlPanel from '$lib/components/app/AppControlPanel.svelte';
	import AppModuleDock from '$lib/components/app/AppModuleDock.svelte';
	import type { AppModuleKey } from '$lib/components/app/app-modules';
	import AppMeasurementPanel from '$lib/components/app/AppMeasurementPanel.svelte';
	import AppMeasurementViewport from '$lib/components/app/AppMeasurementViewport.svelte';
	import AppQueryPanel from '$lib/components/app/AppQueryPanel.svelte';
	import AppProjectionRail from '$lib/components/app/AppProjectionRail.svelte';
	import AppYearRail from '$lib/components/app/AppYearRail.svelte';
	import AppViewport from '$lib/components/app/AppViewport.svelte';
	import {
		loadAppPageState,
		type AppPageState,
		type AppCameraMode,
		type AppProjectionMode,
	} from '$lib/application/app';
	import { installAppE2eApi } from '$lib/application/app/testing';
	import { createWorkspaceComputeSession } from '$lib/application/workspace';
	import {
		buildAppMeasurementSummary,
		createDefaultAppMeasurementSelection,
		resetAppMeasurementSelection,
		setAppMeasurementFocusCity,
		setAppMeasurementLocalRotation,
		setAppMeasurementSlot,
		type AppMeasurementSelection,
		type AppMeasurementSummary,
	} from '$lib/application/app/measurement';
	import { collectAppQueryMatchedCityIndexes } from '$lib/application/app/query';
	import { loadAppSceneCompute } from '$lib/application/app/compute';
	import type { ComputeProfile } from '$lib/compute';
	import {
		createDefaultQueryTree,
		createQueryController,
		createQueryWorkerClient,
		type QueryExecutionResult,
		type QueryWorkerClient,
		type QueryController,
	} from '$lib/application/query';
	import type { QueryNode } from '$lib/domain/query';
	import type { WorkspaceComputeResult } from '$lib/application/workspace';
	import type { WorkspaceCitySummary } from '$lib/application/workspace';

	export let data: {
		datasets: string[];
	};

	let appState: AppPageState | null = null;
	let workspaceCompute: WorkspaceComputeResult | null = null;
	let selectedDataset = '';
	let selectedYear = 0;
	let selectedCityIndex = 0;
	let cameraMode: AppCameraMode = 'orbit';
	let selectedComputeProfile: ComputeProfile = 'cpu';
	let projectionStart: AppProjectionMode = 'none';
	let projectionEnd: AppProjectionMode = 'equirectangular';
	let projectionPercent = 50;
	let showCityLabels = false;
	let queryTree: QueryNode | null = null;
	let queryResult: QueryExecutionResult | null = null;
	let queryError = '';
	let queryLoading = false;
	let queryWorker: QueryWorkerClient | null = null;
	let queryController: QueryController | null = null;
	let measurementSelection: AppMeasurementSelection = createDefaultAppMeasurementSelection(0);
	let loading = false;
	let errorMessage = '';
	let selectedCity: WorkspaceCitySummary | null = null;
	let selectedYearLabel: number | string = '';
	let computeRequestId = 0;
	let queryMatchedCityIndexes: readonly number[] = [];
	let queryCityIds: readonly number[] = [];
	let queryCityCodes: readonly number[] = [];
	let measurementSummary: AppMeasurementSummary | null = null;
	let activeModule: AppModuleKey | null = 'scene';
	let computeSession = createWorkspaceComputeSession();
	$: queryMatchedCityIndexes = collectAppQueryMatchedCityIndexes(queryResult);
	$: queryCityIds = appState?.cities.map((city) => city.cityId) ?? [];
	$: queryCityCodes = appState?.cities.map((city) => city.cityCode) ?? [];
	$: measurementSummary = buildAppMeasurementSummary(appState, measurementSelection);

	onMount(() => {
		queryWorker = createQueryWorkerClient();
		void computeSession.warm();
		queryController = createQueryController({
			getQueryWorker: () => queryWorker,
			getQuerySnapshot: () => appState?.querySnapshot ?? null,
			getQueryTree: () => queryTree,
			setQueryTree: (next) => {
				queryTree = next;
			},
			setQueryResult: (next) => {
				queryResult = next;
				queryError = '';
			},
			setQueryError: (next) => {
				queryError = next;
			},
		});
		const disposeAppE2e = installAppE2eApi({
			setDataset: async (dataset: string) => {
				handleDatasetChange(dataset);
			},
			setComputeProfile: async (profile: ComputeProfile) => {
				handleComputeProfileChange(profile);
			},
			setYear: async (year: number) => {
				handleYearChange(year);
			},
			setProjection: async (start: AppProjectionMode, end: AppProjectionMode, percent: number) => {
				handleProjectionStartChange(start);
				handleProjectionEndChange(end);
				handleProjectionPercentChange(percent);
			},
			setCameraMode: async (mode: AppCameraMode) => {
				handleCameraModeChange(mode);
			},
		});

		return () => {
			void computeSession.dispose();
			disposeAppE2e();
			queryController?.dispose();
			queryController = null;
			queryWorker?.terminate();
			queryWorker = null;
		};
	});

	async function reloadApp(): Promise<void> {
		if (!selectedDataset) {
			return;
		}

		loading = true;
		errorMessage = '';
		try {
			const loaded = await loadAppPageState(fetch, selectedDataset);
			appState = loaded;
			selectedYear = loaded.selection.year;
			selectedCityIndex = loaded.selection.cityIndex;
			cameraMode = loaded.selection.cameraMode;
			selectedComputeProfile = loaded.selection.computeProfile;
			projectionStart = loaded.selection.projectionStart;
			projectionEnd = loaded.selection.projectionEnd;
			projectionPercent = loaded.selection.projectionPercent;
			showCityLabels = loaded.selection.showCityLabels;
			queryTree = createDefaultQueryTree(loaded.querySnapshot.fields);
			measurementSelection = createDefaultAppMeasurementSelection(loaded.selection.cityIndex);
			queryResult = null;
			queryError = '';
			queryController?.reset();
			await reloadAppCompute(loaded, selectedYear);
		} catch (error) {
			appState = null;
			workspaceCompute = null;
			queryTree = null;
			queryResult = null;
			queryError = '';
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			loading = false;
		}
	}

	async function reloadAppCompute(state: AppPageState, year: number): Promise<void> {
		const requestId = ++computeRequestId;
		loading = true;
		errorMessage = '';
		try {
			const loadedCompute = await loadAppSceneCompute(state.workspace, {
				profile: selectedComputeProfile,
				year,
				projectionStart,
				projectionEnd,
				projectionPercent,
			}, computeSession);
			if (requestId !== computeRequestId) {
				return;
			}
			workspaceCompute = loadedCompute;
		} catch (error) {
			if (requestId !== computeRequestId) {
				return;
			}
			workspaceCompute = null;
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			if (requestId === computeRequestId) {
				loading = false;
			}
		}
	}

	function handleDatasetChange(next: string): void {
		if (next === selectedDataset) {
			return;
		}
		selectedDataset = next;
		if (selectedDataset) {
			void reloadApp();
		}
	}

	function handleYearChange(next: number): void {
		if (next === selectedYear) {
			return;
		}
		selectedYear = next;
		if (appState) {
			void reloadAppCompute(appState, next);
		}
	}

	function handleCityIndexChange(next: number): void {
		selectedCityIndex = next;
		measurementSelection = setAppMeasurementFocusCity(measurementSelection, next);
		cameraMode = 'inspect';
	}

	function handleCameraModeChange(next: AppCameraMode): void {
		cameraMode = next;
	}

	function handleComputeProfileChange(next: ComputeProfile): void {
		if (next === selectedComputeProfile) {
			return;
		}
		selectedComputeProfile = next;
		if (appState) {
			void reloadAppCompute(appState, selectedYear);
		}
	}

	function handleProjectionStartChange(next: AppProjectionMode): void {
		projectionStart = next;
		if (appState) {
			void reloadAppCompute(appState, selectedYear);
		}
	}

	function handleProjectionEndChange(next: AppProjectionMode): void {
		projectionEnd = next;
		if (appState) {
			void reloadAppCompute(appState, selectedYear);
		}
	}

	function handleProjectionPercentChange(next: number): void {
		projectionPercent = next;
		if (appState) {
			void reloadAppCompute(appState, selectedYear);
		}
	}

	function handleShowCityLabelsChange(next: boolean): void {
		showCityLabels = next;
	}

	function handleModuleSelect(nextModule: AppModuleKey): void {
		activeModule = activeModule === nextModule ? null : nextModule;
	}

	function handleMeasurementSetPoint(slot: 'a' | 'b' | 'c'): void {
		measurementSelection = setAppMeasurementSlot(measurementSelection, slot, selectedCityIndex);
	}

	function handleMeasurementClearPoint(slot: 'a' | 'b' | 'c'): void {
		measurementSelection = setAppMeasurementSlot(measurementSelection, slot, null);
	}

	function handleMeasurementCenterOnSelectedCity(): void {
		measurementSelection = setAppMeasurementFocusCity(measurementSelection, selectedCityIndex);
		cameraMode = 'inspect';
	}

	function handleMeasurementRotationChange(next: number): void {
		measurementSelection = setAppMeasurementLocalRotation(measurementSelection, next);
	}

	function resetMeasurementTools(): void {
		measurementSelection = resetAppMeasurementSelection(selectedCityIndex);
	}

	async function handleQueryRun(): Promise<void> {
		if (!queryController) {
			return;
		}
		queryLoading = true;
		try {
			await queryController.execute();
		} finally {
			queryLoading = false;
		}
	}

	function handleQueryReset(): void {
		queryController?.reset();
	}

	function handleQueryChange(path: number[], nextNode: QueryNode): void {
		queryController?.update(path, nextNode);
	}

	function handleQueryDelete(path: number[]): void {
		queryController?.remove(path);
	}

	function handleQueryInsert(path: number[], child: QueryNode): void {
		queryController?.insert(path, child);
	}

	function handleQueryMove(path: number[], direction: -1 | 1): void {
		queryController?.move(path, direction);
	}

	function handleQueryCitySelect(cityIndex: number): void {
		selectedCityIndex = cityIndex;
		measurementSelection = setAppMeasurementFocusCity(measurementSelection, cityIndex);
		cameraMode = 'inspect';
	}

	function resetScene(): void {
		selectedYear = appState?.selection.year ?? selectedYear;
		selectedCityIndex = appState?.selection.cityIndex ?? selectedCityIndex;
		cameraMode = appState?.selection.cameraMode ?? 'orbit';
		selectedComputeProfile = appState?.selection.computeProfile ?? selectedComputeProfile;
		projectionStart = appState?.selection.projectionStart ?? projectionStart;
		projectionEnd = appState?.selection.projectionEnd ?? projectionEnd;
		projectionPercent = appState?.selection.projectionPercent ?? projectionPercent;
		showCityLabels = appState?.selection.showCityLabels ?? showCityLabels;
		measurementSelection = resetAppMeasurementSelection(selectedCityIndex);
		if (appState) {
			void reloadAppCompute(appState, selectedYear);
		}
	}

	$: selectedCity =
		appState?.cities.find((city: WorkspaceCitySummary) => city.cityIndex === selectedCityIndex) ??
		null;
	$: selectedYearLabel = selectedYear || appState?.selection.year || '';
</script>

<svelte:head>
	<title>Application</title>
</svelte:head>

<div class="app-shell">
	<AppViewport
		{appState}
		{workspaceCompute}
		{selectedYear}
		{selectedYearLabel}
		{selectedCityIndex}
		{cameraMode}
		{selectedComputeProfile}
		{projectionStart}
		{projectionEnd}
		{projectionPercent}
		{measurementSelection}
		{showCityLabels}
		{queryMatchedCityIndexes}
		{loading}
		{selectedCity}
		onCityIndexChange={handleCityIndexChange}
		onYearChange={handleYearChange}
		onCameraModeChange={handleCameraModeChange}
	/>

	<div class="chrome">
		<AppModuleDock activeModule={activeModule} onSelect={handleModuleSelect} />

		<AppYearRail
			yearOptions={appState?.yearOptions ?? []}
			{selectedYear}
			{loading}
			onYearChange={handleYearChange}
		/>

		<AppControlPanel
			open={activeModule === 'scene'}
			{appState}
			datasets={data.datasets}
			{selectedDataset}
			{selectedCityIndex}
			{cameraMode}
			{selectedComputeProfile}
			{projectionStart}
			{projectionEnd}
			{projectionPercent}
			{showCityLabels}
			{loading}
			{selectedCity}
			onDatasetChange={handleDatasetChange}
			onCityIndexChange={handleCityIndexChange}
			onCameraModeChange={handleCameraModeChange}
			onComputeProfileChange={handleComputeProfileChange}
			onShowCityLabelsChange={handleShowCityLabelsChange}
			onResetScene={resetScene}
		/>

		<AppMeasurementPanel
			open={activeModule === 'measurement'}
			{selectedCityIndex}
			{selectedCity}
			{measurementSelection}
			{measurementSummary}
			{loading}
			onSetPoint={handleMeasurementSetPoint}
			onClearPoint={handleMeasurementClearPoint}
			onCenterOnSelectedCity={handleMeasurementCenterOnSelectedCity}
			onRotationChange={handleMeasurementRotationChange}
			onReset={resetMeasurementTools}
		/>

		<AppQueryPanel
			open={activeModule === 'query'}
			querySnapshot={appState?.querySnapshot ?? null}
			{queryTree}
			{queryResult}
			{queryError}
			{queryLoading}
			{selectedCityIndex}
			cityIds={queryCityIds}
			cityCodes={queryCityCodes}
			onRun={handleQueryRun}
			onReset={handleQueryReset}
			onChange={handleQueryChange}
			onDelete={handleQueryDelete}
			onInsert={handleQueryInsert}
			onMove={handleQueryMove}
			onSelectCityIndex={handleQueryCitySelect}
		/>

		<AppProjectionRail
			{projectionStart}
			{projectionEnd}
			{projectionPercent}
			{loading}
			onProjectionStartChange={handleProjectionStartChange}
			onProjectionEndChange={handleProjectionEndChange}
			onProjectionPercentChange={handleProjectionPercentChange}
		/>
	</div>

	<AppMeasurementViewport
		measurementSummary={measurementSummary}
		{loading}
		onFocusPoint={(cityIndex) => {
			selectedCityIndex = cityIndex;
			measurementSelection = setAppMeasurementFocusCity(measurementSelection, cityIndex);
			cameraMode = 'inspect';
		}}
	/>

	{#if errorMessage}
		<div class="error-banner" role="alert">
			<strong>Application error</strong>
			<span>{errorMessage}</span>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
	}

	.app-shell {
		position: relative;
		min-height: 100vh;
		overflow: hidden;
		--app-left-dock-offset: 4.75rem;
		--app-year-rail-height: 4.75rem;
		--app-projection-rail-width: 12.25rem;
		background:
			radial-gradient(circle at top left, rgba(34, 137, 144, 0.16), transparent 24rem),
			radial-gradient(circle at bottom right, rgba(194, 115, 50, 0.14), transparent 28rem),
			linear-gradient(180deg, #061014 0%, #06090d 100%);
	}

	.chrome {
		position: absolute;
		inset: 0;
		z-index: 2;
		pointer-events: none;
		padding-top: var(--app-year-rail-height);
		box-sizing: border-box;
	}

	.error-banner {
		position: absolute;
		left: 1rem;
		bottom: 1rem;
		z-index: 3;
		display: grid;
		gap: 0.2rem;
		max-width: min(36rem, calc(100vw - 2rem));
		padding: 0.8rem 1rem;
		border-radius: 0.9rem;
		background: rgba(92, 24, 24, 0.9);
		border: 1px solid rgba(255, 164, 164, 0.3);
		color: #ffe7e7;
		box-shadow: 0 0.75rem 1.5rem rgba(0, 0, 0, 0.28);
	}

	.error-banner strong {
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-size: 0.75rem;
	}

	.error-banner span {
		line-height: 1.45;
	}

</style>
