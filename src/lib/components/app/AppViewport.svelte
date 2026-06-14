<script lang="ts">
	import { onMount } from 'svelte';
	import {
		APP_COMPUTE_PROFILE_LABELS,
		APP_PROJECTION_LABELS,
		type AppCameraMode,
		type AppPageState,
		type AppProjectionMode,
	} from '$lib/application/app';
	import type { AppMeasurementSelection, AppMeasurementSummary } from '$lib/application/app/measurement';
	import type { AppSceneController, AppSceneState } from '$lib/application/app/scene';
	import type { WorkspaceComputeResult } from '$lib/application/workspace';
	import type { WorkspaceCitySummary } from '$lib/application/workspace';

	export let appState: AppPageState | null = null;
	export let workspaceCompute: WorkspaceComputeResult | null = null;
	export let selectedYear = 0;
	export let selectedYearLabel: number | string = '';
	export let selectedCityIndex = 0;
	export let cameraMode: AppCameraMode = 'orbit';
	export let selectedComputeProfile: 'cpu' | 'webgl2' | 'webgpu' = 'cpu';
	export let projectionStart: AppProjectionMode = 'none';
	export let projectionEnd: AppProjectionMode = 'equirectangular';
	export let projectionPercent = 50;
	export let measurementSelection: AppMeasurementSelection;
	export let queryMatchedCityIndexes: readonly number[] = [];
	export let loading = false;
	export let selectedCity: WorkspaceCitySummary | null = null;
	export let showCityLabels = false;
	export let measurementSummary: AppMeasurementSummary | null = null;
	export let onCityIndexChange: (value: number) => void = () => undefined;
	export let onYearChange: (value: number) => void = () => undefined;
	export let onCameraModeChange: (value: AppCameraMode) => void = () => undefined;

	let canvas: HTMLCanvasElement | null = null;
	let controller: AppSceneController | null = null;
	let sceneError: string | null = null;

	const getSceneState = (): AppSceneState => ({
		appState,
		workspaceCompute,
		selectedYear,
		selectedCityIndex,
		cameraMode,
		projectionStart,
		projectionEnd,
		projectionPercent,
		measurementSelection,
		showCityLabels,
		queryMatchedCityIndexes,
	});

	onMount(() => {
		const canvasElement = canvas;
		if (!canvasElement) {
			return undefined;
		}

		void import('$lib/application/app/scene').then(({ createAppScene }) => {
			try {
				controller = createAppScene(canvasElement, getSceneState(), {
					onCityPick: (cityIndex) => onCityIndexChange(cityIndex),
					onYearStep: (step) => {
						if (!appState) {
							return;
						}
						const yearOptions = appState.yearOptions;
						const currentIndex = Math.max(0, yearOptions.indexOf(selectedYear));
						const nextIndex = Math.min(yearOptions.length - 1, Math.max(0, currentIndex + step));
						onYearChange(yearOptions[nextIndex] ?? selectedYear);
					},
					onCameraModeChange: (nextMode) => onCameraModeChange(nextMode),
				});
				sceneError = null;
			} catch (error) {
				sceneError = error instanceof Error ? error.message : String(error);
			}
		});

		return () => {
			controller?.dispose();
			controller = null;
		};
	});

	$: controller?.update(getSceneState());
</script>

