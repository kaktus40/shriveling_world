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
	benchmarkWorkspaceAnnualConeIntersectionCache,
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
1,2005,100
1,2010,100
2,2000,200
2,2005,200
2,2010,300
3,2000,500
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

test('workspace annual cache benchmark exposes representative yearly slices', () => {
	const workspace = buildWorkspace();
	const report = benchmarkWorkspaceAnnualConeIntersectionCache(workspace.pipeline.preparedDataset, {
		warmupIterations: 0,
		measurementIterations: 1,
	});

	assert.equal(report.years.length, 3);
	assert.equal(report.cases.length, report.years.length);
	assert.equal(report.summary.yearCount, report.years.length);
	assert.equal(report.summary.bestYear !== null, true);
	assert.equal(report.summary.totalByteLength > 0, true);
	for (const annualCase of report.cases) {
		assert.equal(annualCase.rayCount > 0, true);
		assert.equal(annualCase.byteLength > 0, true);
		assert.equal(annualCase.miss.minMilliseconds >= 0, true);
		assert.equal(annualCase.hit.minMilliseconds >= 0, true);
	}
});
