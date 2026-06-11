<script lang="ts">
	import { onMount } from 'svelte';
	import QueryNodeEditor from '$lib/components/query/QueryNodeEditor.svelte';
	import {
		buildQueryDatasetSnapshot,
		createDefaultQueryTree,
		createQueryWorkerClient,
		insertQueryNodeAtPath,
		moveQueryNodeAtPath,
		removeQueryNodeAtPath,
		updateQueryNodeAtPath,
		type QueryDatasetSnapshot,
		type QueryExecutionResult,
		type QueryWorkerClient,
	} from '$lib/application/query';
	import {
		listWorkspaceCities,
		listWorkspaceFields,
		listWorkspaceModes,
		loadDatasetWorkspace,
		summarizeDatasetWorkspace,
		runDatasetWorkspaceCompute,
		type DatasetWorkspaceSnapshot,
		type DatasetWorkspaceSummary,
		type DatasetWorkspaceCompute,
		type WorkspaceCitySummary,
		type WorkspaceModeSummary,
	} from '$lib/application/workspace';
	import type { DatasetDiagnostic, QueryableField } from '$lib/domain/data';
	import type { QueryNode } from '$lib/domain/query';
	import type { ComputeProfile } from '$lib/compute';

	export let data: {
		datasets: string[];
	};

	let selectedDataset = data.datasets[0] ?? '';
	let workspace: DatasetWorkspaceSnapshot | null = null;
	let summary: DatasetWorkspaceSummary | null = null;
	let modes: WorkspaceModeSummary[] = [];
	let cities: WorkspaceCitySummary[] = [];
	let fieldPreview: QueryableField[] = [];
	let querySnapshot: QueryDatasetSnapshot | null = null;
	let queryTree: QueryNode | null = null;
	let queryResult: QueryExecutionResult | null = null;
	let queryWorker: QueryWorkerClient | null = null;
	let workspaceCompute: DatasetWorkspaceCompute | null = null;
	let selectedComputeProfile: ComputeProfile = 'cpu';
	let selectedComputeDiagnosticProfile: ComputeProfile | 'all' = 'all';
	let loading = false;
	let computeLoading = false;
	let queryLoading = false;
	let errorMessage = '';
	let computeError = '';
	let queryError = '';
	let queryRunTimer: ReturnType<typeof setTimeout> | null = null;
	let computeDiagnostics: DatasetDiagnostic[] = [];
	let filteredComputeDiagnostics: DatasetDiagnostic[] = [];
	let computeDiagnosticCounts = {
		all: 0,
		cpu: 0,
		webgl2: 0,
		webgpu: 0,
	};

	onMount(() => {
		queryWorker = createQueryWorkerClient();
		if (selectedDataset) {
			void reloadWorkspace();
		}

		return () => {
			if (queryRunTimer) {
				clearTimeout(queryRunTimer);
				queryRunTimer = null;
			}
			queryWorker?.terminate();
			queryWorker = null;
		};
	});

	async function reloadWorkspace(): Promise<void> {
		if (!selectedDataset) {
			return;
		}

		loading = true;
		errorMessage = '';
		try {
			const loadedWorkspace = await loadDatasetWorkspace(fetch, selectedDataset);
			workspace = loadedWorkspace;
			summary = summarizeDatasetWorkspace(loadedWorkspace);
			modes = listWorkspaceModes(loadedWorkspace);
			cities = listWorkspaceCities(loadedWorkspace, 18);
			fieldPreview = listWorkspaceFields(loadedWorkspace, 20);
			querySnapshot = buildQueryDatasetSnapshot(loadedWorkspace);
			queryTree = createDefaultQueryTree(querySnapshot.fields);
			queryResult = null;
			queryError = '';
			computeError = '';
			await reloadCompute();
			scheduleQueryRun();
		} catch (error) {
			workspace = null;
			summary = null;
			modes = [];
			cities = [];
			fieldPreview = [];
			querySnapshot = null;
			queryTree = null;
			queryResult = null;
			workspaceCompute = null;
			computeError = '';
			queryError = '';
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			loading = false;
		}
	}

	$: computeDiagnostics = workspaceCompute?.result.diagnostics ?? [];
	$: computeDiagnosticCounts = summarizeComputeDiagnostics(computeDiagnostics);
	$: filteredComputeDiagnostics =
		selectedComputeDiagnosticProfile === 'all'
			? computeDiagnostics
			: computeDiagnostics.filter(
					(diagnostic) => classifyComputeDiagnostic(diagnostic) === selectedComputeDiagnosticProfile,
				);

	async function reloadCompute(): Promise<void> {
		const currentWorkspace = workspace;
		if (!currentWorkspace) {
			return;
		}

		computeLoading = true;
		computeError = '';
		try {
			workspaceCompute = await runDatasetWorkspaceCompute(currentWorkspace, {
				profile: selectedComputeProfile,
				forced: selectedComputeProfile,
				allowFallback: true,
				benchmark: true,
			});
		} catch (error) {
			workspaceCompute = null;
			computeError = error instanceof Error ? error.message : String(error);
		} finally {
			computeLoading = false;
		}
	}

	async function runQuery(): Promise<void> {
		if (!workspace || !querySnapshot || !queryTree || !queryWorker) {
			return;
		}

		queryLoading = true;
		queryError = '';
		try {
			queryResult = await queryWorker.execute({
				dataset: querySnapshot,
				query: queryTree,
			});
		} catch (error) {
			queryResult = null;
			queryError = error instanceof Error ? error.message : String(error);
		} finally {
			queryLoading = false;
		}
	}

	function scheduleQueryRun(): void {
		if (!workspace || !querySnapshot || !queryTree || !queryWorker) {
			return;
		}

		if (queryRunTimer) {
			clearTimeout(queryRunTimer);
		}

		queryRunTimer = setTimeout(() => {
			queryRunTimer = null;
			void runQuery();
		}, 80);
	}

	function resetQuery(): void {
		if (!querySnapshot) {
			return;
		}

		queryTree = createDefaultQueryTree(querySnapshot.fields);
		queryResult = null;
		queryError = '';
		scheduleQueryRun();
	}

	function updateQueryNode(path: number[], nextNode: QueryNode): void {
		if (!queryTree) {
			return;
		}

		queryTree = updateQueryNodeAtPath(queryTree, path, () => nextNode);
		queryResult = null;
		queryError = '';
		scheduleQueryRun();
	}

	function deleteQueryNode(path: number[]): void {
		if (!queryTree) {
			return;
		}

		queryTree = removeQueryNodeAtPath(queryTree, path);
		queryResult = null;
		queryError = '';
		scheduleQueryRun();
	}

	function insertQueryNode(path: number[], child: QueryNode): void {
		if (!queryTree) {
			return;
		}

		queryTree = insertQueryNodeAtPath(queryTree, path, child);
		queryResult = null;
		queryError = '';
		scheduleQueryRun();
	}

	function moveQueryNode(path: number[], direction: -1 | 1): void {
		if (!queryTree) {
			return;
		}

		queryTree = moveQueryNodeAtPath(queryTree, path, direction);
		queryResult = null;
		queryError = '';
		scheduleQueryRun();
	}

	function degrees(valueRadians: number): string {
		return ((valueRadians * 180) / Math.PI).toFixed(3);
	}

	function yearLabel(value: number | null): string {
		return value === null ? 'unbounded' : String(value);
	}

	function queryMatchRows(limit = 10): Array<{ cityIndex: number; cityId: number; cityCode: number }> {
		const currentWorkspace = workspace;
		const currentQuerySnapshot = querySnapshot;
		if (!currentWorkspace || !currentQuerySnapshot || !queryResult) {
			return [];
		}

		return Array.from(queryResult.matchedCityIndexes)
			.slice(0, limit)
			.map((cityIndex) => ({
				cityIndex,
				cityId: currentWorkspace.pipeline.preparedDataset.cityIds[cityIndex],
				cityCode: currentWorkspace.pipeline.preparedDataset.cityCodes[cityIndex],
			}));
	}

	function queryMatchPreview(cityIndex: number, limit = 3): string {
		const currentQuerySnapshot = querySnapshot;
		if (!currentQuerySnapshot) {
			return '';
		}

		const city = currentQuerySnapshot.cities[cityIndex];
		if (!city) {
			return '';
		}

		return currentQuerySnapshot.fields
			.filter((field) => field.characteristic || field.multiValued)
			.slice(0, limit)
			.map((field) => {
				const values = city.valuesByFieldKey[field.fieldKey] ?? [];
				const value = values.find((candidate) => candidate !== null);
				return `${field.label}: ${String(value ?? 'null')}`;
			})
			.join(' | ');
	}

	function computeSummaryLabel(profile: ComputeProfile): string {
		return profile.toUpperCase();
	}

	function computeDiagnosticCount(severity: 'error' | 'warning'): number {
		return computeDiagnostics.filter((diagnostic) => diagnostic.severity === severity).length;
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
</script>

<section class="page-head">
	<p class="eyebrow">Application workspace</p>
	<h1>Dataset workspace</h1>
	<p class="lede">
		First non-test application screen built on the shared workspace orchestration. It exposes the
		loaded dataset as a business object: files, prepared entities, transport modes, city previews,
		free queryable fields, and diagnostics.
	</p>
</section>

<section class="controls panel">
	<label>
		<span>Bundled dataset</span>
		<select bind:value={selectedDataset} on:change={() => void reloadWorkspace()}>
			{#each data.datasets as datasetName}
				<option value={datasetName}>{datasetName}</option>
			{/each}
		</select>
	</label>

	<label>
		<span>Compute profile</span>
		<select bind:value={selectedComputeProfile} on:change={() => void reloadCompute()}>
			<option value="cpu">CPU</option>
			<option value="webgl2">WebGL2</option>
			<option value="webgpu">WebGPU</option>
		</select>
	</label>

	<button on:click={() => void reloadWorkspace()} disabled={loading}>
		{loading ? 'Loading...' : 'Reload workspace'}
	</button>

	<a class="nav-link" href="/test">Open validation routes</a>
</section>

{#if errorMessage}
	<section class="panel error">
		<h2>Workspace error</h2>
		<pre>{errorMessage}</pre>
	</section>
{/if}

{#if computeError}
	<section class="panel error">
		<h2>Compute error</h2>
		<pre>{computeError}</pre>
	</section>
{/if}

{#if summary && workspace}
	<section class="summary-grid">
		<article class="panel">
			<h2>Dataset</h2>
			<p><strong>Name:</strong> {summary.datasetName}</p>
			<p><strong>Source files:</strong> {summary.sourceFileCount}</p>
			<p><strong>GeoJSON files:</strong> {summary.geojsonFileCount}</p>
			<p><strong>Inspected files:</strong> {summary.inspectedFileCount}</p>
		</article>

		<article class="panel">
			<h2>Prepared entities</h2>
			<p><strong>Cities:</strong> {summary.cityCount}</p>
			<p><strong>Edges:</strong> {summary.edgeCount}</p>
			<p><strong>Modes:</strong> {summary.modeCount}</p>
			<p><strong>Queryable fields:</strong> {summary.queryableFieldCount}</p>
		</article>

		<article class="panel">
			<h2>Prepared span</h2>
			<p><strong>Begin:</strong> {summary.yearBegin}</p>
			<p><strong>End:</strong> {summary.yearEnd}</p>
			<p><strong>Errors:</strong> {summary.errorCount}</p>
			<p><strong>Warnings:</strong> {summary.warningCount}</p>
		</article>

		<article class="panel">
			<h2>Compute profile</h2>
			<p><strong>Requested:</strong> {computeSummaryLabel(selectedComputeProfile)}</p>
			<p>
				<strong>Selected:</strong>
				{workspaceCompute ? computeSummaryLabel(workspaceCompute.selection.selected) : 'none'}
			</p>
			<p><strong>Fallback:</strong> {workspaceCompute?.selection.fallbackUsed ? 'yes' : 'no'}</p>
			<p><strong>Benchmark:</strong> {computeLoading ? 'running...' : 'ready'}</p>
			<p><strong>Diagnostics:</strong> {workspaceCompute ? workspaceCompute.result.diagnostics.length : 0}</p>
		</article>
	</section>

	{#if workspaceCompute}
		<section class="panel">
			<h2>Compute benchmark</h2>
			<p>
				Total duration: {workspaceCompute.benchmark.totalDurationMs.toFixed(3)} ms
			</p>
			<table>
				<thead>
					<tr>
						<th>Stage</th>
						<th>Scope</th>
						<th>Duration ms</th>
					</tr>
				</thead>
				<tbody>
					{#each workspaceCompute.benchmark.timings as timing}
						<tr>
							<td>{timing.stage}</td>
							<td>{timing.scope}</td>
							<td>{timing.durationMs.toFixed(3)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if workspaceCompute.selection.reason}
				<p class="compute-note">{workspaceCompute.selection.reason}</p>
			{/if}
		</section>

		<details class="panel diagnostic-panel" open>
			<summary>
				<h2>Compute diagnostics</h2>
				<span>runtime validation and fallback notes</span>
			</summary>
			<div class="diagnostic-toolbar">
				<label>
					<span>Profile</span>
					<select bind:value={selectedComputeDiagnosticProfile}>
						<option value="all">All profiles</option>
						<option value="cpu">CPU</option>
						<option value="webgl2">WebGL2</option>
						<option value="webgpu">WebGPU</option>
					</select>
				</label>
				<p>
					{computeDiagnosticCounts.all} item(s), including
					{computeDiagnosticCount('error')} error(s) and {computeDiagnosticCount('warning')}
					warning(s).
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
		</details>
	{/if}

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

		<details class="panel diagnostic-panel" open>
			<summary>
				<h2>Diagnostics</h2>
				<span>prepared dataset</span>
			</summary>
			<pre>{JSON.stringify(workspace.pipeline.preparedDataset.diagnostics, null, 2)}</pre>
		</details>
	</section>

	{#if querySnapshot && queryTree}
		{@const currentQuerySnapshot = querySnapshot}
		<section class="panel query-panel">
			<div class="query-header">
				<div>
					<p class="eyebrow">Query workspace</p>
					<h2>Human-editable AST tree</h2>
					<p class="lede">
						The tree below is the visual projection of the query AST. It stays aligned with the
						worker contract and can be extended without changing the execution model.
					</p>
				</div>
				<div class="query-actions">
					<button on:click={() => void runQuery()} disabled={queryLoading}>
						{queryLoading ? 'Running...' : 'Run query'}
					</button>
					<button on:click={resetQuery} disabled={queryLoading}>Reset tree</button>
				</div>
			</div>

			{#if queryError}
				<div class="error inline-error">
					<pre>{queryError}</pre>
				</div>
			{/if}

			<div class="query-layout">
				<article class="query-column">
					<h3>Tree editor</h3>
					<QueryNodeEditor
						node={queryTree}
						fields={currentQuerySnapshot.fields}
						onChange={updateQueryNode}
						onDelete={deleteQueryNode}
						onInsert={insertQueryNode}
						onMove={moveQueryNode}
					/>
				</article>

				<article class="query-column">
					<h3>Snapshot fields</h3>
					<p>
						{currentQuerySnapshot.fields.length} queryable fields serialized for the worker, including
						{currentQuerySnapshot.fields.filter((field: (typeof currentQuerySnapshot.fields)[number]) => field.multiValued).length} multi-valued
						enrichments.
					</p>
					<table>
						<thead>
							<tr>
								<th>Label</th>
								<th>Type</th>
								<th>Comparators</th>
							</tr>
						</thead>
						<tbody>
							{#each querySnapshot.fields.slice(0, 14) as field}
								<tr>
									<td>{field.label}</td>
									<td>{field.valueType}</td>
									<td>{field.supportedComparators.join(', ')}</td>
								</tr>
							{/each}
						</tbody>
					</table>

					<h3>Execution result</h3>
					{#if queryResult}
						{@const currentQueryResult = queryResult}
						<p>
							<strong>{currentQueryResult.matchedCityIndexes.length}</strong> cities matched.
						</p>
						<p>
							Diagnostics: {currentQueryResult.diagnostics.length} item(s), including
							{currentQueryResult.diagnostics.filter((diagnostic: (typeof currentQueryResult.diagnostics)[number]) => diagnostic.severity === 'error').length}
							error(s).
						</p>
						<table>
							<thead>
								<tr>
									<th>Idx</th>
									<th>City id</th>
									<th>City code</th>
									<th>Preview</th>
								</tr>
							</thead>
							<tbody>
								{#each queryMatchRows() as match}
									<tr>
										<td>{match.cityIndex}</td>
										<td>{match.cityId}</td>
										<td>{match.cityCode}</td>
										<td>{queryMatchPreview(match.cityIndex)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
						<div class="diagnostic-list">
							{#each currentQueryResult.diagnostics as diagnostic}
								<div class={`diagnostic-card ${diagnostic.severity}`}>
									<strong>{diagnostic.severity}</strong>
									<span>{diagnostic.code}</span>
									<pre>{JSON.stringify(diagnostic, null, 2)}</pre>
								</div>
							{/each}
						</div>
					{:else}
						<p>No query executed yet.</p>
					{/if}
				</article>
			</div>
		</section>
	{/if}
{/if}

<style>
	.page-head,
	.panel {
		background: rgba(12, 19, 26, 0.8);
		border: 1px solid rgba(138, 168, 178, 0.2);
		border-radius: 1rem;
		overflow: auto;
		min-width: 0;
	}

	.page-head,
	.panel,
	.controls {
		padding: 1.1rem 1.2rem;
	}

	.page-head {
		margin-bottom: 1rem;
	}

	.eyebrow {
		margin: 0 0 0.4rem;
		font-size: 0.74rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #8ae0dc;
	}

	.lede {
		max-width: 70ch;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	label {
		display: grid;
		gap: 0.4rem;
		min-width: 16rem;
	}

	select,
	button {
		padding: 0.7rem 0.8rem;
		border: 1px solid rgba(138, 168, 178, 0.22);
		border-radius: 0.8rem;
		background: rgba(9, 14, 20, 0.9);
		color: #d7e2e4;
	}

	button {
		cursor: pointer;
		font-weight: 700;
	}

	.nav-link {
		align-self: end;
		color: #8ae0dc;
		font-weight: 700;
	}

	.summary-grid,
	.content-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
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
	}

	th {
		font-size: 0.82rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.error {
		border-color: rgba(227, 114, 91, 0.34);
		background: rgba(52, 21, 17, 0.84);
	}

	.inline-error {
		margin-bottom: 1rem;
	}

	.diagnostic-list {
		display: grid;
		gap: 0.75rem;
		max-height: 24rem;
		overflow: auto;
		padding-right: 0.25rem;
	}

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
	}

	.diagnostic-panel {
		margin: 0;
	}

	.diagnostic-panel > summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		cursor: pointer;
		list-style: none;
	}

	.diagnostic-panel > summary::-webkit-details-marker {
		display: none;
	}

	.diagnostic-panel > summary span {
		color: #8ea3aa;
		font-size: 0.82rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.diagnostic-panel pre {
		max-height: 20rem;
	}

	.diagnostic-empty {
		margin: 0.25rem 0 0;
		color: #8ea3aa;
	}

	.query-panel {
		display: grid;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.query-header {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 1rem;
	}

	.query-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: start;
		gap: 0.6rem;
	}

	.query-layout {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
		gap: 1rem;
		align-items: start;
	}

	.query-column {
		display: grid;
		gap: 0.85rem;
	}

	.query-column h3 {
		margin: 0;
	}

	pre {
		color: #d7e2e4;
	}

	@media (max-width: 960px) {
		.query-layout {
			grid-template-columns: 1fr;
		}
	}
</style>
