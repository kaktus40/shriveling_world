<script lang="ts">
	import QueryExecutionResultPanel from '$lib/components/query/QueryExecutionResultPanel.svelte';
	import QueryNodeEditor from '$lib/components/query/QueryNodeEditor.svelte';
	import type { QueryDatasetSnapshot, QueryExecutionResult } from '$lib/application/query';
	import type { QueryNode } from '$lib/domain/query';

	export let querySnapshot: QueryDatasetSnapshot | null = null;
	export let queryTree: QueryNode | null = null;
	export let queryResult: QueryExecutionResult | null = null;
	export let queryError = '';
	export let queryLoading = false;
	export let selectedCityIndex = -1;
	export let cityIds: readonly number[] = [];
	export let cityCodes: readonly number[] = [];
	export let onRun: () => void = () => undefined;
	export let onReset: () => void = () => undefined;
	export let onChange: (path: number[], nextNode: QueryNode) => void = () => undefined;
	export let onDelete: (path: number[]) => void = () => undefined;
	export let onInsert: (path: number[], child: QueryNode) => void = () => undefined;
	export let onMove: (path: number[], direction: -1 | 1) => void = () => undefined;
	export let onSelectCityIndex: (cityIndex: number) => void = () => undefined;

	let hovered = false;
</script>

<section
	class:expanded={hovered}
	class="panel query-panel"
	role="group"
	aria-label="Query controls"
	on:mouseenter={() => (hovered = true)}
	on:mouseleave={() => (hovered = false)}
>
	<header class="panel-head">
		<div>
			<p class="eyebrow">Query</p>
			<h2>Highlight matching cities</h2>
		</div>
		<div class="actions">
			<button type="button" class="action" on:click={() => void onRun()} disabled={queryLoading}>
				{queryLoading ? 'Running...' : 'Run query'}
			</button>
			<button type="button" class="action" on:click={onReset} disabled={queryLoading}>
				Reset tree
			</button>
		</div>
	</header>

	<div class="teaser">
		<span>{querySnapshot ? `${querySnapshot.fields.length} fields` : 'No snapshot'}</span>
		<span>{queryResult ? `${queryResult.matchedCityIndexes.length} matches` : 'No result'}</span>
		<span>{selectedCityIndex >= 0 ? `Focus #${selectedCityIndex}` : 'No focus'}</span>
	</div>

	{#if hovered}
		{#if queryError}
			<div class="error inline-error">
				<pre>{queryError}</pre>
			</div>
		{/if}

		{#if querySnapshot && queryTree}
			<div class="query-tree">
				<QueryNodeEditor
					node={queryTree}
					fields={querySnapshot.fields}
					onChange={onChange}
					onDelete={onDelete}
					onInsert={onInsert}
					onMove={onMove}
				/>
			</div>

			<QueryExecutionResultPanel
				{querySnapshot}
				{queryResult}
				{cityIds}
				{cityCodes}
				{selectedCityIndex}
				selectable={true}
				onSelectCityIndex={onSelectCityIndex}
			/>
		{:else}
			<p class="empty">Waiting for query snapshot.</p>
		{/if}
	{/if}
</section>

<style>
	.panel {
		pointer-events: auto;
		width: min(34rem, calc(100vw - 2rem));
		margin: 0 1rem 1rem;
		padding: 0.9rem 1rem;
		border-radius: 1rem;
		border: 1px solid rgba(138, 168, 178, 0.2);
		background: rgba(8, 12, 16, 0.72);
		backdrop-filter: blur(18px);
		box-shadow: 0 1rem 2rem rgba(0, 0, 0, 0.28);
		display: grid;
		gap: 0.65rem;
		color: #e5efef;
		transition:
			transform 160ms ease,
			background 160ms ease,
			border-color 160ms ease;
	}

	.panel:hover,
	.expanded {
		background: rgba(8, 12, 16, 0.84);
		border-color: rgba(138, 168, 178, 0.35);
		transform: translateY(-1px);
	}

	.panel-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.eyebrow {
		margin: 0 0 0.1rem;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #88d6d2;
	}

	h2 {
		margin: 0;
		font-size: 1rem;
		letter-spacing: 0.03em;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: start;
		gap: 0.5rem;
	}

	.action {
		border: 1px solid rgba(138, 168, 178, 0.3);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.04);
		color: inherit;
		padding: 0.45rem 0.8rem;
		font: inherit;
		cursor: pointer;
	}

	.action:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.teaser {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.teaser span {
		padding: 0.3rem 0.55rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.06);
		color: #bbd2d5;
		font-size: 0.82rem;
	}

	.query-tree {
		display: grid;
		gap: 0.65rem;
	}

	.empty {
		margin: 0;
		color: #b6c8cb;
	}
</style>
