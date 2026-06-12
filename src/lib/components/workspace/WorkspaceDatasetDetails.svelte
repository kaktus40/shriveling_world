<script lang="ts">
	import type { QueryableField } from '$lib/domain/data';
	import type { WorkspaceCitySummary, WorkspaceModeSummary } from '$lib/application/workspace';
	import DiagnosticsDetails from '$lib/components/shared/DiagnosticsDetails.svelte';

	export let modes: WorkspaceModeSummary[] = [];
	export let cities: WorkspaceCitySummary[] = [];
	export let fieldPreview: QueryableField[] = [];
	export let preparedDatasetDiagnostics: unknown = [];

	function degrees(valueRadians: number): string {
		return ((valueRadians * 180) / Math.PI).toFixed(3);
	}

	function yearLabel(value: number | null): string {
		return value === null ? 'unbounded' : String(value);
	}
</script>

<section class="content-grid">
	<article class="panel">
		<h2>Transport modes</h2>
		<table>
			<thead>
				<tr>
					<th>Idx</th>
					<th>Code</th>
					<th>Name</th>
					<th>Role</th>
					<th>Active years</th>
				</tr>
			</thead>
			<tbody>
				{#each modes as mode}
					<tr>
						<td>{mode.modeIndex}</td>
						<td>{mode.modeCode}</td>
						<td>{mode.name}</td>
						<td>{mode.terrestrial ? 'cone' : 'curve'}</td>
						<td>{yearLabel(mode.yearBegin)} to {yearLabel(mode.yearEnd)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</article>

	<article class="panel">
		<h2>City preview</h2>
		<table>
			<thead>
				<tr>
					<th>Idx</th>
					<th>Code</th>
					<th>Lon</th>
					<th>Lat</th>
					<th>Linked</th>
					<th>In</th>
					<th>Out</th>
				</tr>
			</thead>
			<tbody>
				{#each cities as city}
					<tr>
						<td>{city.cityIndex}</td>
						<td>{city.cityCode}</td>
						<td>{degrees(city.longitudeRadians)}°</td>
						<td>{degrees(city.latitudeRadians)}°</td>
						<td>{city.linkedRecordCount}</td>
						<td>{city.inEdgeCount}</td>
						<td>{city.outEdgeCount}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</article>
</section>

<section class="content-grid">
	<article class="panel">
		<h2>Queryable fields</h2>
		<table>
			<thead>
				<tr>
					<th>Source</th>
					<th>Column</th>
					<th>Occurrences</th>
					<th>Characteristic</th>
				</tr>
			</thead>
			<tbody>
				{#each fieldPreview as field}
					<tr>
						<td>{field.sourceKind}</td>
						<td>{field.column}</td>
						<td>{field.occurrences}</td>
						<td>{field.characteristic ? 'yes' : 'no'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</article>

	<DiagnosticsDetails title="Diagnostics" subtitle="prepared dataset" headingTag="h2">
		<pre>{JSON.stringify(preparedDatasetDiagnostics, null, 2)}</pre>
	</DiagnosticsDetails>
</section>

<style>
	.content-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.panel {
		padding: 1.1rem 1.2rem;
		background: rgba(12, 19, 26, 0.8);
		border: 1px solid rgba(138, 168, 178, 0.2);
		border-radius: 1rem;
		overflow: auto;
		min-width: 0;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		padding: 0.45rem 0.35rem;
		border-bottom: 1px solid rgba(138, 168, 178, 0.12);
		text-align: left;
		font-size: 0.95rem;
	}

	th {
		color: #9fb1b7;
		font-size: 0.82rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.panel h2 {
		margin-top: 0;
	}

	pre {
		max-height: 20rem;
		overflow: auto;
		white-space: pre-wrap;
		color: #d7e2e4;
	}
</style>
