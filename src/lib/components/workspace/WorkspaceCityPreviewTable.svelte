<script lang="ts">
	import type { WorkspaceCitySummary } from '$lib/application/workspace';

	export let cities: WorkspaceCitySummary[] = [];

	function degrees(valueRadians: number): string {
		return ((valueRadians * 180) / Math.PI).toFixed(3);
	}
</script>

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

<style>
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
</style>
