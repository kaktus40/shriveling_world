#!/usr/bin/env node
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import {
	ensureDir,
	findDatasetFiles,
	minMax,
	readCsv,
	toNumber,
	writeJson,
} from './dataset-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const datasets = [
	{
		name: 'fixture-30-world',
		dir: path.join(rootDir, 'tests', 'fixtures', 'fixture-30-world'),
	},
	{
		name: 'fixture-30-europe',
		dir: path.join(rootDir, 'tests', 'fixtures', 'fixture-30-europe'),
	},
	{
		name: 'reference-world-1m',
		dir: path.join(rootDir, 'datasets', 'World_1M'),
	},
	{
		name: 'reference-europe-1m',
		dir: path.join(rootDir, 'datasets', 'Europe_1M'),
	},
];

function nonEmpty(value) {
	return value !== undefined && value !== null && value !== '' && value !== 'NA';
}

function unique(values) {
	return [...new Set(values.filter(nonEmpty))].sort();
}

function yearRangeFromFields(records, fieldNames) {
	const values = [];
	records.forEach((record) => {
		fieldNames.forEach((fieldName) => {
			const number = toNumber(record[fieldName]);
			if (number !== null) {
				values.push(number);
			}
		});
	});
	return minMax(values);
}

function characterizeDataset({ name, dir }) {
	if (!existsSync(dir)) {
		throw new Error(`${name}: dataset directory not found: ${dir}`);
	}

	const files = findDatasetFiles(dir);
	const cities = readCsv(path.join(dir, files.cities));
	const population = readCsv(path.join(dir, files.population));
	const network = readCsv(path.join(dir, files.transportNetwork));
	const modes = readCsv(path.join(dir, files.transportModes));
	const modeSpeeds = readCsv(path.join(dir, files.transportModeSpeed));

	const cityCodes = new Set(cities.records.map((record) => record.cityCode));
	const networkInsideCities = network.records.filter(
		(record) => cityCodes.has(record.cityCodeOri) && cityCodes.has(record.cityCodeDes)
	);
	const transportModeCodesInNetwork = unique(network.records.map((record) => record.transportModeCode));
	const roadModes = modes.records.filter((record) => record.name === 'Road');

	const latitudeValues = cities.records.map((record) => toNumber(record.latitude));
	const longitudeValues = cities.records.map((record) => toNumber(record.longitude));
	const populationYears = population.headers
		.filter((header) => /^pop\d{4}$/.test(header))
		.map((header) => Number(header.slice(3)));

	return {
		name,
		directory: path.relative(rootDir, dir),
		files,
		counts: {
			cities: cities.records.length,
			population: population.records.length,
			transportNetwork: network.records.length,
			transportNetworkInsideCities: networkInsideCities.length,
			transportModes: modes.records.length,
			transportModeSpeeds: modeSpeeds.records.length,
		},
		headers: {
			cities: cities.headers,
			population: population.headers,
			transportNetwork: network.headers,
			transportModes: modes.headers,
			transportModeSpeeds: modeSpeeds.headers,
		},
		cityCodeSample: [...cityCodes].slice(0, 10),
		bounds: {
			latitude: minMax(latitudeValues),
			longitude: minMax(longitudeValues),
		},
		years: {
			population: minMax(populationYears),
			transportModeSpeeds: yearRangeFromFields(modeSpeeds.records, ['year']),
			transportNetwork: yearRangeFromFields(network.records, ['eYearBegin', 'eYearEnd']),
		},
		transport: {
			roadModeCodes: roadModes.map((record) => record.code),
			modeNames: modes.records.map((record) => record.name),
			modeCodesInNetwork: transportModeCodesInNetwork,
		},
		notes: [
			'Characterization only. These values describe the current datasets and are not target expectations.',
			'Future expected behavior must be validated explicitly per migration step.',
		],
	};
}

ensureDir(path.join(rootDir, 'tests', 'characterization'));

const reports = datasets.map(characterizeDataset);
reports.forEach((report) => {
	writeJson(path.join(rootDir, 'tests', 'characterization', `${report.name}.json`), report);
});

writeJson(path.join(rootDir, 'tests', 'characterization', 'summary.json'), {
	reports: reports.map((report) => ({
		name: report.name,
		directory: report.directory,
		counts: report.counts,
		bounds: report.bounds,
		years: report.years,
	})),
});

console.log(`Characterized ${reports.length} datasets.`);
reports.forEach((report) => {
	console.log(
		`${report.name}: ${report.counts.cities} cities, ${report.counts.transportNetwork} edges, ` +
			`${report.counts.transportNetworkInsideCities} internal edges`
	);
});
