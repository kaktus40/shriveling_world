import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'vitest';
import {
	assembleBaseNetwork,
	inspectDatasetFiles,
	prepareDataset,
	resolveDatasetManifest,
	type BaseNetwork,
	type PreparedDataset,
	type SourceFile,
} from '../../src/lib/domain/data';

const FIXTURE_ROOT = path.resolve('tests/fixtures');

test('complete data pipeline is order-independent and preserves lossless user data', () => {
	const files = createAnalyticalFiles();
	const forward = runPipeline(files);
	const reverse = runPipeline([...files].reverse());

	assert.deepEqual(reverse.manifest, forward.manifest);
	assert.deepEqual(reverse.network, forward.network);
	assertPreparedDatasetsEqual(reverse.prepared, forward.prepared);

	const city = forward.network.cities[0];
	const cityRecord = forward.network.sourceRecords[city.sourceRecordId];
	assert.equal(cityRecord.raw.userSurfaceKm2, '12.5');
	assert.equal(cityRecord.extra.userSurfaceKm2, '12.5');
	assert.deepEqual(city.linkedRecords['demography-user-table.csv'].length, 1);
	assert.ok(forward.network.fields.some((field) => field.column === 'population_1950' && !field.characteristic));
	assertDiagnosticCodes(forward.network, [
		'city-linked-record-missing-city',
		'edge-missing-destination-city',
		'unknown-file',
	]);
	assert.ok(forward.prepared.diagnostics.some((diagnostic) => diagnostic.code === 'prepared-edge-excluded-unresolved'));
	assert.equal(forward.prepared.cityCount, 2);
	assert.equal(forward.prepared.edgeCount, 1);
	assert.ok(Math.abs(forward.prepared.cityLonLatRadians[0] - Math.PI / 18) < 1e-6);
});

test('manifest rejects missing and duplicate primary tables before assembly', () => {
	const files = createAnalyticalFiles();
	const withoutCities = files.filter((file) => file.name !== 'places-user-export.csv');
	const missingManifest = resolveDatasetManifest(inspectDatasetFiles(withoutCities));
	assert.equal(missingManifest.valid, false);
	assert.ok(missingManifest.diagnostics.some((diagnostic) => diagnostic.code === 'missing-primary-file'));
	assert.throws(() => assembleBaseNetwork({ files: withoutCities, manifest: missingManifest }), /Invalid dataset manifest/);

	const duplicateCities = [...files, { ...files.find((file) => file.name === 'places-user-export.csv')!, name: 'copy.csv' }];
	const duplicateManifest = resolveDatasetManifest(inspectDatasetFiles(duplicateCities));
	assert.equal(duplicateManifest.valid, false);
	assert.ok(duplicateManifest.diagnostics.some((diagnostic) => diagnostic.code === 'multiple-primary-files'));

	const ambiguousFiles = [
		...files,
		sourceFile(
			'ambiguous.csv',
			`
cityCode,latitude,longitude,radius,transportModeCode,year,speedKPH
10,0,10,NA,1,2000,100
`,
		),
	];
	const ambiguousManifest = resolveDatasetManifest(inspectDatasetFiles(ambiguousFiles));
	assert.equal(ambiguousManifest.valid, false);
	assert.ok(ambiguousManifest.diagnostics.some((diagnostic) => diagnostic.code === 'ambiguous-file-schema'));

	const duplicateNames = [...files, { ...files[0] }];
	const duplicateNameManifest = resolveDatasetManifest(inspectDatasetFiles(duplicateNames));
	assert.equal(duplicateNameManifest.valid, false);
	assert.ok(duplicateNameManifest.diagnostics.some((diagnostic) => diagnostic.code === 'duplicate-source-file-name'));
});

test('lossless assembly reports duplicate entities and unresolved business references', () => {
	const files = createAnalyticalFiles().map((file) => {
		if (file.name === 'places-user-export.csv') {
			return sourceFile(
				file.name,
				`
cityCode,latitude,longitude,radius,cityLabel
10,0,10,NA,A
10,invalid,20,1000,duplicate A
`,
			);
		}
		if (file.name === 'modes-custom.csv') {
			return sourceFile(
				file.name,
				`
code,name,terrestrial
1,Road,1
1,Rail duplicate,1
`,
			);
		}
		if (file.name === 'speeds-custom.csv') {
			return sourceFile(
				file.name,
				`
transportModeCode,year,speedKPH
1,2000,100
99,2000,300
`,
			);
		}
		return file;
	});
	const inspected = inspectDatasetFiles(files);
	const manifest = resolveDatasetManifest(inspected);
	assert.equal(manifest.valid, true);
	const network = assembleBaseNetwork({ files, manifest });

	assertDiagnosticCodes(network, [
		'duplicate-city-code',
		'duplicate-transport-mode-code',
		'edge-missing-destination-city',
		'edge-missing-transport-mode',
		'invalid-number-characteristic',
		'speed-missing-transport-mode',
	]);
	assert.ok(network.sourceRecords.some((record) => record.raw.latitude === 'invalid'));
});

