<script lang="ts">
	import type { QueryFieldDefinition } from '$lib/application/query';
	import type { QueryNode } from '$lib/domain/query';
	import { createLeafFromField } from '$lib/application/query';
	import { createEmptyGroup } from './queryEditor';
	import QueryNodeGroupEditor from './QueryNodeGroupEditor.svelte';
	import QueryNodeLeafEditor from './QueryNodeLeafEditor.svelte';

	export let node: QueryNode;
	export let fields: QueryFieldDefinition[] = [];
	export let path: number[] = [];
	export let depth = 0;
	export let index = 0;
	export let siblingCount = 1;
	export let onChange: (path: number[], nextNode: QueryNode) => void = () => undefined;
	export let onDelete: (path: number[]) => void = () => undefined;
	export let onInsert: (path: number[], child: QueryNode) => void = () => undefined;
	export let onMove: (path: number[], direction: -1 | 1) => void = () => undefined;

	function addLeaf(targetPath: number[]): void {
		const field = fields[0];
		const child = field ? createLeafFromField(field) : createEmptyGroup();
		onInsert(targetPath, child);
	}

	function addGroup(targetPath: number[]): void {
		onInsert(targetPath, createEmptyGroup());
	}
</script>

{#if node.nodeType === 'group'}
	<QueryNodeGroupEditor
		node={node}
		{path}
		{depth}
		{index}
		{siblingCount}
		{onChange}
		{onDelete}
		{onMove}
		onAddLeaf={addLeaf}
		onAddGroup={addGroup}
	>
		{#each node.filters as child, childIndex}
			<svelte:self
				node={child}
				fields={fields}
				path={[...path, childIndex]}
				depth={depth + 1}
				index={childIndex}
				siblingCount={node.filters.length}
				{onChange}
				{onDelete}
				{onInsert}
				{onMove}
			/>
		{/each}
	</QueryNodeGroupEditor>
{:else}
	<QueryNodeLeafEditor {node} {fields} {path} {depth} {onChange} {onDelete} />
{/if}
