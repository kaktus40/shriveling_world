import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
	assembleBaseNetwork,
	inspectDatasetFiles,
	prepareDataset,
	resolveDatasetManifest,
	type SourceFile,
} from '$lib/domain/data';
import {
	listWorkspaceCities,
	runDatasetWorkspaceCompute,
	listWorkspaceFields,
	listWorkspaceModes,
	summarizeDatasetWorkspace,
	type DatasetWorkspaceSnapshot,
} from '$lib/application/workspace';
import type { ComputeProfile } from '$lib/compute';

function csv(name: string, text: string): SourceFile {
	return { name, text: text.trim() };
}

function buildWorkspace(): DatasetWorkspaceSnapshot {
	const files = [
		csv(
			'cities.csv',
			`
cityCode,latitude,longitude,radius,cityName
1,0,0,1000,A
2,10,20,1000,B
`
		),
		csv(
			'population.csv',
			`
cityCode,pop1950,pop1960
1,1000,1200
2,2000,2400
`
		),
		csv(
			'transport_modes.csv',
			`
code,name,terrestrial
1,Road,1
2,Rail,1
3,Air,0
`
		),
		csv(
			'transport_mode_speeds.csv',
			`
transportModeCode,year,speedKPH
1,2000,100
1,2010,100
2,2005,200
2,2010,300
3,2005,500
3,2010,700
`
		),
		csv(
			'transport_network.csv',
			`
cityCodeOri,cityCodeDes,transportModeCode,eYearBegin,eYearEnd
1,2,2,2005,2010
1,2,3,2007,2010
`
		),
		{
			name: 'boundaries.geojson',
			text: JSON.stringify({
				type: 'FeatureCollection',
				features: [],
			}),
		},
	];

	const inspectedFiles = inspectDatasetFiles(files);
	const manifest = resolveDatasetManifest(inspectedFiles);
	const baseNetwork = assembleBaseNetwork({ files, manifest });
	const preparedDataset = prepareDataset(baseNetwork);

	return {
		datasetName: 'fixture',
		files,
		pipeline: {
			inspectedFiles,
			manifest,
			baseNetwork,
			preparedDataset,
		},
		geojsonEntries: [
			{
				fileName: 'boundaries.geojson',
				geojson: { type: 'FeatureCollection', features: [] },
			},
		],
	};
}

test('workspace summaries expose dataset-level counts and diagnostics', () => {
	const workspace = buildWorkspace();
	const summary = summarizeDatasetWorkspace(workspace);

	assert.equal(summary.datasetName, 'fixture');
	assert.equal(summary.sourceFileCount, 6);
	assert.equal(summary.geojsonFileCount, 1);
	assert.equal(summary.cityCount, 2);
	assert.equal(summary.edgeCount, 2);
	assert.equal(summary.modeCount, 3);
	assert.equal(summary.queryableFieldCount > 0, true);
	assert.equal(summary.errorCount, 0);
});

test('workspace mode, city, and field previews stay aligned with prepared order', () => {
	const workspace = buildWorkspace();

	const modes = listWorkspaceModes(workspace);
	assert.deepEqual(
		modes.map((mode) => ({ modeIndex: mode.modeIndex, code: mode.modeCode, name: mode.name, terrestrial: mode.terrestrial })),
		[
			{ modeIndex: 0, code: 1, name: 'Road', terrestrial: true },
			{ modeIndex: 1, code: 2, name: 'Rail', terrestrial: true },
			{ modeIndex: 2, code: 3, name: 'Air', terrestrial: false },
		],
	);

	const cities = listWorkspaceCities(workspace, 2);
	assert.deepEqual(
		cities.map((city) => ({
			cityIndex: city.cityIndex,
			cityCode: city.cityCode,
			linkedRecordCount: city.linkedRecordCount,
			inEdgeCount: city.inEdgeCount,
			outEdgeCount: city.outEdgeCount,
		})),
		[
			{ cityIndex: 0, cityCode: 1, linkedRecordCount: 1, inEdgeCount: 0, outEdgeCount: 2 },
			{ cityIndex: 1, cityCode: 2, linkedRecordCount: 1, inEdgeCount: 2, outEdgeCount: 0 },
		],
	);

	const fields = listWorkspaceFields(workspace, 32);
	assert.equal(
		fields.some(
			(field) =>
				field.sourceKind === 'cityLinkedAttributes' &&
				field.column !== 'cityCode' &&
				field.characteristic === false,
		),
		true,
	);
	assert.equal(fields.some((field) => field.column === 'cityCode' && field.characteristic), true);
});

test('workspace compute runs on the cpu reference backend and reports benchmark stages', async () => {
	const workspace = buildWorkspace();
	const result = await runDatasetWorkspaceCompute(workspace, {
		profile: 'webgl2' as ComputeProfile,
		forced: 'webgl2' as ComputeProfile,
		allowFallback: true,
		benchmark: true,
	});

	assert.equal(result.selection.selected, 'cpu');
	assert.equal(result.selection.fallbackUsed, true);
	assert.equal(result.benchmark.profile, 'cpu');
	assert.equal(result.benchmark.timings.length > 0, true);
	assert.equal(result.result.preparedDataset.cityCount, 2);
	assert.equal(result.result.geojsonRuns.length, 1);
});
