<script lang="ts">
	import { benchmarkSyntheticAlphaAwareHeuristic } from '$lib/application/workspace';
	import type { WorkspaceSyntheticHeuristicReport } from '$lib/application/workspace/synthetic';
	import WorkspaceSyntheticPreview from './WorkspaceSyntheticPreview.svelte';

	let cityCoordinatesText = `0 0
0.2 0.05
1.0 -0.1`;
	let cityLinksText = `0:0.5; 1.57:0.5
0:0.5; 1.57:0.35
0:0.5; 1.57:0.25`;
	let roadAlphaRadians = 0.5;
	let azimuthSampleCount = 8;
	let coneLengthMeters = 1000;
	let attenuationRadians = 0.35;
	let sectorCount = 8;
	let neighborLimit = 2;
	let sweepWidthsText = '1, 2, 4';
	let randomCityCount = 5;
	let randomLinksPerCity = 3;
	let report: WorkspaceSyntheticHeuristicReport | null = null;
	let errorMessage = '';
	let running = false;

	function parseSweepWidths(text: string): number[] {
		return text
			.split(/[,\s]+/)
			.map((token) => token.trim())
			.filter(Boolean)
			.map((token) => Number(token))
			.filter((value) => Number.isSafeInteger(value) && value > 0);
	}

	async function runSyntheticHeuristic(): Promise<void> {
		running = true;
		errorMessage = '';
		try {
			report = benchmarkSyntheticAlphaAwareHeuristic({
				cityCoordinatesText,
				cityLinksText,
				roadAlphaRadians,
				azimuthSampleCount,
				coneLengthMeters,
				attenuationRadians,
				sectorCount,
				neighborLimit,
				sweepWidths: parseSweepWidths(sweepWidthsText),
			});
		} catch (error) {
			report = null;
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			running = false;
		}
	}

	function generateRandomSyntheticSet(): void {
		const cityLines: string[] = [];
		const linkLines: string[] = [];
		for (let cityIndex = 0; cityIndex < randomCityCount; cityIndex += 1) {
			const lon = -Math.PI + Math.random() * Math.PI * 2;
			const lat = -Math.PI / 2 + Math.random() * Math.PI;
			cityLines.push(`${lon.toFixed(4)} ${lat.toFixed(4)}`);
			const linkTokens: string[] = [];
			for (let linkIndex = 0; linkIndex < randomLinksPerCity; linkIndex += 1) {
				const azimuth = Math.random() * Math.PI * 2;
				const alpha = 0.15 + Math.random() * 0.6;
				linkTokens.push(`${linkIndex}@${azimuth.toFixed(4)}:${alpha.toFixed(4)}`);
			}
			linkLines.push(linkTokens.join('; '));
		}
		cityCoordinatesText = cityLines.join('\n');
		cityLinksText = linkLines.join('\n');
		report = null;
		errorMessage = '';
	}

	function sweepMedianMilliseconds(report: WorkspaceSyntheticHeuristicReport['benchmark']['cases'][number]['report']): string {
		return report.phases[0]?.wallClock.medianMilliseconds.toFixed(3) ?? 'n/a';
	}
</script>

