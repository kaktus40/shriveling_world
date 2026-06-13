<script lang="ts">
	import {
		APP_CAMERA_MODES,
		APP_COMPUTE_PROFILE_LABELS,
		APP_COMPUTE_PROFILES,
		APP_PROJECTION_LABELS,
		type AppCameraMode,
		type AppPageState,
		type AppProjectionMode,
	} from '$lib/application/app';
	import type { ComputeProfile } from '$lib/compute';
	import type { WorkspaceCitySummary } from '$lib/application/workspace';

	export let appState: AppPageState | null = null;
	export let datasets: readonly string[] = [];
	export let selectedDataset = '';
	export let selectedCityIndex = 0;
	export let cameraMode: AppCameraMode = 'orbit';
	export let selectedComputeProfile: ComputeProfile = 'cpu';
	export let projectionStart: AppProjectionMode = 'none';
	export let projectionEnd: AppProjectionMode = 'equirectangular';
	export let projectionPercent = 50;
	export let showCityLabels = false;
	export let loading = false;
	export let selectedCity: WorkspaceCitySummary | null = null;
	export let open = false;
	export let onDatasetChange: (value: string) => void = () => undefined;
	export let onCityIndexChange: (value: number) => void = () => undefined;
	export let onCameraModeChange: (value: AppCameraMode) => void = () => undefined;
	export let onComputeProfileChange: (value: ComputeProfile) => void = () => undefined;
	export let onShowCityLabelsChange: (value: boolean) => void = () => undefined;
	export let onResetScene: () => void = () => undefined;

	const cameraModeLabels: Record<AppCameraMode, string> = {
		orbit: 'Orbit',
		inspect: 'Inspect',
		free: 'Free',
	};

</script>

