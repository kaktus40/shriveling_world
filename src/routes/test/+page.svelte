<script lang="ts">
	export let data: {
		datasets: string[];
	};

	const mappings = [
		{
			title: 'test1',
			href: '/test/test1',
			historicalRole: 'Load one dataset, inspect the first validated outputs, and verify the data pipeline end to end.',
			migrationRole:
				'Load one compressed dataset, inspect files, resolve the manifest, build the lossless base network, then prepare compact buffers and boundary limits.',
		},
		{
			title: 'test2',
			href: '/test/test2',
			historicalRole: 'Focus on country geometry and extrusion without the rest of the application.',
			migrationRole:
				'Inspect GeoJSON contours, triangulated country meshes, contour buffers, and city to contour association produced by `prepareBoundaryPrecompute`.',
		},
		{
			title: 'test3',
			href: '/test/test3',
			historicalRole: 'Inspect cone geometry stage by stage, from raw calculation to displayed geometry.',
			migrationRole:
				'Inspect the CPU reference pipeline stage by stage: static invariants, dynamic year links, raw cones, and ciseled intersections.',
		},
	];
</script>

<section class="hero">
	<p class="eyebrow">Historical Mapping</p>
	<h2>What survived the migration</h2>
	<p>
		The original pages were not business routes. They were engineering checkpoints. This port keeps
		that role, but swaps the legacy `Merger`, `reader`, and `mesherEngine` for the new explicit
		domain modules and shared workspace services.
	</p>
</section>

<section class="grid">
	{#each mappings as mapping}
		<article class="card">
			<h3>{mapping.title}</h3>
			<p><strong>Legacy intent.</strong> {mapping.historicalRole}</p>
			<p><strong>Migration route.</strong> {mapping.migrationRole}</p>
			<a href={mapping.href}>Open validation page</a>
		</article>
	{/each}
</section>

<section class="footnote">
	<h3>Current scope</h3>
	<p>
		These routes deliberately stop at the modern data and CPU precompute contracts. Babylon.js
		rendering will plug into the same prepared buffers later. The query workspace now lives in the
		application shell and is no longer part of this validation bench.
	</p>
	<p>{data.datasets.length} bundled datasets are immediately available for these checks.</p>
</section>

<style>
	.hero,
	.footnote {
		max-width: 60rem;
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		font-size: 0.74rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #0d6f73;
	}

	h2 {
		margin: 0;
		font-size: clamp(2rem, 4vw, 3.4rem);
		line-height: 0.96;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: 1rem;
		margin: 1.75rem 0;
	}

	.card {
		padding: 1.2rem;
		border: 1px solid rgba(141, 168, 178, 0.2);
		border-radius: 1rem;
		background: rgba(14, 21, 28, 0.8);
	}

	.card h3 {
		margin-top: 0;
		font-size: 1.4rem;
	}

	a {
		color: #0d6f73;
		font-weight: 700;
	}
</style>
