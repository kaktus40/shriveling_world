#!/usr/bin/env node
import path from 'path';
import { fileURLToPath } from 'url';
import {
	copyDatasetFile,
	ensureCleanDir,
	findDatasetFiles,
	readCsv,
	writeCsv,
	writeJson,
} from './dataset-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const fixtures = [
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

function createFixture({ name, source, limit }) {
	const files = findDatasetFiles(source);
	const target = path.join(rootDir, 'tests', 'fixtures', name);
	ensureCleanDir(target);

	const cities = readCsv(path.join(source, files.cities));
	const selectedCities = cities.records.slice(0, limit);
	const selectedCityCodes = new Set(selectedCities.map((record) => record.cityCode));

	const population = readCsv(path.join(source, files.population));
	const selectedPopulation = population.records.filter((record) => selectedCityCodes.has(record.cityCode));

	const network = readCsv(path.join(source, files.transportNetwork));
	const selectedNetwork = network.records.filter(
		(record) => selectedCityCodes.has(record.cityCodeOri) && selectedCityCodes.has(record.cityCodeDes)
	);

	writeCsv(path.join(target, files.cities), cities.headers, selectedCities);
	writeCsv(path.join(target, files.population), population.headers, selectedPopulation);
	writeCsv(path.join(target, files.transportNetwork), network.headers, selectedNetwork);
	copyDatasetFile(source, target, files.transportModes);
	copyDatasetFile(source, target, files.transportModeSpeed);
	copyDatasetFile(source, target, files.geojson);

	const manifest = {
		name,
		source: path.relative(rootDir, source),
		limit,
		files,
		selectedCityCount: selectedCities.length,
		selectedPopulationCount: selectedPopulation.length,
		selectedNetworkEdgeCount: selectedNetwork.length,
		selectedCityCodes: [...selectedCityCodes],
	};
	writeJson(path.join(target, 'fixture-manifest.json'), manifest);
	return manifest;
}

const manifests = fixtures.map(createFixture);
writeJson(path.join(rootDir, 'tests', 'fixtures', 'fixtures-manifest.json'), {
	fixtures: manifests,
});

console.log(`Generated ${manifests.length} reduced dataset fixtures.`);
manifests.forEach((manifest) => {
	console.log(`${manifest.name}: ${manifest.selectedCityCount} cities, ${manifest.selectedNetworkEdgeCount} edges`);
});