{#if open}
	<section
		class="panel"
		role="group"
		aria-label="Application controls"
	>
	<header class="panel-head">
		<div>
			<p class="eyebrow">Application controls</p>
			<h2>Dataset and camera</h2>
		</div>
		<button type="button" class="action" on:click={onResetScene}>Reset scene</button>
	</header>

	<div class="teaser">
		<span>{selectedDataset || 'No dataset selected'}</span>
		<span>{selectedCity ? `${selectedCityIndex} · ${selectedCity.cityLabel}` : 'No city'}</span>
		<span>{cameraModeLabels[cameraMode]}</span>
		<span>{APP_COMPUTE_PROFILE_LABELS[selectedComputeProfile]}</span>
		<span>
			{APP_PROJECTION_LABELS[projectionStart]} → {APP_PROJECTION_LABELS[projectionEnd]}
			· {projectionPercent}%
		</span>
	</div>

	{#if !appState}
		<div class="status-note" role="note">No dataset loaded. Choose one to open the scene.</div>
	{/if}

	<div class="controls">
		<label>
			<span>Dataset</span>
			<select
				value={selectedDataset}
				disabled={loading}
				on:change={(event) =>
					onDatasetChange((event.currentTarget as HTMLSelectElement).value)}
			>
				<option value="" disabled>Select a dataset...</option>
				{#each datasets as datasetName}
					<option value={datasetName}>{datasetName}</option>
				{/each}
			</select>
		</label>

		<label>
			<span>Compute profile</span>
			<select
				value={selectedComputeProfile}
				disabled={loading}
				on:change={(event) =>
					onComputeProfileChange((event.currentTarget as HTMLSelectElement).value as ComputeProfile)}
			>
				{#each APP_COMPUTE_PROFILES as profile}
					<option value={profile}>{APP_COMPUTE_PROFILE_LABELS[profile]}</option>
				{/each}
			</select>
		</label>

		<label>
			<span>City</span>
			<select
				value={selectedCityIndex}
				disabled={!appState || loading}
				on:change={(event) =>
					onCityIndexChange(Number((event.currentTarget as HTMLSelectElement).value))}
			>
				{#each appState?.cities ?? [] as city}
					<option value={city.cityIndex}>
						{city.cityIndex} - {city.cityLabel}
					</option>
				{/each}
			</select>
		</label>
	</div>

	<div class="mode-strip" aria-label="Camera mode">
		{#each APP_CAMERA_MODES as mode}
			<button
				type="button"
				class:active={cameraMode === mode}
				on:click={() => onCameraModeChange(mode)}
			>
				{cameraModeLabels[mode]}
			</button>
		{/each}
	</div>

	<div class="summary">
		{#if appState}
			<span>{appState.summary.cityCount} cities</span>
			<span>{appState.summary.edgeCount} edges</span>
			<span>{appState.summary.yearBegin} to {appState.summary.yearEnd}</span>
		{:else}
			<span>Waiting for dataset</span>
		{/if}
	</div>

	<div class="display-toggle">
		<label class="toggle">
			<input
				type="checkbox"
				checked={showCityLabels}
				disabled={loading}
				on:change={(event) => onShowCityLabelsChange((event.currentTarget as HTMLInputElement).checked)}
			/>
			<span>City labels on cones</span>
		</label>
	</div>

	<div class="hints">
		<p>Use the edge dock to open this module.</p>
		<p>Orbit camera, wheel zoom, city picking, and display blending are the first interaction level.</p>
	</div>
	</section>
{/if}

<style>
	.panel {
		pointer-events: auto;
		width: min(25rem, calc(100vw - 2rem));
		margin: 1rem 1rem 1rem var(--app-left-dock-offset, 4.75rem);
		padding: 0.9rem 1rem;
		border-radius: 1rem;
		border: 1px solid rgba(138, 168, 178, 0.2);
		background: rgba(8, 12, 16, 0.72);
		backdrop-filter: blur(18px);
		box-shadow: 0 1rem 2rem rgba(0, 0, 0, 0.28);
		display: grid;
		gap: 0.65rem;
		color: #e5efef;
	}

	.panel-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.eyebrow {
		margin: 0 0 0.1rem;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #88d6d2;
	}

	h2 {
		margin: 0;
		font-size: 1rem;
		letter-spacing: 0.03em;
	}

	.action {
		border: 1px solid rgba(138, 168, 178, 0.3);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.04);
		color: inherit;
		padding: 0.45rem 0.8rem;
		font: inherit;
		cursor: pointer;
	}

	.action:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.teaser,
	.summary {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.status-note {
		padding: 0.55rem 0.7rem;
		border-radius: 0.85rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(138, 168, 178, 0.12);
		color: #c9dce0;
		font-size: 0.84rem;
	}

	.display-toggle {
		display: grid;
		gap: 0.35rem;
	}

	.toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.4rem 0.55rem;
		border-radius: 0.85rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(138, 168, 178, 0.12);
		color: #dce9ea;
		font-size: 0.85rem;
	}

	.toggle input {
		accent-color: #88d6d2;
	}

	.teaser span,
	.summary span {
		padding: 0.3rem 0.55rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.06);
		color: #bbd2d5;
		font-size: 0.82rem;
	}

	.controls {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.65rem;
	}

	label {
		display: grid;
		gap: 0.25rem;
	}

	label span {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #8fb4b9;
	}

	select,
	button {
		font: inherit;
	}

	select {
		width: 100%;
		padding: 0.55rem 0.65rem;
		border-radius: 0.75rem;
		border: 1px solid rgba(138, 168, 178, 0.2);
		background: rgba(10, 16, 21, 0.92);
		color: #eef6f6;
	}

	select:disabled {
		opacity: 0.6;
	}

	.mode-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.mode-strip button {
		border: 1px solid rgba(138, 168, 178, 0.22);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.04);
		color: inherit;
		padding: 0.35rem 0.7rem;
		cursor: pointer;
	}

	.mode-strip button.active {
		background: rgba(138, 220, 214, 0.18);
		border-color: rgba(138, 220, 214, 0.55);
		color: #9df0eb;
	}

	.hints {
		display: grid;
		gap: 0.2rem;
		color: #aabdc1;
		font-size: 0.85rem;
	}

	.hints p {
		margin: 0;
	}

	@media (max-width: 900px) {
		.controls {
			grid-template-columns: 1fr;
		}
	}
</style>
