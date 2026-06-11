<script lang="ts">
	import { onMount } from 'svelte';
	import QueryNodeEditor from '$lib/components/query/QueryNodeEditor.svelte';
	import {
		buildQueryDatasetSnapshot,
		createDefaultQueryTree,
		createQueryWorkerClient,
		insertQueryNodeAtPath,
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
		type DatasetWorkspaceSnapshot,
		type DatasetWorkspaceSummary,
		type WorkspaceCitySummary,
		type WorkspaceModeSummary,
	} from '$lib/application/workspace';
	import type { QueryableField } from '$lib/domain/data';
	import type { QueryNode } from '$lib/domain/query';

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
	let loading = false;
	let queryLoading = false;
	let errorMessage = '';
	let queryError = '';

	onMount(() => {
		queryWorker = createQueryWorkerClient();
		if (selectedDataset) {
			void reloadWorkspace();
		}

		return () => {
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
			await runQuery();
		} catch (error) {
			workspace = null;
			summary = null;
			modes = [];
			cities = [];
			fieldPreview = [];
			querySnapshot = null;
			queryTree = null;
			queryResult = null;
			queryError = '';
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			loading = false;
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

	function resetQuery(): void {
		if (!querySnapshot) {
			return;
		}

		queryTree = createDefaultQueryTree(querySnapshot.fields);
		queryResult = null;
		queryError = '';
	}

	function updateQueryNode(path: number[], nextNode: QueryNode): void {
		if (!queryTree) {
			return;
		}

		queryTree = updateQueryNodeAtPath(queryTree, path, () => nextNode);
		queryResult = null;
		queryError = '';
	}

	function deleteQueryNode(path: number[]): void {
		if (!queryTree) {
			return;
		}

		queryTree = removeQueryNodeAtPath(queryTree, path);
		queryResult = null;
		queryError = '';
	}

	function insertQueryNode(path: number[], child: QueryNode): void {
		if (!queryTree) {
			return;
		}

		queryTree = insertQueryNodeAtPath(queryTree, path, child);
		queryResult = null;
		queryError = '';
	}

	function degrees(valueRadians: number): string {
		return ((valueRadians * 180) / Math.PI).toFixed(3);
	}

	function yearLabel(value: number | null): string {
		return value === null ? 'unbounded' : String(value);
	}

	function queryMatchRows(limit = 10): Array<{ cityIndex: number; cityId: number; cityCode: number }> {
		const currentWorkspace = workspace;
		if (!currentWorkspace || !queryResult) {
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
			<h2>Historical span</h2>
			<p><strong>Begin:</strong> {summary.yearBegin}</p>
			<p><strong>End:</strong> {summary.yearEnd}</p>
			<p><strong>Errors:</strong> {summary.errorCount}</p>
			<p><strong>Warnings:</strong> {summary.warningCount}</p>
		</article>
	</section>

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

		<article class="panel">
			<h2>Diagnostics</h2>
			<pre>{JSON.stringify(workspace.pipeline.preparedDataset.diagnostics, null, 2)}</pre>
		</article>
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
								</tr>
							</thead>
							<tbody>
								{#each queryMatchRows() as match}
									<tr>
										<td>{match.cityIndex}</td>
										<td>{match.cityId}</td>
										<td>{match.cityCode}</td>
									</tr>
								{/each}
							</tbody>
						</table>
						<pre>{JSON.stringify(currentQueryResult.diagnostics, null, 2)}</pre>
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
		background: rgba(255, 255, 255, 0.84);
		border: 1px solid rgba(28, 36, 40, 0.14);
		border-radius: 1rem;
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
		color: #0d6f73;
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
		border: 1px solid rgba(28, 36, 40, 0.2);
		border-radius: 0.8rem;
		background: white;
	}

	button {
		cursor: pointer;
		font-weight: 700;
	}

	.nav-link {
		align-self: end;
		color: #0d6f73;
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
		border-bottom: 1px solid rgba(28, 36, 40, 0.1);
		text-align: left;
		font-size: 0.95rem;
	}

	th {
		font-size: 0.82rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #51636d;
	}

	.error {
		border-color: #b05f4b;
		background: rgba(255, 243, 239, 0.84);
	}

	.inline-error {
		margin-bottom: 1rem;
	}

	pre {
		overflow: auto;
		white-space: pre-wrap;
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

	@media (max-width: 960px) {
		.query-layout {
			grid-template-columns: 1fr;
		}
	}
</style>
