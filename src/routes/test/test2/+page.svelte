<script lang="ts">
	import { onMount } from 'svelte';
	import type GeoJSON from 'geojson';
	import {
		extractGeoJsonFeatureCollections,
		loadBundledDatasetFiles,
		runBoundaryPipeline,
		runDatasetPipeline,
		type BoundaryPipelineResult,
		type DatasetPipelineResult,
	} from '$lib/testing/datasets';

	export let data: {
		datasets: string[];
	};

	let selectedDataset = data.datasets[0] ?? '';
	let selectedGeoJsonFile = '';
	let selectedContourIndex = 0;
	let loading = false;
	let errorMessage = '';
	let pipeline: DatasetPipelineResult | null = null;
	let boundary: BoundaryPipelineResult | null = null;
	let geojsonEntries: Array<{ fileName: string; geojson: GeoJSON.FeatureCollection }> = [];

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
			const files = await loadBundledDatasetFiles(fetch, selectedDataset);
			pipeline = runDatasetPipeline(files);
			geojsonEntries = extractGeoJsonFeatureCollections(files);
			selectedGeoJsonFile = geojsonEntries[0]?.fileName ?? '';
			boundary =
				geojsonEntries.length > 0 ? runBoundaryPipeline(geojsonEntries[0].geojson, pipeline.preparedDataset) : null;
			selectedContourIndex = 0;
		} catch (error) {
			pipeline = null;
			boundary = null;
			geojsonEntries = [];
			selectedGeoJsonFile = '';
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			loading = false;
		}
	}

	function updateBoundaryGeoJson(): void {
		if (!pipeline || !selectedGeoJsonFile) {
			boundary = null;
			return;
		}

		const entry = geojsonEntries.find((candidate) => candidate.fileName === selectedGeoJsonFile);
		boundary = entry ? runBoundaryPipeline(entry.geojson, pipeline.preparedDataset) : null;
		selectedContourIndex = 0;
	}

	function buildContourPath(ring: Array<readonly [number, number]>): string {
		if (ring.length === 0) {
			return '';
		}
		const longitudes = ring.map(([longitude]) => longitude);
		const latitudes = ring.map(([, latitude]) => latitude);
		const minLon = Math.min(...longitudes);
		const maxLon = Math.max(...longitudes);
		const minLat = Math.min(...latitudes);
		const maxLat = Math.max(...latitudes);
		const width = Math.max(maxLon - minLon, 1e-9);
		const height = Math.max(maxLat - minLat, 1e-9);

		return ring
			.map(([longitude, latitude], pointIndex) => {
				const x = 12 + ((longitude - minLon) / width) * 376;
				const y = 212 - ((latitude - minLat) / height) * 188;
				return `${pointIndex === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
			})
			.join(' ');
	}

	function matchedTownCount(result: BoundaryPipelineResult): number {
		return result.boundaryPrecompute.townCountryAssociations.filter((association) => association.countryContourId >= 0).length;
	}

	function stringify(value: unknown): string {
		return JSON.stringify(value, null, 2);
	}
</script>

<section class="page-head">
	<p class="eyebrow">test2</p>
	<h2>GeoJSON contours, triangulation, and town association</h2>
	<p>
		This route replaces the historical country-only page. It focuses on the first migration stage of
		GeoJSON handling: retaining first-level contours, triangulating the interior, and linking cities
		to those contours.
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

	{#if geojsonEntries.length > 1}
		<label>
			<span>GeoJSON source</span>
			<select bind:value={selectedGeoJsonFile} on:change={updateBoundaryGeoJson}>
				{#each geojsonEntries as entry}
					<option value={entry.fileName}>{entry.fileName}</option>
				{/each}
			</select>
		</label>
	{/if}

	{#if boundary}
		<label>
			<span>Contour index</span>
			<select bind:value={selectedContourIndex}>
				{#each boundary.boundaryPrecompute.contours as contour, contourIndex}
					<option value={contourIndex}>
						#{contourIndex} feature {contour.featureIndex} contour {contour.contourIndex}
					</option>
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
		<h3>Boundary pipeline error</h3>
		<pre>{errorMessage}</pre>
	</section>
{/if}

{#if boundary}
	<section class="grid">
		<article class="panel">
			<h3>Boundary precompute</h3>
			<p>Contours: {boundary.boundaryPrecompute.contours.length}</p>
			<p>Country geometries: {boundary.boundaryPrecompute.countryGeometries.length}</p>
			<p>Associated towns: {matchedTownCount(boundary)} / {boundary.townInputs.length}</p>
			<p>Contour buffer points: {boundary.boundaryPrecompute.countryContourBuffer.length / 2}</p>
		</article>

		<article class="panel">
			<h3>Selected contour</h3>
			{#if boundary.boundaryPrecompute.contours[selectedContourIndex]}
				<p>Feature index: {boundary.boundaryPrecompute.contours[selectedContourIndex].featureIndex}</p>
				<p>Contour index: {boundary.boundaryPrecompute.contours[selectedContourIndex].contourIndex}</p>
				<p>Ring points: {boundary.boundaryPrecompute.contours[selectedContourIndex].ring.length}</p>
				<p>
					Bottom vertices:
					{boundary.boundaryPrecompute.countryGeometries[selectedContourIndex].bottomVertexCount}
				</p>
				<p>
					Triangle count:
					{boundary.boundaryPrecompute.countryGeometries[selectedContourIndex].indexes.length / 3}
				</p>
			{/if}
		</article>
	</section>

	{#if boundary.boundaryPrecompute.contours[selectedContourIndex]}
		<section class="panel preview">
			<h3>Contour preview</h3>
			<svg viewBox="0 0 400 224" role="img" aria-label="Selected contour preview">
				<rect x="0" y="0" width="400" height="224" rx="20" ry="20" class="svg-bg" />
				<path
					d={buildContourPath(boundary.boundaryPrecompute.contours[selectedContourIndex].ring)}
					class="contour"
				/>
			</svg>
		</section>
	{/if}

	<section class="grid">
		<article class="panel">
			<h3>Selected contour properties</h3>
			<pre>{stringify(boundary.boundaryPrecompute.contours[selectedContourIndex]?.properties ?? null)}</pre>
		</article>

		<article class="panel">
			<h3>Diagnostics</h3>
			<pre>{stringify(boundary.boundaryPrecompute.diagnostics)}</pre>
			<h4>Raycast diagnostics</h4>
			<pre>{stringify(boundary.boundaryRaycast.diagnostics)}</pre>
		</article>
	</section>
{/if}

<style>
	.page-head,
	.panel {
		background: rgba(255, 255, 255, 0.84);
		border: 1px solid rgba(28, 36, 40, 0.14);
		border-radius: 1rem;
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
		color: #0d6f73;
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
		border: 1px solid rgba(28, 36, 40, 0.2);
		border-radius: 0.8rem;
		background: white;
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

	.preview svg {
		width: 100%;
		height: auto;
	}

	.svg-bg {
		fill: #f2f6f6;
	}

	.contour {
		fill: rgba(13, 111, 115, 0.16);
		stroke: #0d6f73;
		stroke-width: 2;
	}

	.error {
		border-color: rgba(145, 24, 24, 0.28);
		background: rgba(170, 44, 44, 0.08);
	}

	pre {
		max-height: 28rem;
		overflow: auto;
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
