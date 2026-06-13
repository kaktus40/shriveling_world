<script lang="ts">
	import { benchmarkSyntheticAlphaAwareHeuristic } from '$lib/application/workspace';
	import {
		buildClusterSyntheticPreset,
		buildCorridorSyntheticPreset,
		buildRandomSyntheticPreset,
	} from '$lib/application/workspace/synthetic-presets';
	import {
		parseWorkspaceSyntheticHeuristicReplay,
		serializeWorkspaceSyntheticHeuristicReplay,
	} from '$lib/application/workspace/synthetic-replay';
	import type {
		WorkspaceSyntheticHeuristicReport,
	} from '$lib/application/workspace/synthetic';
	import type { WorkspaceSyntheticPreset } from '$lib/application/workspace/synthetic-presets';
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
	let replayText = '';
	let replayMessage = '';
	let report: WorkspaceSyntheticHeuristicReport | null = null;
	let errorMessage = '';
	let running = false;
	let bestCase: ReturnType<typeof bestSyntheticCase> = null;

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
		replayMessage = '';
		bestCase = null;
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
			bestCase = null;
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			running = false;
		}
	}

	function exportReplay(): void {
		replayText = serializeWorkspaceSyntheticHeuristicReplay({
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
		replayMessage = 'Replay exported.';
	}

	function importReplay(runAfterImport: boolean): void {
		try {
			const replay = parseWorkspaceSyntheticHeuristicReplay(replayText);
			cityCoordinatesText = replay.cityCoordinatesText;
			cityLinksText = replay.cityLinksText;
			roadAlphaRadians = replay.roadAlphaRadians;
			azimuthSampleCount = replay.azimuthSampleCount;
			coneLengthMeters = replay.coneLengthMeters;
			attenuationRadians = replay.attenuationRadians;
			sectorCount = replay.sectorCount;
			neighborLimit = replay.neighborLimit;
			sweepWidthsText = replay.sweepWidths.join(', ');
			report = null;
			bestCase = null;
			errorMessage = '';
			replayMessage = 'Replay imported.';
			if (runAfterImport) {
				void runSyntheticHeuristic();
			}
		} catch (error) {
			replayMessage = error instanceof Error ? error.message : String(error);
		}
	}

	function generateRandomSyntheticSet(): void {
		setSyntheticSet(buildRandomSyntheticPreset(randomCityCount, randomLinksPerCity));
	}

	function generateCorridorSyntheticSet(): void {
		setSyntheticSet(buildCorridorSyntheticPreset(randomCityCount, randomLinksPerCity));
	}

	function generateClusterSyntheticSet(): void {
		setSyntheticSet(buildClusterSyntheticPreset(randomCityCount, randomLinksPerCity));
	}

	function setSyntheticSet(preset: WorkspaceSyntheticPreset): void {
		cityCoordinatesText = preset.cityCoordinatesText;
		cityLinksText = preset.cityLinksText;
		report = null;
		bestCase = null;
		errorMessage = '';
		replayMessage = '';
	}

	function sweepMedianMilliseconds(report: WorkspaceSyntheticHeuristicReport['cases'][number]['order']): string {
		return report.phases[0]?.wallClock.medianMilliseconds.toFixed(3) ?? 'n/a';
	}

	function caseFaceDelta(caseReport: WorkspaceSyntheticHeuristicReport['cases'][number]): string {
		return String(caseReport.order.testedFaceCount - caseReport.blockPruned.testedFaceCount);
	}

	function caseFaceDeltaRatio(caseReport: WorkspaceSyntheticHeuristicReport['cases'][number]): string {
		const order = caseReport.order.testedFaceCount;
		const blockPruned = caseReport.blockPruned.testedFaceCount;
		if (order === 0) {
			return 'n/a';
		}
		return `${(((order - blockPruned) / order) * 100).toFixed(1)}%`;
	}

	function bestSyntheticCase(report: WorkspaceSyntheticHeuristicReport):
		| {
				readonly width: number;
				readonly gain: number;
				readonly ratio: string;
		  }
		| null {
		let selectedCase: WorkspaceSyntheticHeuristicReport['cases'][number] | null = null;
		let selectedGain = Number.NEGATIVE_INFINITY;
		for (const entry of report.cases) {
			const gain = entry.order.testedFaceCount - entry.blockPruned.testedFaceCount;
			if (gain > selectedGain) {
				selectedCase = entry;
				selectedGain = gain;
			}
		}
		if (!selectedCase) {
			return null;
		}
		const ratio = selectedCase.order.testedFaceCount === 0 ? 'n/a' : `${((selectedGain / selectedCase.order.testedFaceCount) * 100).toFixed(1)}%`;
		return {
			width: selectedCase.bilateralNeighborhoodFaceCount,
			gain: selectedGain,
			ratio,
		};
	}

	$: bestCase = report ? bestSyntheticCase(report) : null;
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
		<button type="button" on:click={generateCorridorSyntheticSet}>Generate corridor set</button>
		<button type="button" on:click={generateClusterSyntheticSet}>Generate cluster set</button>
		<button type="button" on:click={exportReplay}>Export replay</button>
		<button type="button" on:click={() => importReplay(false)}>Import replay</button>
		<button type="button" on:click={() => importReplay(true)}>Import and run</button>
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

	<div class="replay">
		<label>
			<span>Replay JSON</span>
			<textarea bind:value={replayText} rows="8" placeholder="Export a replay, or paste one here to import and run."></textarea>
		</label>
		{#if replayMessage}
			<p class="replay-note">{replayMessage}</p>
		{/if}
	</div>

	{#if report}
		<div class="summary">
			<span>Cities {report.staticTown.cityCount}</span>
			<span>Links {report.dynamicTown.cityLinkCounts.reduce((sum, count) => sum + count, 0)}</span>
			<span>Widths {report.cases.length}</span>
			<span>Road alpha {report.roadAlphaRadians.toFixed(3)}</span>
			{#if bestCase}
				<span>Best width {bestCase.width}</span>
				<span>Best gain {bestCase.gain} faces</span>
				<span>Best ratio {bestCase.ratio}</span>
			{/if}
		</div>
		<table>
			<thead>
				<tr>
					<th>Width</th>
					<th>Order faces</th>
					<th>Pruned faces</th>
					<th>Delta</th>
					<th>Delta %</th>
					<th>Order ms</th>
					<th>Pruned ms</th>
				</tr>
			</thead>
			<tbody>
				{#each report.cases as sweepCase}
					<tr>
						<td>{sweepCase.bilateralNeighborhoodFaceCount}</td>
						<td>{sweepCase.order.testedFaceCount}</td>
						<td>{sweepCase.blockPruned.testedFaceCount}</td>
						<td>{caseFaceDelta(sweepCase)}</td>
						<td>{caseFaceDeltaRatio(sweepCase)}</td>
						<td>{sweepMedianMilliseconds(sweepCase.order)}</td>
						<td>{sweepMedianMilliseconds(sweepCase.blockPruned)}</td>
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

	.replay {
		display: grid;
		gap: 0.6rem;
	}

	.replay-note {
		margin: 0;
		color: #8ae0dc;
		font-size: 0.88rem;
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
