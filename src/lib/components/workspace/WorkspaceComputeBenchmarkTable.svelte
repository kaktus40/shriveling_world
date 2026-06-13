<script lang="ts">
	import type { WorkspaceComputeResult } from '$lib/application/workspace';
	import type { AlphaAwareNeighborhoodBenchmarkReport } from '$lib/domain/precompute';

	export let workspaceCompute: WorkspaceComputeResult | null = null;

	function sweepMedianMilliseconds(report: AlphaAwareNeighborhoodBenchmarkReport['cases'][number]['report']): string {
		return report.phases[0]?.wallClock.medianMilliseconds.toFixed(3) ?? 'n/a';
	}
</script>

{#if workspaceCompute}
	<article class="panel compute-panel">
		<h2>Compute benchmark</h2>
		<p>
			Total duration: {workspaceCompute.benchmark.totalDurationMs.toFixed(3)} ms
		</p>
		<table>
			<thead>
				<tr>
					<th>Stage</th>
					<th>Scope</th>
					<th>Duration ms</th>
				</tr>
			</thead>
			<tbody>
				{#each workspaceCompute.benchmark.timings as timing}
					<tr>
						<td>{timing.stage}</td>
						<td>{timing.scope}</td>
						<td>{timing.durationMs.toFixed(3)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if workspaceCompute.selection.reason}
			<p class="compute-note">{workspaceCompute.selection.reason}</p>
		{/if}
		{#if workspaceCompute.alphaAwareSweep}
			<section class="sweep-panel">
				<h3>Alpha-aware sweep</h3>
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
						{#each workspaceCompute.alphaAwareSweep.cases as sweepCase}
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
			</section>
		{/if}
	</article>
{/if}

<style>
	.panel {
		padding: 1.1rem 1.2rem;
		background: rgba(12, 19, 26, 0.8);
		border: 1px solid rgba(138, 168, 178, 0.2);
		border-radius: 1rem;
		overflow: auto;
		min-width: 0;
	}

	.compute-panel {
		display: grid;
		gap: 1rem;
		margin-bottom: 1rem;
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

	.compute-note {
		margin: 0;
		color: #8ae0dc;
	}

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

	.compute-panel h2 {
		margin-top: 0;
	}
</style>