<article class="panel synthetic-panel">
	<h2>Synthetic alpha-aware heuristic</h2>
	<p>Free cities and free azimuth/alpha lists for measuring the heuristic on a synthetic mini-set.</p>

	<div class="grid">
		<label>
			<span>City coordinates</span>
			<textarea bind:value={cityCoordinatesText} rows="5"></textarea>
		</label>
		<label>
			<span>Azimuth-alpha rows</span>
			<textarea bind:value={cityLinksText} rows="5"></textarea>
		</label>
	</div>

	<div class="controls">
		<label><span>Road alpha</span><input bind:value={roadAlphaRadians} type="number" step="0.01" /></label>
		<label><span>Azimuth samples</span><input bind:value={azimuthSampleCount} type="number" step="1" min="3" /></label>
		<label><span>Cone length</span><input bind:value={coneLengthMeters} type="number" step="1" min="1" /></label>
		<label><span>Attenuation</span><input bind:value={attenuationRadians} type="number" step="0.01" min="0.01" /></label>
		<label><span>Sectors</span><input bind:value={sectorCount} type="number" step="1" min="3" /></label>
		<label><span>Neighbor limit</span><input bind:value={neighborLimit} type="number" step="1" min="1" /></label>
		<label class="wide"><span>Sweep widths</span><input bind:value={sweepWidthsText} type="text" /></label>
		<label><span>Random cities</span><input bind:value={randomCityCount} type="number" step="1" min="1" /></label>
		<label><span>Links/city</span><input bind:value={randomLinksPerCity} type="number" step="1" min="1" /></label>
		<button type="button" on:click={generateRandomSyntheticSet}>Generate random set</button>
		<button on:click={runSyntheticHeuristic} disabled={running}>{running ? 'Running...' : 'Run synthetic sweep'}</button>
	</div>

	<WorkspaceSyntheticPreview
		{cityCoordinatesText}
		{cityLinksText}
		coneLengthMeters={coneLengthMeters}
	/>

	{#if errorMessage}
		<p class="error">{errorMessage}</p>
	{/if}

	{#if report}
		<div class="summary">
			<span>Cities {report.staticTown.cityCount}</span>
			<span>Links {report.dynamicTown.cityLinkCounts.reduce((sum, count) => sum + count, 0)}</span>
			<span>Widths {report.benchmark.cases.length}</span>
			<span>Road alpha {report.benchmark.roadAlphaRadians.toFixed(3)}</span>
		</div>
		<table>
			<thead>
				<tr>
					<th>Width</th>
					<th>Tested faces</th>
					<th>Priority faces</th>
					<th>Fast priority</th>
					<th>Median ms</th>
				</tr>
			</thead>
			<tbody>
				{#each report.benchmark.cases as sweepCase}
					<tr>
						<td>{sweepCase.bilateralNeighborhoodFaceCount}</td>
						<td>{sweepCase.report.testedFaceCount}</td>
						<td>{sweepCase.report.priorityFaceCount ?? 0}</td>
						<td>{sweepCase.report.priorityFastFaceCount ?? 0}</td>
						<td>{sweepMedianMilliseconds(sweepCase.report)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</article>

<style>
	.panel {
		padding: 1.1rem 1.2rem;
		background: rgba(12, 19, 26, 0.8);
		border: 1px solid rgba(138, 168, 178, 0.2);
		border-radius: 1rem;
		overflow: auto;
		min-width: 0;
	}

	.synthetic-panel {
		display: grid;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.grid,
	.controls,
	.summary {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: 0.75rem;
	}

	label {
		display: grid;
		gap: 0.25rem;
	}

	.wide {
		grid-column: 1 / -1;
	}

	textarea,
	input {
		width: 100%;
		box-sizing: border-box;
		border-radius: 0.7rem;
		border: 1px solid rgba(138, 168, 178, 0.18);
		background: rgba(9, 14, 20, 0.92);
		color: inherit;
		padding: 0.55rem 0.7rem;
	}

	button {
		grid-column: 1 / -1;
		border-radius: 0.8rem;
		border: 1px solid rgba(138, 168, 178, 0.2);
		background: rgba(18, 30, 37, 0.92);
		color: inherit;
		padding: 0.7rem 0.9rem;
		cursor: pointer;
	}

	.error {
		margin: 0;
		color: #ff9d8f;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		padding: 0.45rem 0.35rem;
		border-bottom: 1px solid rgba(138, 168, 178, 0.12);
		text-align: left;
		font-size: 0.95rem;
	}

	th {
		color: #9fb1b7;
		font-size: 0.82rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.summary span {
		color: #9fb1b7;
		font-size: 0.82rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.controls button[type='button'] {
		background: rgba(20, 41, 48, 0.95);
	}

	h2 {
		margin: 0;
	}
</style>
