<script lang="ts">
	import type { MetricCardItem } from './metricCards';

	export let items: MetricCardItem[] = [];
	export let headingTag: 'h2' | 'h3' = 'h3';
</script>

<section class="metric-grid">
	{#each items as item}
		<article class="panel">
			<svelte:element this={headingTag}>{item.title}</svelte:element>
			{#each item.lines as line}
				<p>{line}</p>
			{/each}
		</article>
	{/each}
</section>

<style>
	.metric-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		gap: 1rem;
		margin: 1rem 0;
	}

	.panel {
		padding: 1.1rem 1.2rem;
		background: rgba(12, 19, 26, 0.8);
		border: 1px solid rgba(138, 168, 178, 0.2);
		border-radius: 1rem;
		overflow: auto;
		min-width: 0;
	}

	.panel :global(h2),
	.panel :global(h3) {
		margin-top: 0;
	}

	.panel :global(p:last-child) {
		margin-bottom: 0;
	}
</style>
