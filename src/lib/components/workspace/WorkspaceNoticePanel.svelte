<script lang="ts">
	export let title = '';
	export let message = '';
	export let kind: 'error' | 'info' = 'error';
</script>

<section class={`panel ${kind}`}>
	<h2>{title}</h2>
	<pre>{message}</pre>
</section>

<style>
	.panel {
		padding: 1.1rem 1.2rem;
		background: rgba(12, 19, 26, 0.8);
		border: 1px solid rgba(138, 168, 178, 0.2);
		border-radius: 1rem;
		overflow: auto;
		min-width: 0;
		margin-bottom: 1rem;
	}

	.panel h2 {
		margin-top: 0;
	}

	.panel pre {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.error {
		border-color: rgba(227, 114, 91, 0.34);
		background: rgba(52, 21, 17, 0.84);
	}
</style>
