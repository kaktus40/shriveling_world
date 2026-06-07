<script lang="ts">
	import { onMount } from 'svelte';
	import { PI } from '$lib/shared';
	import {
		createDefaultConePipelineOptions,
		loadBundledDatasetFiles,
		runConePipeline,
		runDatasetPipeline,
		type ConePipelineResult,
		type DatasetPipelineResult,
	} from '$lib/testing/datasets';
	import type { ConeShape } from '$lib/domain/precompute';

	export let data: {
		datasets: string[];
	};

	const shapes: ConeShape[] = ['road', 'fastest-terrestrial', 'complex'];
	let selectedDataset = data.datasets[0] ?? '';
	let loading = false;
	let errorMessage = '';
	let pipeline: DatasetPipelineResult | null = null;
	let conePipeline: ConePipelineResult | null = null;
	let selectedCityIndex = 0;
	let selectedYear = 0;
	let selectedShape: ConeShape = 'complex';
	let sectorCount = 360;
	let neighborLimit = 0;
	let azimuthSampleCount = 360;
	let coneLengthKilometers = 0;
	let attenuationDegrees = 30;

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
			const defaults = createDefaultConePipelineOptions(pipeline.preparedDataset);
			selectedYear = defaults.year;
			selectedShape = defaults.shape;
			sectorCount = defaults.sectorCount;
			neighborLimit = defaults.neighborLimit;
			azimuthSampleCount = defaults.azimuthSampleCount;
			coneLengthKilometers = defaults.coneLengthMeters / 1000;
			attenuationDegrees = (defaults.attenuationRadians * 180) / PI;
			selectedCityIndex = 0;
			runConeStages();
		} catch (error) {
			pipeline = null;
			conePipeline = null;
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			loading = false;
		}
	}

	function runConeStages(): void {
		if (!pipeline) {
			return;
		}

		try {
			conePipeline = runConePipeline(pipeline.preparedDataset, {
				year: selectedYear,
				shape: selectedShape,
				sectorCount,
				neighborLimit,
				azimuthSampleCount,
				coneLengthMeters: coneLengthKilometers * 1000,
				attenuationRadians: (attenuationDegrees * PI) / 180,
			});
			selectedCityIndex = Math.min(selectedCityIndex, Math.max(conePipeline.staticTown.cityCount - 1, 0));
			errorMessage = '';
		} catch (error) {
			conePipeline = null;
			errorMessage = error instanceof Error ? error.message : String(error);
		}
	}

	function averageTestedFaces(result: ConePipelineResult): number {
		const total = Array.from(result.coneIntersections.testedFaceCounts).reduce((sum, count) => sum + count, 0);
		return result.coneIntersections.testedFaceCounts.length === 0
			? 0
			: total / result.coneIntersections.testedFaceCounts.length;
	}

	function clippedRayCount(result: ConePipelineResult): number {
		return Array.from(result.coneIntersections.winningNeighborCityIndexes).filter((value) => value !== 0xffffffff).length;
	}

	function previewDynamicLinks(result: ConePipelineResult): Array<{
		destinationCityIndex: number;
		azimuthRadians: number;
		alphaRadians: number;
	}> {
		const offset = result.dynamicTown.cityLinkOffsets[selectedCityIndex];
		const count = result.dynamicTown.cityLinkCounts[selectedCityIndex];
		return Array.from({ length: Math.min(count, 12) }, (_, localIndex) => ({
			destinationCityIndex: result.dynamicTown.cityLinkDestinationIndexes[offset + localIndex],
			azimuthRadians: result.dynamicTown.cityLinkAzimuthRadians[offset + localIndex],
			alphaRadians: result.dynamicTown.cityLinkAlphaRadians[offset + localIndex],
		}));
	}

	function previewRawSamples(result: ConePipelineResult): Array<{
		sampleIndex: number;
		alphaRadians: number;
		distanceKilometers: number;
	}> {
		const preview = [];
		const cityOffset = selectedCityIndex * result.rawCones.azimuthSampleCount;
		for (let sampleIndex = 0; sampleIndex < Math.min(result.rawCones.azimuthSampleCount, 12); sampleIndex += 1) {
			const denseIndex = cityOffset + sampleIndex;
			preview.push({
				sampleIndex,
				alphaRadians: result.rawCones.coneAlphaRadians[denseIndex],
				distanceKilometers: result.rawCones.coneLengthMeters / 1000,
			});
		}
		return preview;
	}

	function previewCiseledSamples(result: ConePipelineResult): Array<{
		sampleIndex: number;
		distanceKilometers: number;
		winningNeighbor: number;
	}> {
		const preview = [];
		const cityOffset = selectedCityIndex * result.rawCones.azimuthSampleCount;
		for (let sampleIndex = 0; sampleIndex < Math.min(result.rawCones.azimuthSampleCount, 12); sampleIndex += 1) {
			const denseIndex = cityOffset + sampleIndex;
			preview.push({
				sampleIndex,
				distanceKilometers: result.coneIntersections.coneIntersectionDistanceMeters[denseIndex] / 1000,
				winningNeighbor: result.coneIntersections.winningNeighborCityIndexes[denseIndex],
			});
		}
		return preview;
	}

	function stringify(value: unknown): string {
		return JSON.stringify(value, null, 2);
	}
</script>

