<script lang="ts">
	import type {
		DatasetWorkspaceCompute,
		DatasetWorkspaceSummary,
	} from '$lib/application/workspace';
	import type { ComputeConeIntersectionStrategy, ComputeProfile } from '$lib/compute';
	import WorkspaceSummaryCard from './WorkspaceSummaryCard.svelte';

	export let summary: DatasetWorkspaceSummary | null = null;
	export let workspaceCompute: DatasetWorkspaceCompute | null = null;
	export let selectedComputeProfile: ComputeProfile = 'cpu';
	export let selectedConeIntersectionStrategy: ComputeConeIntersectionStrategy = 'oracle';
	export let computeLoading = false;

	function computeSummaryLabel(profile: ComputeProfile): string {
		return profile.toUpperCase();
	}

	function computeStrategyLabel(strategy: ComputeConeIntersectionStrategy): string {
		switch (strategy) {
			case 'oracle':
				return 'Oracle';
			case 'symmetric-order':
				return 'Symmetric order';
			case 'alpha-aware-order':
				return 'Alpha-aware order';
			case 'alpha-aware-block-pruned':
				return 'Alpha-aware block-pruned';
		}
	}
</script>

{#if summary}
	<section class="summary-grid">
		<WorkspaceSummaryCard title="Dataset">
			<p><strong>Name:</strong> {summary.datasetName}</p>
			<p><strong>Source files:</strong> {summary.sourceFileCount}</p>
			<p><strong>GeoJSON files:</strong> {summary.geojsonFileCount}</p>
			<p><strong>Inspected files:</strong> {summary.inspectedFileCount}</p>
		</WorkspaceSummaryCard>

		<WorkspaceSummaryCard title="Prepared entities">
			<p><strong>Cities:</strong> {summary.cityCount}</p>
			<p><strong>Edges:</strong> {summary.edgeCount}</p>
			<p><strong>Modes:</strong> {summary.modeCount}</p>
			<p><strong>Queryable fields:</strong> {summary.queryableFieldCount}</p>
		</WorkspaceSummaryCard>

		<WorkspaceSummaryCard title="Prepared span">
			<p><strong>Begin:</strong> {summary.yearBegin}</p>
			<p><strong>End:</strong> {summary.yearEnd}</p>
			<p><strong>Errors:</strong> {summary.errorCount}</p>
			<p><strong>Warnings:</strong> {summary.warningCount}</p>
		</WorkspaceSummaryCard>

		<WorkspaceSummaryCard title="Compute profile">
			<p><strong>Requested:</strong> {computeSummaryLabel(selectedComputeProfile)}</p>
			<p><strong>Cone strategy:</strong> {computeStrategyLabel(selectedConeIntersectionStrategy)}</p>
			<p>
				<strong>Selected:</strong>
				{workspaceCompute ? computeSummaryLabel(workspaceCompute.selection.selected) : 'none'}
			</p>
			<p><strong>Fallback:</strong> {workspaceCompute?.selection.fallbackUsed ? 'yes' : 'no'}</p>
			<p><strong>Benchmark:</strong> {computeLoading ? 'running...' : 'ready'}</p>
			<p><strong>Diagnostics:</strong> {workspaceCompute ? workspaceCompute.result.diagnostics.length : 0}</p>
		</WorkspaceSummaryCard>
	</section>
{/if}

<style>
	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
	}

</style>
