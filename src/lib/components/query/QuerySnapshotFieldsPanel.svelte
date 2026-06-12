<script lang="ts">
	import type { QueryDatasetSnapshot } from '$lib/application/query';

	export let querySnapshot: QueryDatasetSnapshot | null = null;
</script>

{#if querySnapshot}
	<article class="query-column">
		<h3>Snapshot fields</h3>
		<p>
			{querySnapshot.fields.length} queryable fields serialized for the worker, including
			{querySnapshot.fields.filter((field) => field.multiValued).length} multi-valued enrichments.
		</p>
		<table>
			<thead>
				<tr>
					<th>Label</th>
					<th>Type</th>
					<th>Comparators</th>
				</tr>
			</thead>
			<tbody>
				{#each querySnapshot.fields.slice(0, 14) as field}
					<tr>
						<td>{field.label}</td>
						<td>{field.valueType}</td>
						<td>{field.supportedComparators.join(', ')}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</article>
{/if}

<style>
	.query-column {
		display: grid;
		gap: 0.85rem;
	}

	.query-column h3 {
		margin: 0;
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
