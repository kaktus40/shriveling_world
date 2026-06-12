<script lang="ts">
	import type { DatasetWorkspaceCompute } from '$lib/application/workspace';

	export let workspaceCompute: DatasetWorkspaceCompute | null = null;
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

	.compute-panel h2 {
		margin-top: 0;
	}
</style>
