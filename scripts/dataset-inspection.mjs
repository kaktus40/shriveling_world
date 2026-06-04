import { readdirSync } from 'fs';
import path from 'path';
import { parseCsv, readText } from './dataset-utils.mjs';

const PRIMARY_SIGNATURES = [
	{
		kind: 'cities',
		requiredColumns: ['cityCode', 'latitude', 'longitude', 'radius'],
		unique: true,
	},
	{
		kind: 'transportModeSpeeds',
		requiredColumns: ['transportModeCode', 'year', 'speedKPH'],
		unique: true,
	},
	{
		kind: 'transportModes',
		requiredColumns: ['code', 'terrestrial'],
		unique: true,
	},
	{
		kind: 'transportNetwork',
		requiredColumns: ['transportModeCode', 'cityCodeDes', 'cityCodeOri'],
		unique: true,
	},
];

const REQUIRED_PRIMARY_KINDS = ['cities', 'transportNetwork', 'transportModes', 'transportModeSpeeds'];

function hasColumns(headers, requiredColumns) {
	const headerSet = new Set(headers);
	return requiredColumns.every((column) => headerSet.has(column));
}

function splitHeaders(headers, requiredColumns) {
	const requiredSet = new Set(requiredColumns);
	return {
		requiredHeadersFound: headers.filter((header) => requiredSet.has(header)),
		missingHeaders: requiredColumns.filter((column) => !headers.includes(column)),
		extraHeaders: headers.filter((header) => !requiredSet.has(header)),
	};
}

function inspectCsvFile(sourceFile) {
	const headers = parseCsv(sourceFile.text).headers.map((header) => header.trim());
	const candidates = PRIMARY_SIGNATURES.filter((signature) => hasColumns(headers, signature.requiredColumns));
	const signature = candidates[0];

	if (signature) {
		return {
			originalName: sourceFile.name,
			kind: signature.kind,
			confidence: 1,
			headers,
			candidateKinds: candidates.map((candidate) => candidate.kind),
			...splitHeaders(headers, signature.requiredColumns),
			errors: [],
		};
	}

	if (headers.includes('cityCode')) {
		return {
			originalName: sourceFile.name,
			kind: 'cityLinkedAttributes',
			confidence: 0.8,
			headers,
			candidateKinds: ['cityLinkedAttributes'],
			...splitHeaders(headers, ['cityCode']),
			errors: [],
		};
	}

	return {
		originalName: sourceFile.name,
		kind: 'unknown',
		confidence: 0,
		headers,
		candidateKinds: [],
		requiredHeadersFound: [],
		missingHeaders: [],
		extraHeaders: headers,
		errors: ['csv schema does not match any dataset signature'],
	};
}

function inspectJsonFile(sourceFile) {
	try {
		const value = JSON.parse(sourceFile.text);
		if (value && typeof value === 'object' && value.type) {
			return {
				originalName: sourceFile.name,
				kind: 'geojson',
				confidence: 1,
				headers: [],
				candidateKinds: ['geojson'],
				requiredHeadersFound: [],
				missingHeaders: [],
				extraHeaders: [],
				errors: [],
			};
		}
	} catch (error) {
		return {
			originalName: sourceFile.name,
			kind: 'unknown',
			confidence: 0,
			headers: [],
			candidateKinds: [],
			requiredHeadersFound: [],
			missingHeaders: [],
			extraHeaders: [],
			errors: [`invalid json: ${error.message}`],
		};
	}

	return {
		originalName: sourceFile.name,
		kind: 'unknown',
		confidence: 0,
		headers: [],
		candidateKinds: [],
		requiredHeadersFound: [],
		missingHeaders: [],
		extraHeaders: [],
		errors: ['json file is not GeoJSON'],
	};
}

export function inspectSourceFile(sourceFile) {
	const extension = path.extname(sourceFile.name).toLowerCase();
	if (extension === '.csv') {
		return inspectCsvFile(sourceFile);
	}
	if (extension === '.geojson' || extension === '.json') {
		return inspectJsonFile(sourceFile);
	}
	return {
		originalName: sourceFile.name,
		kind: 'unknown',
		confidence: 0,
		headers: [],
		candidateKinds: [],
		requiredHeadersFound: [],
		missingHeaders: [],
		extraHeaders: [],
		errors: [`unsupported file extension: ${extension || '<none>'}`],
	};
}

export function readDatasetSourceFiles(datasetDir) {
	return readdirSync(datasetDir, { withFileTypes: true })
		.filter((dirent) => dirent.isFile())
		.map((dirent) => dirent.name)
		.sort()
		.map((name) => ({
			name,
			text: readText(path.join(datasetDir, name)),
		}));
}

export function inspectDatasetFiles(sourceFiles) {
	return sourceFiles.map(inspectSourceFile);
}

export function resolveDatasetManifest(inspectedFiles) {
	const diagnostics = [];
	const primary = {};

	for (const kind of REQUIRED_PRIMARY_KINDS) {
		const matches = inspectedFiles.filter((file) => file.kind === kind);
		if (matches.length === 0) {
			diagnostics.push({ severity: 'error', code: 'missing-primary-file', kind });
		} else if (matches.length > 1) {
			diagnostics.push({
				severity: 'error',
				code: 'multiple-primary-files',
				kind,
				files: matches.map((file) => file.originalName),
			});
		} else {
			primary[kind] = matches[0];
		}
	}

	const unknown = inspectedFiles.filter((file) => file.kind === 'unknown');
	for (const file of unknown) {
		diagnostics.push({
			severity: 'warning',
			code: 'unknown-file',
			file: file.originalName,
			errors: file.errors,
		});
	}

	return {
		primary,
		cityLinkedAttributes: inspectedFiles.filter((file) => file.kind === 'cityLinkedAttributes'),
		geojson: inspectedFiles.filter((file) => file.kind === 'geojson'),
		unknown,
		diagnostics,
		valid: diagnostics.every((diagnostic) => diagnostic.severity !== 'error'),
	};
}

export function inspectDatasetDirectory(datasetDir) {
	const sourceFiles = readDatasetSourceFiles(datasetDir);
	const inspectedFiles = inspectDatasetFiles(sourceFiles);
	return {
		files: inspectedFiles,
		manifest: resolveDatasetManifest(inspectedFiles),
	};
}

export function requireValidDatasetManifest(datasetDir) {
	const inspection = inspectDatasetDirectory(datasetDir);
	if (!inspection.manifest.valid) {
		throw new Error(
			`${datasetDir}: invalid dataset manifest: ${JSON.stringify(inspection.manifest.diagnostics, null, 2)}`
		);
	}
	return inspection;
}
