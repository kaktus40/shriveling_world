<script lang="ts">
	import { onMount } from 'svelte';
	import { loadDatasetWorkspace, type DatasetWorkspaceSnapshot } from '$lib/application/workspace';
	import {
		runBoundaryPipeline,
		type BoundaryPipelineResult,
	} from '$lib/application/validation';

	export let data: {
		datasets: string[];
	};

	let selectedDataset = data.datasets[0] ?? '';
	let selectedGeoJsonFile = '';
	let loading = false;
	let errorMessage = '';
	let workspace: DatasetWorkspaceSnapshot | null = null;
	let boundary: BoundaryPipelineResult | null = null;

	onMount(() => {
		if (selectedDataset) {
			void reloadDataset();
		}
	});

	async function reloadDataset(): Promise<void> {
		if (!selectedDataset) {
			return;
		}

		loading = true;
		errorMessage = '';

		try {
			const loadedWorkspace = await loadDatasetWorkspace(fetch, selectedDataset);
			workspace = loadedWorkspace;
			selectedGeoJsonFile = loadedWorkspace.geojsonEntries[0]?.fileName ?? '';
			boundary =
				loadedWorkspace.geojsonEntries.length > 0
					? runBoundaryPipeline(
							loadedWorkspace.geojsonEntries[0].geojson,
							loadedWorkspace.pipeline.preparedDataset,
						)
					: null;
		} catch (error) {
			workspace = null;
			boundary = null;
			selectedGeoJsonFile = '';
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			loading = false;
		}
	}

	function updateBoundaryGeoJson(): void {
		if (!workspace || !selectedGeoJsonFile) {
			boundary = null;
			return;
		}

		const entry = workspace.geojsonEntries.find((candidate) => candidate.fileName === selectedGeoJsonFile);
		boundary = entry ? runBoundaryPipeline(entry.geojson, workspace.pipeline.preparedDataset) : null;
	}

	function countValidBoundaryHits(result: BoundaryPipelineResult): number {
		let hits = 0;
		for (let offset = 3; offset < result.boundaryRaycast.townBoundaryAngular.length; offset += 4) {
			if (result.boundaryRaycast.townBoundaryAngular[offset] === 1) {
				hits += 1;
			}
		}
		return hits;
	}

	function stringify(value: unknown): string {
		return JSON.stringify(value, null, 2);
	}

	function previewBoundarySamples(result: BoundaryPipelineResult): Array<{
		cityIndex: number;
		sampleIndex: number;
		angularDistanceRadians: number;
		valid: boolean;
	}> {
		const preview = [];
		const sampleCount = result.boundaryRaycast.azimuthIntervalCount;
		for (let outputIndex = 0; outputIndex < Math.min(sampleCount * 2, result.boundaryRaycast.townBoundaryAngular.length / 4); outputIndex += 1) {
			const offset = outputIndex * 4;
			preview.push({
				cityIndex: Math.floor(outputIndex / sampleCount),
				sampleIndex: outputIndex % sampleCount,
				angularDistanceRadians: result.boundaryRaycast.townBoundaryAngular[offset + 2],
				valid: result.boundaryRaycast.townBoundaryAngular[offset + 3] === 1,
			});
		}
		return preview;
	}
</script>

<section class="page-head">
	<p class="eyebrow">test1</p>
	<h2>Dataset, manifest, prepared buffers, and boundary limits</h2>
	<p>
		This route replaces the historical “load a dataset and see if the first stages work” page. It
		runs the new order-independent pipeline and, when GeoJSON is present, the CPU reference for city
		boundary limits.
	</p>
</section>

