<script lang="ts">
	import DiagnosticsDetails from '$lib/components/shared/DiagnosticsDetails.svelte';
	import type { QueryDatasetSnapshot, QueryExecutionResult } from '$lib/application/query';

	export let querySnapshot: QueryDatasetSnapshot | null = null;
	export let queryResult: QueryExecutionResult | null = null;
	export let cityIds: readonly number[] = [];
	export let cityCodes: readonly number[] = [];

	function queryMatchRows(limit = 10): Array<{ cityIndex: number; cityId: number; cityCode: number }> {
		if (!queryResult) {
			return [];
		}

		return Array.from(queryResult.matchedCityIndexes)
			.slice(0, limit)
			.map((cityIndex) => ({
				cityIndex,
				cityId: cityIds[cityIndex] ?? -1,
				cityCode: cityCodes[cityIndex] ?? -1,
			}));
	}

	function queryMatchPreview(cityIndex: number, limit = 3): string {
		if (!querySnapshot) {
			return '';
		}

		const city = querySnapshot.cities[cityIndex];
		if (!city) {
			return '';
		}

		return querySnapshot.fields
			.filter((field) => field.characteristic || field.multiValued)
			.slice(0, limit)
			.map((field) => {
				const values = city.valuesByFieldKey[field.fieldKey] ?? [];
				const value = values.find((candidate) => candidate !== null);
				return `${field.label}: ${String(value ?? 'null')}`;
			})
			.join(' | ');
	}
</script>

<article class="query-column">
	<h3>Execution result</h3>
	{#if queryResult}
		{@const currentQueryResult = queryResult}
		<p>
			<strong>{currentQueryResult.matchedCityIndexes.length}</strong> cities matched.
		</p>
		<p>
			Diagnostics: {currentQueryResult.diagnostics.length} item(s), including
			{currentQueryResult.diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length}
			error(s).
		</p>
		<table>
			<thead>
				<tr>
					<th>Idx</th>
					<th>City id</th>
					<th>City code</th>
					<th>Preview</th>
				</tr>
			</thead>
			<tbody>
				{#each queryMatchRows() as match}
					<tr>
						<td>{match.cityIndex}</td>
						<td>{match.cityId}</td>
						<td>{match.cityCode}</td>
						<td>{queryMatchPreview(match.cityIndex)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<DiagnosticsDetails title="Result diagnostics" subtitle="raw payloads and validation notes" headingTag="h3">
			<div class="diagnostic-list">
				{#each currentQueryResult.diagnostics as diagnostic}
					<div class={`diagnostic-card ${diagnostic.severity}`}>
						<strong>{diagnostic.severity}</strong>
						<span>{diagnostic.code}</span>
						<pre>{JSON.stringify(diagnostic, null, 2)}</pre>
					</div>
				{/each}
			</div>
		</DiagnosticsDetails>
	{:else}
		<p>No query executed yet.</p>
	{/if}
</article>

<style>
	.query-column {
		display: grid;
		gap: 0.85rem;
	}

	.query-column h3 {
		margin: 0;
	}

	.diagnostic-list {
		display: grid;
		gap: 0.75rem;
		max-height: 24rem;
		overflow: auto;
		padding-right: 0.25rem;
	}

	.diagnostic-card {
		padding: 0.7rem 0.8rem;
		border-radius: 0.8rem;
		border: 1px solid rgba(138, 168, 178, 0.18);
		background: rgba(9, 14, 20, 0.88);
	}

	.diagnostic-card.warning {
		border-color: rgba(175, 128, 54, 0.34);
		background: rgba(43, 32, 13, 0.9);
	}

	.diagnostic-card.error {
		border-color: rgba(227, 114, 91, 0.34);
		background: rgba(52, 21, 17, 0.9);
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

	pre {
		overflow: auto;
		white-space: pre-wrap;
		color: #d7e2e4;
	}
</style>
