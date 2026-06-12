<script lang="ts">
	import type { WorkspaceModeSummary } from '$lib/application/workspace';

	export let modes: WorkspaceModeSummary[] = [];

	function yearLabel(value: number | null): string {
		return value === null ? 'unbounded' : String(value);
	}
</script>

<article class="panel">
	<h2>Transport modes</h2>
	<table>
		<thead>
			<tr>
				<th>Idx</th>
				<th>Code</th>
				<th>Name</th>
				<th>Role</th>
				<th>Active years</th>
			</tr>
		</thead>
		<tbody>
			{#each modes as mode}
				<tr>
					<td>{mode.modeIndex}</td>
					<td>{mode.modeCode}</td>
					<td>{mode.name}</td>
					<td>{mode.terrestrial ? 'cone' : 'curve'}</td>
					<td>{yearLabel(mode.yearBegin)} to {yearLabel(mode.yearEnd)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
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

	.panel h2 {
		margin-top: 0;
	}
</style>
