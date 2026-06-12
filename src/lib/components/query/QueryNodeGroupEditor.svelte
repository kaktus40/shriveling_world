<script lang="ts">
	import type { QueryNode } from '$lib/domain/query';
	import { toggleGroupTypeNode } from './queryEditor';

	export let node: Extract<QueryNode, { nodeType: 'group' }>;
	export let path: number[] = [];
	export let index = 0;
	export let siblingCount = 1;
	export let depth = 0;
	export let onChange: (path: number[], nextNode: QueryNode) => void = () => undefined;
	export let onDelete: (path: number[]) => void = () => undefined;
	export let onMove: (path: number[], direction: -1 | 1) => void = () => undefined;
	export let onAddLeaf: (path: number[]) => void = () => undefined;
	export let onAddGroup: (path: number[]) => void = () => undefined;

	const indentStyle = `margin-inline-start: ${depth * 1.1}rem;`;

	function toggleGroupType(type: 'AND' | 'OR'): void {
		const nextNode = toggleGroupTypeNode(node, type);
		if (!nextNode) {
			return;
		}
		onChange(path, nextNode);
	}

	function addLeaf(): void {
		onAddLeaf(path);
	}

	function addGroup(): void {
		onAddGroup(path);
	}

	function moveUp(): void {
		onMove(path, -1);
	}

	function moveDown(): void {
		onMove(path, 1);
	}
</script>

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
				<button type="button" on:click={moveUp} disabled={index === 0}>Move up</button>
				<button type="button" on:click={moveDown} disabled={index >= siblingCount - 1}>Move down</button>
			{/if}
			{#if path.length > 0}
				<button type="button" class="danger" on:click={() => onDelete(path)}>Remove</button>
			{/if}
		</div>
	</header>

	{#if node.filters.length === 0}
		<p class="empty-note">Empty group. Add a filter or a nested group.</p>
	{:else}
		<div class="children">
			<slot />
		</div>
	{/if}
</section>

<style>
	.query-node {
		padding: 0.9rem 1rem;
		border: 1px solid rgba(138, 168, 178, 0.18);
		border-radius: 1rem;
		background: rgba(12, 19, 26, 0.8);
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
		background: rgba(138, 224, 220, 0.12);
		color: #8ae0dc;
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

	button,
	select {
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

	.empty-note {
		margin: 0;
		color: #9fb1b7;
		font-style: italic;
	}

	@media (max-width: 760px) {
		.node-head {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