<section class="controls panel">
	<label>
		<span>Bundled dataset</span>
		<select bind:value={selectedDataset} on:change={() => void reloadDataset()}>
			{#each data.datasets as datasetName}
				<option value={datasetName}>{datasetName}</option>
			{/each}
		</select>
	</label>

	{#if workspace && workspace.geojsonEntries.length > 1}
		<label>
			<span>GeoJSON source</span>
			<select bind:value={selectedGeoJsonFile} on:change={updateBoundaryGeoJson}>
				{#each workspace.geojsonEntries as entry}
					<option value={entry.fileName}>{entry.fileName}</option>
				{/each}
			</select>
		</label>
	{/if}

	<button on:click={() => void reloadDataset()} disabled={loading}>
		{loading ? 'Loading...' : 'Reload dataset'}
	</button>
</section>

{#if errorMessage}
	<section class="panel error">
		<h3>Pipeline error</h3>
		<pre>{errorMessage}</pre>
	</section>
{/if}

{#if workspace}
	<section class="grid">
		<article class="panel">
			<h3>Inspection</h3>
			<p>{workspace.pipeline.inspectedFiles.length} source files inspected.</p>
			<ul>
				{#each workspace.pipeline.inspectedFiles as file}
					<li>{file.originalName}: <strong>{file.kind}</strong></li>
				{/each}
			</ul>
		</article>

		<article class="panel">
			<h3>Manifest</h3>
			<p>Primary tables: cities, transport network, transport modes, and transport mode speeds.</p>
			<p>City linked tables: {workspace.pipeline.manifest.cityLinkedAttributes.length}</p>
			<p>GeoJSON files: {workspace.pipeline.manifest.geojson.length}</p>
			<p>Unknown files: {workspace.pipeline.manifest.unknown.length}</p>
		</article>

		<article class="panel">
			<h3>Prepared dataset</h3>
			<p>Cities: {workspace.pipeline.preparedDataset.cityCount}</p>
			<p>Edges: {workspace.pipeline.preparedDataset.edgeCount}</p>
			<p>Modes: {workspace.pipeline.preparedDataset.modeCount}</p>
			<p>
				Historical span: {workspace.pipeline.preparedDataset.speedTimeline.span.beginYear} to
				{workspace.pipeline.preparedDataset.speedTimeline.span.endYear}
			</p>
		</article>

		{#if boundary}
			<article class="panel">
				<h3>Boundary CPU reference</h3>
				<p>Contours retained: {boundary.boundaryPrecompute.contours.length}</p>
				<p>Country meshes: {boundary.boundaryPrecompute.countryGeometries.length}</p>
				<p>Valid ray hits: {countValidBoundaryHits(boundary)}</p>
				<p>Azimuth samples: {boundary.boundaryPrecompute.azimuthSampleCount}</p>
			</article>
		{/if}
	</section>

	<section class="grid">
		<details class="panel diagnostic-panel" open>
			<summary>
				<h3>Diagnostics</h3>
				<span>scroll or collapse</span>
			</summary>
			<h4>Base network + preparation</h4>
			<pre>{stringify(workspace.pipeline.preparedDataset.diagnostics)}</pre>
			{#if boundary}
				<h4>Boundary pipeline</h4>
				<pre>{stringify(boundary.boundaryPrecompute.diagnostics)}</pre>
				<h4>Boundary raycast</h4>
				<pre>{stringify(boundary.boundaryRaycast.diagnostics)}</pre>
			{/if}
		</details>

		<article class="panel">
			<h3>Queryable fields</h3>
			<pre>{stringify(workspace.pipeline.baseNetwork.fields.slice(0, 24))}</pre>
		</article>
	</section>

	{#if boundary}
		<section class="panel">
			<h3>Boundary sample preview</h3>
			<table>
				<thead>
					<tr>
						<th>City index</th>
						<th>Sample index</th>
						<th>Angular distance (rad)</th>
						<th>Valid</th>
					</tr>
				</thead>
				<tbody>
					{#each previewBoundarySamples(boundary) as sample}
						<tr>
							<td>{sample.cityIndex}</td>
							<td>{sample.sampleIndex}</td>
							<td>{sample.angularDistanceRadians.toFixed(6)}</td>
							<td>{sample.valid ? 'yes' : 'no'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/if}
{/if}

<style>
	.page-head,
	.panel {
		background: rgba(14, 21, 28, 0.8);
		border: 1px solid rgba(141, 168, 178, 0.2);
		border-radius: 1rem;
		overflow: auto;
		min-width: 0;
	}

	.page-head,
	.panel,
	.controls {
		padding: 1.1rem 1.2rem;
	}

	.eyebrow {
		margin: 0 0 0.4rem;
		font-size: 0.74rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #8ae0dc;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin: 1rem 0;
	}

	label {
		display: grid;
		gap: 0.4rem;
		min-width: 14rem;
	}

	select,
	button {
		padding: 0.7rem 0.8rem;
		border: 1px solid rgba(141, 168, 178, 0.22);
		border-radius: 0.8rem;
		background: rgba(9, 14, 20, 0.92);
		color: #d7e2e4;
	}

	button {
		cursor: pointer;
		font-weight: 700;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		gap: 1rem;
		margin: 1rem 0;
	}

	.error {
		border-color: rgba(227, 114, 91, 0.34);
		background: rgba(52, 21, 17, 0.82);
	}

	ul {
		padding-left: 1rem;
	}

	pre {
		max-height: 28rem;
		overflow: auto;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.diagnostic-panel {
		margin: 0;
	}

	.diagnostic-panel > summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		cursor: pointer;
		list-style: none;
	}

	.diagnostic-panel > summary::-webkit-details-marker {
		display: none;
	}

	.diagnostic-panel > summary span {
		color: #8ea3aa;
		font-size: 0.82rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		padding: 0.55rem 0.4rem;
		border-bottom: 1px solid rgba(141, 168, 178, 0.12);
		text-align: left;
	}

	th {
		color: #9fb1b7;
	}
</style>
