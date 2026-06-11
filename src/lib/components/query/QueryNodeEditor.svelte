<script lang="ts">
	import {
		createLeafFromField,
		defaultComparatorForField,
		defaultValueForField,
		type QueryFieldDefinition,
	} from '$lib/application/query';
	import type { QueryGroup, QueryLeaf, QueryNode, QueryScalar } from '$lib/domain/query';

	export let node: QueryNode;
	export let fields: QueryFieldDefinition[] = [];
	export let path: number[] = [];
	export let depth = 0;
	export let onChange: (path: number[], nextNode: QueryNode) => void = () => undefined;
	export let onDelete: (path: number[]) => void = () => undefined;
	export let onInsert: (path: number[], child: QueryNode) => void = () => undefined;

	function currentField(): QueryFieldDefinition | undefined {
		if (node.nodeType !== 'filter') {
			return undefined;
		}
		return fields.find((field) => field.fieldKey === node.fieldKey) ?? fields[0];
	}

	function selectField(fieldKey: string): void {
		const nextField = fields.find((field) => field.fieldKey === fieldKey) ?? fields[0];
		if (!nextField || node.nodeType !== 'filter') {
			return;
		}

		onChange(path, {
			...node,
			fieldKey: nextField.fieldKey,
			comparator: defaultComparatorForField(nextField),
			value: defaultValueForField(nextField),
		});
	}

	function selectComparator(comparator: string): void {
		if (node.nodeType !== 'filter') {
			return;
		}

		const nextComparator = comparator as QueryLeaf['comparator'];
		const selectedField = currentField();
		const nextValue =
			nextComparator === 'empty' || nextComparator === 'not empty'
				? null
				: node.value ?? defaultValueForField(selectedField ?? fields[0] ?? createSyntheticField(node.fieldKey));

		onChange(path, {
			...node,
			comparator: nextComparator,
			value: nextValue,
		});
	}

	function selectValue(event: Event): void {
		if (node.nodeType !== 'filter') {
			return;
		}

		const target = event.currentTarget as HTMLInputElement | HTMLSelectElement | null;
		if (!target) {
			return;
		}

		onChange(path, {
			...node,
			value: coerceValue(target.value, currentField()?.valueType ?? 'unknown'),
		});
	}

	function toggleGroupType(type: 'AND' | 'OR'): void {
		if (node.nodeType !== 'group') {
			return;
		}

		onChange(path, {
			...node,
			type,
		});
	}

	function addLeaf(): void {
		const field = fields[0];
		onInsert(path, field ? createLeafFromField(field) : createEmptyGroup());
	}

	function addGroup(): void {
		onInsert(path, createEmptyGroup());
	}

	function isComparatorValueFree(): boolean {
		return node.nodeType === 'filter' && node.comparator !== 'empty' && node.comparator !== 'not empty';
	}

	function createSyntheticField(fieldKey: string): QueryFieldDefinition {
		return {
			fieldKey,
			label: fieldKey,
			sourceKind: 'cities',
			sourceFileName: 'synthetic',
			column: fieldKey,
			valueType: 'unknown',
			characteristic: false,
			multiValued: false,
			supportedComparators: ['=', '<>', 'empty', 'not empty', 'in'] as QueryFieldDefinition['supportedComparators'],
		};
	}

	function createEmptyGroup(): QueryGroup {
		return {
			nodeType: 'group',
			type: 'AND',
			filters: [],
		};
	}

	function coerceValue(rawValue: string, valueType: QueryFieldDefinition['valueType']): QueryScalar {
		if (rawValue === '') {
			return '';
		}

		switch (valueType) {
			case 'number': {
				const parsed = Number(rawValue);
				return Number.isNaN(parsed) ? 0 : parsed;
			}
			case 'boolean':
				return rawValue === 'true';
			case 'string':
			case 'unknown':
			default:
				return rawValue;
		}
	}

	const indentStyle = `margin-inline-start: ${depth * 1.1}rem;`;
</script>

{#if node.nodeType === 'group'}
	<section class="query-node group" style={indentStyle}>
		<header class="node-head">
			<div class="node-title">
				<span class="chip">Group</span>
				<select
					value={node.type}
					on:change={(event) => toggleGroupType((event.currentTarget as HTMLSelectElement).value as 'AND' | 'OR')}
				>
					<option value="AND">AND</option>
					<option value="OR">OR</option>
				</select>
			</div>

			<div class="node-actions">
				<button type="button" on:click={addLeaf}>Add filter</button>
				<button type="button" on:click={addGroup}>Add group</button>
				{#if path.length > 0}
					<button type="button" class="danger" on:click={() => onDelete(path)}>Remove</button>
				{/if}
			</div>
		</header>

		{#if node.filters.length === 0}
			<p class="empty-note">Empty group. Add a filter or a nested group.</p>
		{:else}
			<div class="children">
				{#each node.filters as child, index}
					<svelte:self
						node={child}
						fields={fields}
						path={[...path, index]}
						depth={depth + 1}
						{onChange}
						{onDelete}
						{onInsert}
					/>
				{/each}
			</div>
		{/if}
	</section>
{:else}
	<section class="query-node leaf" style={indentStyle}>
		<header class="node-head">
			<div class="node-title">
				<span class="chip leaf-chip">Filter</span>
				<span class="field-label">{currentField()?.label ?? node.fieldKey}</span>
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
					{#each (currentField()?.supportedComparators ?? ['=', '<>', 'empty', 'not empty']) as comparator}
						<option value={comparator}>{comparator}</option>
					{/each}
				</select>
			</label>

			<label class:full-width={!isComparatorValueFree()}>
				<span>Value</span>
				{#if currentField()?.valueType === 'boolean'}
					<select
						value={String(node.value ?? false)}
						disabled={!isComparatorValueFree()}
						on:change={selectValue}
					>
						<option value="false">false</option>
						<option value="true">true</option>
					</select>
				{:else if currentField()?.valueType === 'number'}
					<input
						type="number"
						value={String(node.value ?? '')}
						disabled={!isComparatorValueFree()}
						on:input={selectValue}
					/>
				{:else}
					<input
						type="text"
						value={String(node.value ?? '')}
						disabled={!isComparatorValueFree()}
						on:input={selectValue}
					/>
				{/if}
			</label>
		</div>
	</section>
{/if}

<style>
	.query-node {
		padding: 0.9rem 1rem;
		border: 1px solid rgba(28, 36, 40, 0.14);
		border-radius: 1rem;
		background: rgba(255, 255, 255, 0.78);
	}

	.group {
		margin-bottom: 0.85rem;
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
		background: rgba(13, 111, 115, 0.12);
		color: #0d6f73;
	}

	.leaf-chip {
		background: rgba(88, 104, 120, 0.12);
		color: #4b5b67;
	}

	.field-label {
		font-weight: 700;
	}

	.node-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.children {
		display: grid;
		gap: 0.65rem;
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
		color: #51636d;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	select,
	input,
	button {
		min-height: 2.35rem;
		padding: 0.4rem 0.65rem;
		border: 1px solid rgba(28, 36, 40, 0.2);
		border-radius: 0.75rem;
		background: white;
	}

	button {
		cursor: pointer;
		font-weight: 700;
	}

	button.danger {
		border-color: rgba(176, 95, 75, 0.3);
		color: #9b4c39;
		background: rgba(255, 245, 241, 0.95);
	}

	.empty-note {
		margin: 0;
		color: #51636d;
		font-style: italic;
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