<section class="page-head">
	<p class="eyebrow">test3</p>
	<h2>CPU cone precompute stages</h2>
	<p>
		This route ports the historical stage-by-stage cone inspection page. It now targets the explicit
		CPU reference pipeline: static invariants, one-year dynamic links, raw cones, and ciseled cone
		intersections.
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

	{#if pipeline}
		<label>
			<span>Year</span>
			<input
				type="number"
				bind:value={selectedYear}
				min={pipeline.preparedDataset.speedTimeline.span.beginYear}
				max={pipeline.preparedDataset.speedTimeline.span.endYear}
				step="1"
			/>
		</label>

		<label>
			<span>Shape</span>
			<select bind:value={selectedShape}>
				{#each shapes as shape}
					<option value={shape}>{shape}</option>
				{/each}
			</select>
		</label>

		<label>
			<span>Neighbor limit</span>
			<input type="number" bind:value={neighborLimit} min="0" max={Math.max(pipeline.preparedDataset.cityCount - 1, 0)} step="1" />
		</label>

		<label>
			<span>Sector count</span>
			<input type="number" bind:value={sectorCount} min="1" step="1" />
		</label>

		<label>
			<span>Azimuth samples</span>
			<input type="number" bind:value={azimuthSampleCount} min="3" step="1" />
		</label>

		<label>
			<span>Cone length (km)</span>
			<input type="number" bind:value={coneLengthKilometers} min="1" step="1" />
		</label>

		<label>
			<span>Attenuation (deg)</span>
			<input type="number" bind:value={attenuationDegrees} min="1" max="360" step="1" />
		</label>
	{/if}

	<button on:click={runConeStages} disabled={!pipeline || loading}>
		{loading ? 'Loading...' : 'Run CPU stages'}
	</button>
</section>

{#if errorMessage}
	<section class="panel error">
		<h3>Cone pipeline error</h3>
		<pre>{errorMessage}</pre>
	</section>
{/if}

{#if conePipeline}
	<section class="controls panel">
		<label>
			<span>City index</span>
			<input
				type="number"
				bind:value={selectedCityIndex}
				min="0"
				max={Math.max(conePipeline.staticTown.cityCount - 1, 0)}
				step="1"
			/>
		</label>
	</section>

	<section class="grid">
		<article class="panel">
			<h3>Static stage</h3>
			<p>Cities: {conePipeline.staticTown.cityCount}</p>
			<p>Effective neighbor limit: {conePipeline.staticTown.neighborLimit}</p>
			<p>Curve edge pairs: {conePipeline.staticTown.curveEdgePairs.length / 2}</p>
		</article>

		<article class="panel">
			<h3>Dynamic stage</h3>
			<p>Year: {conePipeline.dynamicTown.year}</p>
			<p>Road alpha: {((conePipeline.dynamicTown.roadAlphaRadians * 180) / PI).toFixed(3)} deg</p>
			<p>Selected links for city {selectedCityIndex}: {conePipeline.dynamicTown.cityLinkCounts[selectedCityIndex]}</p>
		</article>

		<article class="panel">
			<h3>Raw cones</h3>
			<p>Shape: {conePipeline.rawCones.shape}</p>
			<p>Azimuth samples: {conePipeline.rawCones.azimuthSampleCount}</p>
			<p>Cone length: {(conePipeline.rawCones.coneLengthMeters / 1000).toFixed(1)} km</p>
		</article>

		<article class="panel">
			<h3>Ciseled intersections</h3>
			<p>Clipped rays: {clippedRayCount(conePipeline)}</p>
			<p>Average tested faces per ray: {averageTestedFaces(conePipeline).toFixed(2)}</p>
		</article>
	</section>

	<section class="grid">
		<article class="panel">
			<h3>Dynamic links preview</h3>
			<table>
				<thead>
					<tr>
						<th>Destination</th>
						<th>Azimuth (rad)</th>
						<th>Alpha (rad)</th>
					</tr>
				</thead>
				<tbody>
					{#each previewDynamicLinks(conePipeline) as link}
						<tr>
							<td>{link.destinationCityIndex}</td>
							<td>{link.azimuthRadians.toFixed(6)}</td>
							<td>{link.alphaRadians.toFixed(6)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</article>

		<article class="panel">
			<h3>Raw samples preview</h3>
			<table>
				<thead>
					<tr>
						<th>Sample</th>
						<th>Alpha (rad)</th>
						<th>Length (km)</th>
					</tr>
				</thead>
				<tbody>
					{#each previewRawSamples(conePipeline) as sample}
						<tr>
							<td>{sample.sampleIndex}</td>
							<td>{sample.alphaRadians.toFixed(6)}</td>
							<td>{sample.distanceKilometers.toFixed(1)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</article>

		<article class="panel">
			<h3>Ciseled samples preview</h3>
			<table>
				<thead>
					<tr>
						<th>Sample</th>
						<th>Distance (km)</th>
						<th>Winning neighbor</th>
					</tr>
				</thead>
				<tbody>
					{#each previewCiseledSamples(conePipeline) as sample}
						<tr>
							<td>{sample.sampleIndex}</td>
							<td>{sample.distanceKilometers.toFixed(3)}</td>
							<td>{sample.winningNeighbor === 0xffffffff ? 'none' : sample.winningNeighbor}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</article>
	</section>

	<section class="panel">
		<h3>Prepared diagnostics</h3>
		<pre>{stringify(pipeline?.preparedDataset.diagnostics ?? [])}</pre>
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
		min-width: 10rem;
	}

	input,
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

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		padding: 0.55rem 0.4rem;
		border-bottom: 1px solid rgba(28, 36, 40, 0.08);
		text-align: left;
	}
</style>
