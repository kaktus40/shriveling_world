<script lang="ts">
	import QueryNodeEditor from '$lib/components/query/QueryNodeEditor.svelte';
	import QuerySnapshotFieldsPanel from '$lib/components/query/QuerySnapshotFieldsPanel.svelte';
	import QueryExecutionResultPanel from '$lib/components/query/QueryExecutionResultPanel.svelte';
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

			<QuerySnapshotFieldsPanel querySnapshot={currentQuerySnapshot} />
			<QueryExecutionResultPanel
				{querySnapshot}
				{queryResult}
				{cityIds}
				{cityCodes}
			/>
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

	@media (max-width: 960px) {
		.query-layout {
			grid-template-columns: 1fr;
		}
	}
</style>
