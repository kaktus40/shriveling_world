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
	computeWorkspacePrecompute,
	type WorkspaceDatasetSnapshot,
} from '$lib/application/workspace';

function csv(name: string, text: string): SourceFile {
	return { name, text: text.trim() };
}

function buildWorkspace(): WorkspaceDatasetSnapshot {
	const files = [
		csv(
			'cities.csv',
			`
cityCode,latitude,longitude,radius,cityName
1,0,0,1000,A
2,10,20,1000,B
`,
		),
		csv(
			'population.csv',
			`
cityCode,pop1950,pop1960
1,1000,1200
2,2000,2400
`,
		),
		csv(
			'transport_modes.csv',
			`
code,name,terrestrial
1,Road,1
2,Rail,1
3,Air,0
`,
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
`,
		),
		csv(
			'transport_network.csv',
			`
cityCodeOri,cityCodeDes,transportModeCode,eYearBegin,eYearEnd
1,2,2,2005,2010
1,2,3,2007,2010
`,
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

test('prepared workspace precompute reuses the prepared dataset and isolates the yearly tranche', () => {
	const workspace = buildWorkspace();
	const first = computeWorkspacePrecompute(workspace, { year: 2000, boundaryAzimuthSampleCount: 8 });
	const second = computeWorkspacePrecompute(workspace, { year: 2010, boundaryAzimuthSampleCount: 8 });

	assert.equal(first.preparedDataset, workspace.pipeline.preparedDataset);
	assert.equal(second.preparedDataset, workspace.pipeline.preparedDataset);
	assert.equal(first.preparedDataset, second.preparedDataset);
	assert.equal(first.boundaryRuns.length, 1);
	assert.equal(second.boundaryRuns.length, 1);
	assert.equal(first.conePipeline.staticTown.cityCount, second.conePipeline.staticTown.cityCount);
	assert.equal(first.conePipeline.dynamicTown.year, 2000);
	assert.equal(second.conePipeline.dynamicTown.year, 2010);
});
