#!/usr/bin/env -S tsx
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyDatasetFile, ensureCleanDir, writeCsv, writeJson } from './dataset-utils.mjs';
import { readManifestCsv, requireValidDatasetManifest } from './dataset-files';

interface FixtureInput {
	name: string;
	source: string;
	limit: number;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const fixtures: FixtureInput[] = [
	{
		name: 'fixture-30-world',
		source: path.join(rootDir, 'datasets', 'World_1M'),
		limit: 30,
	},
	{
		name: 'fixture-30-europe',
		source: path.join(rootDir, 'datasets', 'Europe_1M'),
		limit: 30,
	},
];

/** Creates one deterministic reduced fixture while preserving original file names. */
function createFixture({ name, source, limit }: FixtureInput) {
	const { manifest: datasetManifest } = requireValidDatasetManifest(source);
	const files = {
		cities: datasetManifest.primary.cities.originalName,
		transportNetwork: datasetManifest.primary.transportNetwork.originalName,
		transportModes: datasetManifest.primary.transportModes.originalName,
		transportModeSpeeds: datasetManifest.primary.transportModeSpeeds.originalName,
		cityLinkedAttributes: datasetManifest.cityLinkedAttributes.map((file) => file.originalName),
		geojson: datasetManifest.geojson.map((file) => file.originalName),
	};
	const target = path.join(rootDir, 'tests', 'fixtures', name);
	ensureCleanDir(target);

	const cities = readManifestCsv(source, datasetManifest.primary.cities);
	const selectedCities = cities.records.slice(0, limit);
	const selectedCityCodes = new Set(selectedCities.map((record) => record.cityCode));

	const network = readManifestCsv(source, datasetManifest.primary.transportNetwork);
	const selectedNetwork = network.records.filter(
		(record) => selectedCityCodes.has(record.cityCodeOri) && selectedCityCodes.has(record.cityCodeDes)
	);

	writeCsv(path.join(target, files.cities), cities.headers, selectedCities);
	writeCsv(path.join(target, files.transportNetwork), network.headers, selectedNetwork);
	copyDatasetFile(source, target, files.transportModes);
	copyDatasetFile(source, target, files.transportModeSpeeds);
	files.geojson.forEach((fileName) => copyDatasetFile(source, target, fileName));

	const selectedCityLinkedAttributes = files.cityLinkedAttributes.map((fileName) => {
		const inspectedFile = datasetManifest.cityLinkedAttributes.find((file) => file.originalName === fileName);
		if (!inspectedFile) {
			throw new Error(`Missing inspected city-linked file: ${fileName}`);
		}
		const cityLinkedAttributes = readManifestCsv(source, inspectedFile);
		const selectedRecords = cityLinkedAttributes.records.filter((record) => selectedCityCodes.has(record.cityCode));
		writeCsv(path.join(target, fileName), cityLinkedAttributes.headers, selectedRecords);
		return {
			file: fileName,
			selectedRecordCount: selectedRecords.length,
		};
	});

	const fixtureManifest = {
		name,
		source: path.relative(rootDir, source),
		limit,
		files,
		selectedCityCount: selectedCities.length,
		selectedCityLinkedAttributes,
		selectedNetworkEdgeCount: selectedNetwork.length,
		selectedCityCodes: [...selectedCityCodes],
	};
	writeJson(path.join(target, 'fixture-manifest.json'), fixtureManifest);
	return fixtureManifest;
}

const manifests = fixtures.map(createFixture);
writeJson(path.join(rootDir, 'tests', 'fixtures', 'fixtures-manifest.json'), {
	fixtures: manifests,
});

console.log(`Generated ${manifests.length} reduced dataset fixtures.`);
manifests.forEach((manifest) => {
	console.log(`${manifest.name}: ${manifest.selectedCityCount} cities, ${manifest.selectedNetworkEdgeCount} edges`);
});
