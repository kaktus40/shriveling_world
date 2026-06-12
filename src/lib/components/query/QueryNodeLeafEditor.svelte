<script lang="ts">
	import type { QueryFieldDefinition } from '$lib/application/query';
	import type { QueryLeaf } from '$lib/domain/query';
	import { currentFieldForNode, isComparatorValueFree, selectComparatorNode, selectFieldNode, selectValueNode } from './queryEditor';

	export let node: QueryLeaf;
	export let fields: QueryFieldDefinition[] = [];
	export let path: number[] = [];
	export let depth = 0;
	export let onChange: (path: number[], nextNode: QueryLeaf) => void = () => undefined;
	export let onDelete: (path: number[]) => void = () => undefined;

	const indentStyle = `margin-inline-start: ${depth * 1.1}rem;`;

	function selectField(fieldKey: string): void {
		const nextNode = selectFieldNode(node, fields, fieldKey);
		if (!nextNode) {
			return;
		}
		onChange(path, nextNode);
	}

	function selectComparator(comparator: string): void {
		const nextNode = selectComparatorNode(node, fields, comparator);
		if (!nextNode) {
			return;
		}
		onChange(path, nextNode);
	}

	function selectValue(event: Event): void {
		const target = event.currentTarget as HTMLInputElement | HTMLSelectElement | null;
		if (!target) {
			return;
		}

		const nextNode = selectValueNode(node, fields, target.value);
		if (!nextNode) {
			return;
		}
		onChange(path, nextNode);
	}

	$: currentField = currentFieldForNode(node, fields);
	$: comparatorOptions = currentField?.supportedComparators ?? ['=', '<>', 'empty', 'not empty'];
	$: comparatorValueFree = isComparatorValueFree(node);
</script>

<section class="query-node leaf" style={indentStyle}>
	<header class="node-head">
		<div class="node-title">
			<span class="chip leaf-chip">Filter</span>
			<span class="field-label">{currentField?.label ?? node.fieldKey}</span>
		</div>

		{#if path.length > 0}
			<button type="button" class="danger" on:click={() => onDelete(path)}>Remove</button>
		{/if}
	</header>

	<div class="leaf-grid">
		<label>
			<span>Field</span>
			<select value={node.fieldKey} on:change={(event) => selectField((event.currentTarget as HTMLSelectElement).value)}>
				{#each fields as field}
					<option value={field.fieldKey}>{field.label}</option>
				{/each}
			</select>
		</label>

		<label>
			<span>Comparator</span>
			<select
				value={node.comparator}
				on:change={(event) => selectComparator((event.currentTarget as HTMLSelectElement).value)}
			>
				{#each comparatorOptions as comparator}
					<option value={comparator}>{comparator}</option>
				{/each}
			</select>
		</label>

		<label class:full-width={!comparatorValueFree}>
			<span>Value</span>
			{#if currentField?.valueType === 'boolean'}
				<select
					value={String(node.value ?? false)}
					disabled={!comparatorValueFree}
					on:change={selectValue}
				>
					<option value="false">false</option>
					<option value="true">true</option>
				</select>
			{:else if currentField?.valueType === 'number'}
				<input
					type="number"
					value={String(node.value ?? '')}
					disabled={!comparatorValueFree}
					on:input={selectValue}
				/>
			{:else}
				<input
					type="text"
					value={String(node.value ?? '')}
					disabled={!comparatorValueFree}
					on:input={selectValue}
				/>
			{/if}
		</label>
	</div>
</section>

<style>
	.query-node {
		padding: 0.9rem 1rem;
		border: 1px solid rgba(138, 168, 178, 0.18);
		border-radius: 1rem;
		background: rgba(12, 19, 26, 0.8);
	}

	.node-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.8rem;
	}

	.node-title {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.55rem;
	}

	.chip {
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		background: rgba(138, 224, 220, 0.12);
		color: #8ae0dc;
	}

	.leaf-chip {
		background: rgba(158, 168, 178, 0.12);
		color: #c2ccd2;
	}

	.field-label {
		font-weight: 700;
	}

	.leaf-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
	}

	label {
		display: grid;
		gap: 0.32rem;
	}

	label span {
		font-size: 0.78rem;
		font-weight: 700;
		color: #9fb1b7;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	select,
	input,
	button {
		min-height: 2.35rem;
		padding: 0.4rem 0.65rem;
		border: 1px solid rgba(138, 168, 178, 0.22);
		border-radius: 0.75rem;
		background: rgba(9, 14, 20, 0.92);
		color: #d7e2e4;
	}

	button {
		cursor: pointer;
		font-weight: 700;
	}

	button.danger {
		border-color: rgba(227, 114, 91, 0.36);
		color: #ffb6a7;
		background: rgba(52, 21, 17, 0.9);
	}

	.full-width {
		grid-column: 1 / -1;
	}

	@media (max-width: 760px) {
		.leaf-grid {
			grid-template-columns: 1fr;
		}

		.node-head {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
