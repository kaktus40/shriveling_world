import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
	assembleBaseNetwork,
	inspectDatasetFiles,
	prepareDataset,
	resolveDatasetManifest,
	type SourceFile,
} from '$lib/domain/data';
import { buildAppQueryState, collectAppQueryMatchedCityIndexes } from '$lib/application/app/query';
import type { WorkspaceDatasetSnapshot } from '$lib/application/workspace';
import type { QueryExecutionResult } from '$lib/application/query';

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
`
		),
		csv(
			'transport_mode_speeds.csv',
			`
transportModeCode,year,speedKPH
1,2000,100
`
		),
		csv(
			'transport_network.csv',
			`
cityCodeOri,cityCodeDes,transportModeCode,eYearBegin,eYearEnd
1,2,1,2000,2010
`
		),
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
		geojsonEntries: [],
	};
}

test('app query state exposes a serialized snapshot and a default tree', () => {
	const queryState = buildAppQueryState(buildWorkspace());

	assert.equal(queryState.querySnapshot.fields.length > 0, true);
	assert.equal(queryState.queryTree.nodeType, 'group');
	assert.equal(queryState.queryTree.filters.length > 0, true);
});

test('app query helper extracts matched city indexes', () => {
	const queryResult = {
		matchedCityIndexes: new Uint32Array([1]),
		matchedCityIds: new Uint32Array([17]),
		diagnostics: [],
	} as QueryExecutionResult;

	assert.deepEqual(collectAppQueryMatchedCityIndexes(queryResult), [1]);
	assert.deepEqual(collectAppQueryMatchedCityIndexes(null), []);
});
