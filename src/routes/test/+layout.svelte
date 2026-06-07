<script lang="ts">
	export let data: {
		datasets: string[];
	};

	const entries = [
		{
			href: '/test',
			label: 'Overview',
			description: 'Intent and mapping of the historical validation pages.',
		},
		{
			href: '/test/test1',
			label: 'test1',
			description: 'Dataset ingestion, manifest resolution, prepared buffers, and boundary limits.',
		},
		{
			href: '/test/test2',
			label: 'test2',
			description: 'Country contours, triangulation, and city to contour association.',
		},
		{
			href: '/test/test3',
			label: 'test3',
			description: 'Static, dynamic, raw, and intersected CPU cone precomputes.',
		},
	];
</script>

<div class="test-shell">
	<aside class="sidebar">
		<p class="eyebrow">Validation Routes</p>
		<h1>Migration Test Bench</h1>
		<p class="lede">
			Modern SvelteKit replacements for the historical `src/routes/test` pages. The goal is to
			validate the migration pipeline step by step with the new data and precompute domains.
		</p>

		<nav class="nav">
			{#each entries as entry}
				<a class="nav-entry" href={entry.href}>
					<strong>{entry.label}</strong>
					<span>{entry.description}</span>
				</a>
			{/each}
		</nav>

		<section class="dataset-note">
			<h2>Bundled datasets</h2>
			<p>{data.datasets.length} compressed datasets available through `static/datasets`.</p>
		</section>
	</aside>

	<main class="content">
		<slot />
	</main>
</div>

<style>
	:global(body) {
		margin: 0;
	}

	.test-shell {
		--ink: #1c2428;
		--muted: #51636d;
		--panel: rgba(255, 255, 255, 0.82);
		--line: rgba(28, 36, 40, 0.14);
		--accent: #0d6f73;
		display: grid;
		grid-template-columns: minmax(18rem, 24rem) 1fr;
		min-height: 100vh;
		color: var(--ink);
		background:
			radial-gradient(circle at top left, rgba(13, 111, 115, 0.18), transparent 22rem),
			linear-gradient(180deg, #edf4f3 0%, #f7f2ea 100%);
	}

	.sidebar {
		padding: 2rem 1.5rem;
		border-right: 1px solid var(--line);
		background: rgba(246, 251, 250, 0.76);
		backdrop-filter: blur(10px);
	}

	.content {
		padding: 2rem;
	}

	.eyebrow {
		margin: 0 0 0.75rem;
		font-size: 0.76rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--accent);
	}

	h1 {
		margin: 0;
		font-size: clamp(2rem, 4vw, 3.2rem);
		line-height: 0.95;
	}

	.lede {
		color: var(--muted);
	}

	.nav {
		display: grid;
		gap: 0.85rem;
		margin: 1.5rem 0;
	}

	.nav-entry {
		display: grid;
		gap: 0.25rem;
		padding: 0.9rem 1rem;
		text-decoration: none;
		color: inherit;
		border: 1px solid var(--line);
		border-radius: 1rem;
		background: var(--panel);
		transition:
			transform 120ms ease,
			border-color 120ms ease;
	}

	.nav-entry:hover {
		transform: translateY(-1px);
		border-color: rgba(13, 111, 115, 0.36);
	}

	.nav-entry span,
	.dataset-note p {
		color: var(--muted);
	}

	.dataset-note {
		padding: 1rem;
		border: 1px solid var(--line);
		border-radius: 1rem;
		background: var(--panel);
	}

	.dataset-note h2 {
		margin-top: 0;
		font-size: 1rem;
	}

	@media (max-width: 960px) {
		.test-shell {
			grid-template-columns: 1fr;
		}

		.sidebar {
			border-right: 0;
			border-bottom: 1px solid var(--line);
		}
	}
</style>
