<script lang="ts">
	import { onMount } from 'svelte';
	import AppControlPanel from '$lib/components/app/AppControlPanel.svelte';
	import AppViewport from '$lib/components/app/AppViewport.svelte';
	import { loadAppPageState, type AppPageState, type AppCameraMode } from '$lib/application/app';
	import { loadAppSceneCompute } from '$lib/application/app/compute';
	import type { WorkspaceComputeResult } from '$lib/application/workspace';
	import type { WorkspaceCitySummary } from '$lib/application/workspace';

	export let data: {
		datasets: string[];
	};

	let appState: AppPageState | null = null;
	let workspaceCompute: WorkspaceComputeResult | null = null;
	let selectedDataset = data.datasets[0] ?? '';
	let selectedYear = 0;
	let selectedCityIndex = 0;
	let cameraMode: AppCameraMode = 'orbit';
	let loading = false;
	let errorMessage = '';
	let selectedCity: WorkspaceCitySummary | null = null;
	let selectedYearLabel: number | string = '';
	let computeRequestId = 0;

	onMount(() => {
		if (selectedDataset) {
			void reloadApp();
		}
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
			await reloadAppCompute(loaded, selectedYear);
		} catch (error) {
			appState = null;
			workspaceCompute = null;
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
			const loadedCompute = await loadAppSceneCompute(state.workspace, { year });
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
		void reloadApp();
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
	}

	function handleCameraModeChange(next: AppCameraMode): void {
		cameraMode = next;
	}

	function resetScene(): void {
		selectedYear = appState?.selection.year ?? selectedYear;
		selectedCityIndex = appState?.selection.cityIndex ?? selectedCityIndex;
		cameraMode = appState?.selection.cameraMode ?? 'orbit';
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
		{loading}
		{selectedCity}
		onCityIndexChange={handleCityIndexChange}
		onYearChange={handleYearChange}
		onCameraModeChange={handleCameraModeChange}
	/>

	<div class="chrome">
		<AppControlPanel
			{appState}
			datasets={data.datasets}
			{selectedDataset}
			{selectedYear}
			{selectedCityIndex}
			{cameraMode}
			{loading}
			{selectedCity}
			onDatasetChange={handleDatasetChange}
			onYearChange={handleYearChange}
			onCityIndexChange={handleCityIndexChange}
			onCameraModeChange={handleCameraModeChange}
			onResetScene={resetScene}
		/>
	</div>

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
