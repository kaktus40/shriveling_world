<script lang="ts">
	export let title = '';
</script>

<article class="panel">
	<h2>{title}</h2>
	<slot />
</article>

<style>
	.panel {
		padding: 1.1rem 1.2rem;
		background: rgba(12, 19, 26, 0.8);
		border: 1px solid rgba(138, 168, 178, 0.2);
		border-radius: 1rem;
		overflow: auto;
		min-width: 0;
	}

	.panel h2 {
		margin-top: 0;
	}

	.panel :global(p:last-child) {
		margin-bottom: 0;
	}
</style>
