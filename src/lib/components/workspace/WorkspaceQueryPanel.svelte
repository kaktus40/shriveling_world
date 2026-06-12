<script lang="ts">
	import QueryNodeEditor from '$lib/components/query/QueryNodeEditor.svelte';
	import type { QueryDatasetSnapshot, QueryExecutionResult } from '$lib/application/query';
	import type { QueryNode } from '$lib/domain/query';

	export let querySnapshot: QueryDatasetSnapshot | null = null;
	export let queryTree: QueryNode | null = null;
	export let queryResult: QueryExecutionResult | null = null;
	export let queryLoading = false;
	export let queryError = '';
	export let onRun: () => void = () => undefined;
	export let onReset: () => void = () => undefined;
	export let onChange: (path: number[], nextNode: QueryNode) => void = () => undefined;
	export let onDelete: (path: number[]) => void = () => undefined;
	export let onInsert: (path: number[], child: QueryNode) => void = () => undefined;
	export let onMove: (path: number[], direction: -1 | 1) => void = () => undefined;
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

{#if querySnapshot && queryTree}
	{@const currentQuerySnapshot = querySnapshot}
	<section class="panel query-panel">
		<div class="query-header">
			<div>
				<p class="eyebrow">Query workspace</p>
				<h2>Human-editable AST tree</h2>
				<p class="lede">
					The tree below is the visual projection of the query AST. It stays aligned with the
					worker contract and can be extended without changing the execution model.
					</p>
			</div>
			<div class="query-actions">
				<button on:click={() => void onRun()} disabled={queryLoading}>
					{queryLoading ? 'Running...' : 'Run query'}
				</button>
				<button on:click={onReset} disabled={queryLoading}>Reset tree</button>
			</div>
		</div>

		{#if queryError}
			<div class="error inline-error">
				<pre>{queryError}</pre>
			</div>
		{/if}

		<div class="query-layout">
			<article class="query-column">
				<h3>Tree editor</h3>
				<QueryNodeEditor
					node={queryTree}
					fields={currentQuerySnapshot.fields}
					onChange={onChange}
					onDelete={onDelete}
					onInsert={onInsert}
					onMove={onMove}
				/>
			</article>

			<article class="query-column">
				<h3>Snapshot fields</h3>
				<p>
					{currentQuerySnapshot.fields.length} queryable fields serialized for the worker, including
					{currentQuerySnapshot.fields.filter((field: (typeof currentQuerySnapshot.fields)[number]) => field.multiValued).length} multi-valued
					enrichments.
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

				<h3>Execution result</h3>
				{#if queryResult}
					{@const currentQueryResult = queryResult}
					<p>
						<strong>{currentQueryResult.matchedCityIndexes.length}</strong> cities matched.
					</p>
					<p>
						Diagnostics: {currentQueryResult.diagnostics.length} item(s), including
						{currentQueryResult.diagnostics.filter((diagnostic: (typeof currentQueryResult.diagnostics)[number]) => diagnostic.severity === 'error').length}
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
					<div class="diagnostic-list">
						{#each currentQueryResult.diagnostics as diagnostic}
							<div class={`diagnostic-card ${diagnostic.severity}`}>
								<strong>{diagnostic.severity}</strong>
								<span>{diagnostic.code}</span>
								<pre>{JSON.stringify(diagnostic, null, 2)}</pre>
							</div>
						{/each}
					</div>
				{:else}
					<p>No query executed yet.</p>
				{/if}
			</article>
		</div>
	</section>
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

	.query-panel {
		display: grid;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.query-header {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 1rem;
	}

	.query-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: start;
		gap: 0.6rem;
	}

	.query-layout {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
		gap: 1rem;
		align-items: start;
	}

	.query-column {
		display: grid;
		gap: 0.85rem;
	}

	.query-column h3 {
		margin: 0;
	}

	.eyebrow {
		margin: 0 0 0.4rem;
		font-size: 0.74rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #8ae0dc;
	}

	.lede {
		max-width: 70ch;
	}

	.error {
		border-color: rgba(227, 114, 91, 0.34);
		background: rgba(52, 21, 17, 0.84);
	}

	.inline-error {
		margin-bottom: 1rem;
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

	button {
		padding: 0.7rem 0.8rem;
		border: 1px solid rgba(138, 168, 178, 0.22);
		border-radius: 0.8rem;
		background: rgba(9, 14, 20, 0.9);
		color: #d7e2e4;
	}

	button {
		cursor: pointer;
		font-weight: 700;
	}

	@media (max-width: 960px) {
		.query-layout {
			grid-template-columns: 1fr;
		}
	}
</style>
