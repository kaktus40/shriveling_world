<script lang="ts">
	export let title = 'Diagnostics';
	export let subtitle = '';
	export let open = true;
	export let headingTag: 'h2' | 'h3' = 'h3';
</script>

<details class="panel diagnostic-panel" {open}>
	<summary>
		<svelte:element this={headingTag}>{title}</svelte:element>
		{#if subtitle}
			<span>{subtitle}</span>
		{/if}
	</summary>
	<div class="diagnostic-body">
		<slot />
	</div>
</details>

<style>
	.panel {
		padding: 1.1rem 1.2rem;
		background: rgba(12, 19, 26, 0.8);
		border: 1px solid rgba(138, 168, 178, 0.2);
		border-radius: 1rem;
		overflow: auto;
		min-width: 0;
	}

	.diagnostic-panel {
		margin: 0;
	}

	.diagnostic-panel > summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		cursor: pointer;
		list-style: none;
	}

	.diagnostic-panel > summary::-webkit-details-marker {
		display: none;
	}

	.diagnostic-panel > summary span {
		color: #8ea3aa;
		font-size: 0.82rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.diagnostic-body :global(pre) {
		max-height: 28rem;
		overflow: auto;
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
