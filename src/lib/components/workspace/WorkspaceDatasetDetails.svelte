<script lang="ts">
	import type { WorkspaceCitySummary, WorkspaceModeSummary } from '$lib/application/workspace';
	import WorkspaceTransportModesTable from './WorkspaceTransportModesTable.svelte';
	import WorkspaceCityPreviewTable from './WorkspaceCityPreviewTable.svelte';
	import WorkspaceQueryableFieldsTable from './WorkspaceQueryableFieldsTable.svelte';
	import DiagnosticsDetails from '$lib/components/shared/DiagnosticsDetails.svelte';

	export let modes: WorkspaceModeSummary[] = [];
	export let cities: WorkspaceCitySummary[] = [];
	export let fieldPreview: import('$lib/domain/data').QueryableField[] = [];
	export let preparedDatasetDiagnostics: unknown = [];
</script>

<section class="content-grid">
	<WorkspaceTransportModesTable {modes} />
	<WorkspaceCityPreviewTable {cities} />
</section>

<section class="content-grid">
	<WorkspaceQueryableFieldsTable {fieldPreview} />

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

	pre {
		max-height: 20rem;
		overflow: auto;
		white-space: pre-wrap;
		color: #d7e2e4;
	}
</style>
