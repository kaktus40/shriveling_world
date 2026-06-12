<script lang="ts">
	import type { QueryableField } from '$lib/domain/data';

	export let fieldPreview: QueryableField[] = [];
</script>

<article class="panel">
	<h2>Queryable fields</h2>
	<table>
		<thead>
			<tr>
				<th>Source</th>
				<th>Column</th>
				<th>Occurrences</th>
				<th>Characteristic</th>
			</tr>
		</thead>
		<tbody>
			{#each fieldPreview as field}
				<tr>
					<td>{field.sourceKind}</td>
					<td>{field.column}</td>
					<td>{field.occurrences}</td>
					<td>{field.characteristic ? 'yes' : 'no'}</td>
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