for (const fixtureName of ['fixture-30-europe', 'fixture-30-world']) {
	test(`${fixtureName} produces the same manifest, lossless network, and prepared buffers in reverse file order`, () => {
		const fixtureDirectory = path.join(FIXTURE_ROOT, fixtureName);
		const expected = JSON.parse(readFileSync(path.join(fixtureDirectory, 'fixture-manifest.json'), 'utf8')) as {
			selectedCityCount: number;
			selectedNetworkEdgeCount: number;
			selectedCityLinkedAttributes: Array<{ selectedRecordCount: number }>;
		};
		const files = readFixtureFiles(fixtureDirectory);
		const forward = runPipeline(files);
		const reverse = runPipeline([...files].reverse());

		assert.equal(forward.manifest.valid, true);
		assert.deepEqual(reverse.manifest, forward.manifest);
		assert.deepEqual(reverse.network, forward.network);
		assertPreparedDatasetsEqual(reverse.prepared, forward.prepared);
		assert.equal(forward.network.cities.length, expected.selectedCityCount);
		assert.equal(forward.network.edges.length, expected.selectedNetworkEdgeCount);
		assert.equal(
			forward.network.sourceRecords.filter((record) => record.sourceKind === 'cityLinkedAttributes').length,
			expected.selectedCityLinkedAttributes[0].selectedRecordCount,
		);
		assert.equal(forward.prepared.cityCount, expected.selectedCityCount);
	});
}

function runPipeline(files: SourceFile[]) {
	const inspected = inspectDatasetFiles(files);
	const manifest = resolveDatasetManifest(inspected);
	assert.equal(manifest.valid, true);
	const network = assembleBaseNetwork({ files, manifest });
	return { manifest, network, prepared: prepareDataset(network) };
}

function assertPreparedDatasetsEqual(actual: PreparedDataset, expected: PreparedDataset): void {
	assert.deepEqual(actual, expected);
}

function assertDiagnosticCodes(network: BaseNetwork, expectedCodes: string[]): void {
	const actualCodes = new Set(network.diagnostics.map((diagnostic) => diagnostic.code));
	for (const code of expectedCodes) {
		assert.ok(actualCodes.has(code), `missing diagnostic ${code}`);
	}
}

function readFixtureFiles(directory: string): SourceFile[] {
	return readdirSync(directory, { withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name !== 'fixture-manifest.json')
		.map((entry) => ({
			name: entry.name,
			text: readFileSync(path.join(directory, entry.name), 'utf8').replace(/^\uFEFF/, ''),
		}));
}

function sourceFile(name: string, text: string): SourceFile {
	return { name, text: text.trim() };
}

function createAnalyticalFiles(): SourceFile[] {
	return [
		sourceFile(
			'links-custom.csv',
			`
cityCodeOri,cityCodeDes,transportModeCode,eYearBegin,eYearEnd,userComment
10,20,2,2000,2010,known edge
10,99,2,2000,2010,orphan edge
`,
		),
		sourceFile(
			'demography-user-table.csv',
			`
cityCode,population_1950,userSurfaceKm2
10,100000,12.5
99,50000,8
`,
		),
		sourceFile(
			'modes-custom.csv',
			`
code,name,terrestrial,userColor
1,Road,1,brown
2,Rail,1,red
`,
		),
		sourceFile(
			'places-user-export.csv',
			`
cityCode,latitude,longitude,radius,cityLabel,userSurfaceKm2
10,0,10,NA,A,12.5
20,5,20,1000,B,20
`,
		),
		sourceFile(
			'speeds-custom.csv',
			`
transportModeCode,year,speedKPH,userSource
1,2000,100,road reference
1,2010,100,road reference
2,2000,200,rail source
2,2010,300,rail source
`,
		),
		sourceFile('notes.txt', 'user-owned unsupported content'),
	];
}
