<script lang="ts">
	import type { WorkspaceAnnualCacheReport } from '$lib/application/workspace';

	export let annualCache: WorkspaceAnnualCacheReport | null = null;

	function formatMilliseconds(value: number): string {
		return value.toFixed(3);
	}

	function formatBytes(value: number): string {
		if (value < 1024) {
			return `${value} B`;
		}
		const kib = value / 1024;
		if (kib < 1024) {
			return `${kib.toFixed(2)} KiB`;
		}
		return `${(kib / 1024).toFixed(2)} MiB`;
	}
</script>

{#if annualCache}
	<section class="sweep-panel">
		<h3>Annual cache</h3>
		<p class="note">
			Stores only <code>coneIntersectionDistanceMeters</code> by year and replays the same
			representative year slices.
		</p>
		<div class="summary">
			<span>Years {annualCache.summary.yearCount}</span>
			<span>Avg miss {formatMilliseconds(annualCache.summary.averageMissMilliseconds)} ms</span>
			<span>Avg hit {formatMilliseconds(annualCache.summary.averageHitMilliseconds)} ms</span>
			<span>Avg gain {formatMilliseconds(annualCache.summary.averageGainMilliseconds)} ms</span>
			<span>Best gain {formatMilliseconds(annualCache.summary.bestGainMilliseconds)} ms</span>
			<span>Best year {annualCache.summary.bestYear ?? 'n/a'}</span>
			<span>Cache {formatBytes(annualCache.summary.totalByteLength)}</span>
		</div>
		<table>
			<thead>
				<tr>
					<th>Year</th>
					<th>Miss ms</th>
					<th>Hit ms</th>
					<th>Gain ms</th>
					<th>Rays</th>
					<th>Bytes</th>
				</tr>
			</thead>
			<tbody>
				{#each annualCache.cases as annualCase}
					<tr>
						<td>{annualCase.year}</td>
						<td>{formatMilliseconds(annualCase.miss.medianMilliseconds)}</td>
						<td>{formatMilliseconds(annualCase.hit.medianMilliseconds)}</td>
						<td>{formatMilliseconds(annualCase.miss.medianMilliseconds - annualCase.hit.medianMilliseconds)}</td>
						<td>{annualCase.rayCount}</td>
						<td>{formatBytes(annualCase.byteLength)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
{/if}

<style>
	.sweep-panel {
		display: grid;
		gap: 0.75rem;
	}

	.sweep-panel h3 {
		margin: 0;
		font-size: 0.95rem;
		color: #9fb1b7;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.note {
		margin: 0;
		color: #8ae0dc;
	}

	.summary {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.summary span {
		color: #9fb1b7;
		font-size: 0.82rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
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
</style>
