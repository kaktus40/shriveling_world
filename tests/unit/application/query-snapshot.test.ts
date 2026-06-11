import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
	assembleBaseNetwork,
	inspectDatasetFiles,
	prepareDataset,
	resolveDatasetManifest,
	type SourceFile,
} from '$lib/domain/data';
import { buildQueryDatasetSnapshot, executeQueryWorkerRequest, type QueryWorkerRequest } from '$lib/application/query';
import type { DatasetWorkspaceSnapshot } from '$lib/application/workspace';

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
`
		),
		csv(
			'transport_network.csv',
			`
cityCodeOri,cityCodeDes,transportModeCode,eYearBegin,eYearEnd
1,2,2,2005,2010
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

test('query snapshot preserves city-level and linked attribute fields', () => {
	const snapshot = buildQueryDatasetSnapshot(buildWorkspace());

	assert.equal(snapshot.fields.some((field) => field.column === 'cityName' && field.sourceKind === 'cities'), true);
	assert.equal(
		snapshot.fields.some((field) => field.column === 'pop1950' && field.sourceKind === 'cityLinkedAttributes'),
		true,
	);

	const firstCity = snapshot.cities[0];
	const cityNameKey = snapshot.fields.find((field) => field.column === 'cityName')?.fieldKey;
	const populationKey = snapshot.fields.find((field) => field.column === 'pop1950')?.fieldKey;
	assert.ok(cityNameKey);
	assert.ok(populationKey);
	assert.deepEqual(firstCity.valuesByFieldKey[cityNameKey], ['A']);
	assert.deepEqual(firstCity.valuesByFieldKey[populationKey], [1000]);
});

test('query worker request returns matched city ids from the serialized snapshot', () => {
	const snapshot = buildQueryDatasetSnapshot(buildWorkspace());
	const populationKey = snapshot.fields.find((field) => field.column === 'pop1950')?.fieldKey;
	assert.ok(populationKey);

	const request: QueryWorkerRequest = {
		dataset: snapshot,
		query: {
			nodeType: 'filter',
			fieldKey: populationKey,
			comparator: '>=',
			value: 1500,
		},
	};

	const result = executeQueryWorkerRequest(request);
	assert.deepEqual(Array.from(result.matchedCityIndexes), [1]);
	assert.deepEqual(Array.from(result.matchedCityIds), [1]);
	assert.deepEqual(result.diagnostics, []);
});