<section class="viewport" aria-label="Babylon viewport">
	<canvas
		bind:this={canvas}
		class="scene-canvas"
		data-babylon-canvas="true"
		aria-hidden="true"
	></canvas>

	<div class="scene-hud">
		<div class="scene-badge">Babylon scene</div>
		<div class="scene-status">
			<span>{cameraMode}</span>
			<span>{APP_COMPUTE_PROFILE_LABELS[selectedComputeProfile]}</span>
			<span>{selectedYearLabel || selectedYear || '—'}</span>
			<span>{selectedCity ? `${selectedCityIndex} · ${selectedCity.cityLabel}` : 'No city'}</span>
			<span>{APP_PROJECTION_LABELS[projectionStart]} → {APP_PROJECTION_LABELS[projectionEnd]}</span>
			<span>{projectionPercent}%</span>
			<span>{showCityLabels ? 'city labels on' : 'city labels off'}</span>
			<span>{queryMatchedCityIndexes.length} query match(es)</span>
		</div>
	</div>

	<div class="scene-info">
		<h1>Application</h1>
		<p>
			The renderer consumes ready-to-display geometry. Use the edge dock and the projection rails
			to adjust the dataset, camera and first interaction level without collapsing the scene.
		</p>
		<ul>
			<li>{appState ? `${appState.summary.cityCount} cities loaded` : 'No dataset loaded yet'}</li>
			<li>{appState ? `${appState.summary.edgeCount} edges ready` : 'Waiting for compute data'}</li>
			<li>
				{workspaceCompute?.result.geojsonRuns.reduce((count, run) => count + (run.finalCones ? 1 : 0), 0) ?? 0}
				final cone layer(s)
			</li>
			<li>{workspaceCompute?.result.curveGeometry ? 'Curve layer ready' : 'Curve layer pending'}</li>
			<li>{APP_PROJECTION_LABELS[projectionStart]} to {APP_PROJECTION_LABELS[projectionEnd]} at {projectionPercent}%</li>
			<li>{showCityLabels ? 'City labels visible' : 'City labels hidden'}</li>
			<li>{queryMatchedCityIndexes.length} query match(es)</li>
			<li>
				{measurementSummary?.centralAngleDegrees == null
					? 'Measurement plane pending'
					: `A/O/B ${measurementSummary.centralAngleDegrees.toFixed(2)}°`}
			</li>
			<li>Selection index {selectedCityIndex}</li>
			<li>Keyboard: `+/-` zoom, `[`/`]` year, `1/2/3` camera mode</li>
		</ul>
	</div>

	{#if loading}
		<div class="scene-loading" role="status">Loading application dataset…</div>
	{/if}

	{#if sceneError}
		<div class="scene-error" role="status">{sceneError}</div>
	{/if}
</section>

<style>
	.viewport {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	.scene-canvas {
		width: 100%;
		height: 100%;
		display: block;
		background:
			radial-gradient(circle at 20% 20%, rgba(22, 129, 136, 0.24), transparent 16rem),
			radial-gradient(circle at 75% 75%, rgba(213, 138, 63, 0.18), transparent 18rem),
			linear-gradient(180deg, #071114 0%, #04070a 100%);
	}

	.scene-hud {
		position: absolute;
		right: calc(var(--app-projection-rail-width, 12.25rem) + 1rem);
		top: calc(var(--app-year-rail-height, 4.75rem) + 1rem);
		display: grid;
		gap: 0.45rem;
		justify-items: end;
		pointer-events: none;
	}

	.scene-badge,
	.scene-status span {
		border-radius: 999px;
		background: rgba(8, 12, 16, 0.7);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(138, 168, 178, 0.2);
		color: #d9eeee;
	}

	.scene-badge {
		padding: 0.45rem 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.72rem;
	}

	.scene-status {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		justify-content: end;
	}

	.scene-status span {
		padding: 0.35rem 0.55rem;
		font-size: 0.78rem;
	}

	.scene-info {
		position: absolute;
		left: 1rem;
		bottom: 1rem;
		max-width: min(36rem, calc(100vw - 2rem));
		padding: 1rem 1.1rem;
		border-radius: 1rem;
		background: rgba(8, 12, 16, 0.56);
		border: 1px solid rgba(138, 168, 178, 0.18);
		color: #dbe8e7;
		backdrop-filter: blur(14px);
		box-shadow: 0 1rem 2rem rgba(0, 0, 0, 0.24);
	}

	.scene-info h1 {
		margin: 0 0 0.4rem;
		font-size: 1.45rem;
		letter-spacing: 0.02em;
	}

	.scene-info p {
		margin: 0;
		color: #b6c8cb;
		line-height: 1.5;
	}

	.scene-info ul {
		margin: 0.8rem 0 0;
		padding-left: 1.1rem;
		color: #94d9d5;
	}

	.scene-info li + li {
		margin-top: 0.25rem;
	}

	.scene-loading {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgba(3, 6, 8, 0.18);
		color: #e6f1f1;
		font-size: 0.95rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.scene-error {
		position: absolute;
		inset: auto 1rem 1rem 1rem;
		padding: 0.8rem 0.95rem;
		border-radius: 0.95rem;
		background: rgba(52, 21, 17, 0.82);
		border: 1px solid rgba(227, 114, 91, 0.34);
		color: #ffd9d2;
		backdrop-filter: blur(14px);
		box-shadow: 0 1rem 2rem rgba(0, 0, 0, 0.28);
		font-size: 0.82rem;
	}
</style>
