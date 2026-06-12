<script lang="ts">
	import type { WorkspaceComputeResult } from '$lib/application/workspace';
	import type { DatasetDiagnostic } from '$lib/domain/data';
	import type { ComputeProfile } from '$lib/compute';
	import DiagnosticsDetails from '$lib/components/shared/DiagnosticsDetails.svelte';
	import WorkspaceComputeBenchmarkTable from './WorkspaceComputeBenchmarkTable.svelte';

	export let workspaceCompute: WorkspaceComputeResult | null = null;
	export let selectedComputeDiagnosticProfile: ComputeProfile | 'all' = 'all';
	export let computeDiagnostics: readonly DatasetDiagnostic[] = [];
	export let onDiagnosticProfileChange: (profile: ComputeProfile | 'all') => void = () => undefined;
	let computeDiagnosticCounts = {
		all: 0,
		cpu: 0,
		webgl2: 0,
		webgpu: 0,
	};
	let filteredComputeDiagnostics: readonly DatasetDiagnostic[] = [];
	let errorCount = 0;
	let warningCount = 0;

	function classifyComputeDiagnostic(diagnostic: DatasetDiagnostic): ComputeProfile {
		if (diagnostic.profile === 'cpu' || diagnostic.profile === 'webgl2' || diagnostic.profile === 'webgpu') {
			return diagnostic.profile;
		}
		const code = diagnostic.code.toLowerCase();
		if (code.startsWith('webgl2-')) {
			return 'webgl2';
		}
		if (code.startsWith('webgpu-')) {
			return 'webgpu';
		}
		return 'cpu';
	}

	function diagnosticProfileLabel(profile: ComputeProfile | 'all'): string {
		return profile === 'all' ? 'All profiles' : profile.toUpperCase();
	}

	function diagnosticMessage(diagnostic: DatasetDiagnostic): string | null {
		const message = diagnostic.message;
		return typeof message === 'string' && message.length > 0 ? message : null;
	}

	function summarizeComputeDiagnostics(diagnostics: readonly DatasetDiagnostic[]): {
		all: number;
		cpu: number;
		webgl2: number;
		webgpu: number;
	} {
		return diagnostics.reduce(
			(summary, diagnostic) => {
				const profile = classifyComputeDiagnostic(diagnostic);
				summary.all += 1;
				summary[profile] += 1;
				return summary;
			},
			{
				all: 0,
				cpu: 0,
				webgl2: 0,
				webgpu: 0,
			},
		);
	}

	$: computeDiagnosticCounts = summarizeComputeDiagnostics(computeDiagnostics);
	$: filteredComputeDiagnostics =
		selectedComputeDiagnosticProfile === 'all'
			? computeDiagnostics
			: computeDiagnostics.filter(
					(diagnostic) => classifyComputeDiagnostic(diagnostic) === selectedComputeDiagnosticProfile,
				);
	$: errorCount = computeDiagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
	$: warningCount = computeDiagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length;
</script>

{#if workspaceCompute}
	<WorkspaceComputeBenchmarkTable {workspaceCompute} />

	<DiagnosticsDetails title="Compute diagnostics" subtitle="runtime validation and fallback notes" headingTag="h2">
		<div class="diagnostic-toolbar">
			<label>
				<span>Profile</span>
				<select
					value={selectedComputeDiagnosticProfile}
					on:change={(event) =>
						onDiagnosticProfileChange((event.currentTarget as HTMLSelectElement).value as ComputeProfile | 'all')}
				>
					<option value="all">All profiles</option>
					<option value="cpu">CPU</option>
					<option value="webgl2">WebGL2</option>
					<option value="webgpu">WebGPU</option>
				</select>
			</label>
			<p>
				{computeDiagnosticCounts.all} item(s), including
				{errorCount} error(s) and {warningCount} warning(s).
			</p>
		</div>
		<div class="diagnostic-summary">
			<span>CPU {computeDiagnosticCounts.cpu}</span>
			<span>WebGL2 {computeDiagnosticCounts.webgl2}</span>
			<span>WebGPU {computeDiagnosticCounts.webgpu}</span>
		</div>
		<div class="diagnostic-list">
			{#each filteredComputeDiagnostics as diagnostic}
				{@const message = diagnosticMessage(diagnostic)}
				<div class={`diagnostic-card ${diagnostic.severity}`}>
					<div class="diagnostic-card-head">
						<strong>{diagnostic.severity}</strong>
						<span>{diagnosticProfileLabel(classifyComputeDiagnostic(diagnostic))}</span>
					</div>
					<p class="diagnostic-code">{diagnostic.code}</p>
					{#if message}
						<p class="diagnostic-message">{message}</p>
					{/if}
					<details>
						<summary>Show raw payload</summary>
						<pre>{JSON.stringify(diagnostic, null, 2)}</pre>
					</details>
				</div>
			{/each}
			{#if filteredComputeDiagnostics.length === 0}
				<p class="diagnostic-empty">No diagnostics for the selected profile.</p>
			{/if}
		</div>
	</DiagnosticsDetails>
{/if}

<style>
	.diagnostic-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.diagnostic-toolbar label {
		display: grid;
		gap: 0.25rem;
		min-width: 10rem;
	}

	.diagnostic-toolbar span,
	.diagnostic-summary span {
		color: #9fb1b7;
		font-size: 0.82rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.diagnostic-summary {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.diagnostic-list {
		display: grid;
		gap: 0.75rem;
		max-height: 24rem;
		overflow: auto;
		padding-right: 0.25rem;
	}

	.diagnostic-card {
		padding: 0.7rem 0.8rem;
		border-radius: 0.8rem;
		border: 1px solid rgba(138, 168, 178, 0.18);
		background: rgba(9, 14, 20, 0.88);
	}

	.diagnostic-card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.diagnostic-card-head span {
		color: #8ae0dc;
		font-size: 0.76rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.diagnostic-code {
		margin: 0.45rem 0 0.25rem;
		font-family: 'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace;
		font-size: 0.92rem;
	}

	.diagnostic-message {
		margin: 0 0 0.5rem;
		color: #d7e2e4;
	}

	.diagnostic-card.warning {
		border-color: rgba(175, 128, 54, 0.34);
		background: rgba(43, 32, 13, 0.9);
	}

	.diagnostic-card.error {
		border-color: rgba(227, 114, 91, 0.34);
		background: rgba(52, 21, 17, 0.9);
	}

	pre {
		overflow: auto;
		white-space: pre-wrap;
		color: #d7e2e4;
	}

	.diagnostic-empty {
		margin: 0.25rem 0 0;
		color: #8ea3aa;
	}
</style>
