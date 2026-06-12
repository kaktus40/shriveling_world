<script lang="ts">
	import type { ComputeConeIntersectionStrategy, ComputeProfile } from '$lib/compute';

	export let datasets: string[] = [];
	export let selectedDataset = '';
	export let selectedComputeProfile: ComputeProfile = 'cpu';
	export let selectedConeIntersectionStrategy: ComputeConeIntersectionStrategy = 'oracle';
	export let loading = false;
	export let onReloadWorkspace: () => void = () => undefined;
	export let onReloadCompute: () => void = () => undefined;
</script>

<section class="controls panel">
	<label>
		<span>Bundled dataset</span>
		<select bind:value={selectedDataset} on:change={onReloadWorkspace}>
			{#each datasets as datasetName}
				<option value={datasetName}>{datasetName}</option>
			{/each}
		</select>
	</label>

	<label>
		<span>Compute profile</span>
		<select bind:value={selectedComputeProfile} on:change={onReloadCompute}>
			<option value="cpu">CPU</option>
			<option value="webgl2">WebGL2</option>
			<option value="webgpu">WebGPU</option>
		</select>
	</label>

	<label>
		<span>Cone strategy</span>
		<select bind:value={selectedConeIntersectionStrategy} on:change={onReloadCompute}>
			<option value="oracle">Oracle</option>
			<option value="symmetric-order">Symmetric order</option>
			<option value="alpha-aware-order">Alpha-aware order</option>
			<option value="alpha-aware-block-pruned">Alpha-aware block-pruned</option>
		</select>
	</label>

	<button on:click={onReloadWorkspace} disabled={loading}>
		{loading ? 'Loading...' : 'Reload workspace'}
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
