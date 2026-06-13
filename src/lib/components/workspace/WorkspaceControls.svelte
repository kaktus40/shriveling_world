<script lang="ts">
	import type { ComputeConeIntersectionStrategy, ComputeProfile } from '$lib/compute';

	export let datasets: string[] = [];
	export let selectedDataset = '';
	export let selectedComputeProfile: ComputeProfile = 'cpu';
	export let selectedConeIntersectionStrategy: ComputeConeIntersectionStrategy = 'oracle';
	export let loading = false;
	export let onDatasetChange: (value: string) => void = () => undefined;
	export let onComputeProfileChange: (value: ComputeProfile) => void = () => undefined;
	export let onConeIntersectionStrategyChange: (value: ComputeConeIntersectionStrategy) => void = () => undefined;
	export let onReloadWorkspace: (dataset: string) => void = () => undefined;
	export let onReloadCompute: (
		dataset: string,
		profile: ComputeProfile,
		strategy: ComputeConeIntersectionStrategy,
	) => void = () => undefined;

	let currentDataset = selectedDataset;
	let currentComputeProfile = selectedComputeProfile;
	let currentConeIntersectionStrategy = selectedConeIntersectionStrategy;

	$: currentDataset = selectedDataset;
	$: currentComputeProfile = selectedComputeProfile;
	$: currentConeIntersectionStrategy = selectedConeIntersectionStrategy;
</script>

<section class="controls panel">
	<label>
		<span>Bundled dataset</span>
		<select
			value={currentDataset}
			on:change={(event) => {
				currentDataset = (event.currentTarget as HTMLSelectElement).value;
				onDatasetChange(currentDataset);
			}}
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
			value={currentComputeProfile}
			on:change={(event) => {
				currentComputeProfile = (event.currentTarget as HTMLSelectElement).value as ComputeProfile;
				onComputeProfileChange(currentComputeProfile);
			}}
		>
			<option value="cpu">CPU</option>
			<option value="webgl2">WebGL2</option>
			<option value="webgpu">WebGPU</option>
		</select>
	</label>

	<label>
		<span>Cone strategy</span>
		<select
			value={currentConeIntersectionStrategy}
			on:change={(event) => {
				currentConeIntersectionStrategy = (
					event.currentTarget as HTMLSelectElement
				).value as ComputeConeIntersectionStrategy;
				onConeIntersectionStrategyChange(currentConeIntersectionStrategy);
			}}
		>
			<option value="oracle">Oracle</option>
			<option value="symmetric-order">Symmetric order</option>
			<option value="alpha-aware-order">Alpha-aware order</option>
			<option value="alpha-aware-block-pruned">Alpha-aware block-pruned</option>
		</select>
	</label>

	<button on:click={() => onReloadWorkspace(currentDataset)} disabled={loading || !currentDataset}>
		{loading ? 'Loading...' : 'Reload workspace'}
	</button>

	<button
		on:click={() =>
			onReloadCompute(currentDataset, currentComputeProfile, currentConeIntersectionStrategy)}
		disabled={loading || !currentDataset}
	>
		{loading ? 'Loading...' : 'Reload compute'}
	</button>

	<a class="nav-link" href="/test">Open validation routes</a>
</section>

<style>
	.panel {
		padding: 1.1rem 1.2rem;
		background: rgba(12, 19, 26, 0.8);
		border: 1px solid rgba(138, 168, 178, 0.2);
		border-radius: 1rem;
		overflow: auto;
		min-width: 0;
	}

	.controls {
		margin-bottom: 1rem;
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
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
