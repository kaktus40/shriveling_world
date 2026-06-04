import { parseCsv } from './csv';
import type { DatasetDiagnostic, DatasetFileKind, DatasetManifest, InspectedDatasetFile, SourceFile } from './types';

interface FileSignature {
	kind: Exclude<DatasetFileKind, 'cityLinkedAttributes' | 'geojson' | 'unknown'>;
	requiredColumns: string[];
	unique: boolean;
}

const PRIMARY_SIGNATURES: FileSignature[] = [
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
		requiredColumns: ['code', 'name', 'terrestrial'],
		unique: true,
	},
	{
		kind: 'transportNetwork',
		requiredColumns: ['transportModeCode', 'cityCodeDes', 'cityCodeOri'],
		unique: true,
	},
];

const REQUIRED_PRIMARY_KINDS: Array<keyof DatasetManifest['primary']> = [
	'cities',
	'transportNetwork',
	'transportModes',
	'transportModeSpeeds',
];

function byOriginalName(fileA: InspectedDatasetFile, fileB: InspectedDatasetFile): number {
	return fileA.originalName.localeCompare(fileB.originalName);
}

function hasColumns(headers: string[], requiredColumns: string[]): boolean {
	const headerSet = new Set(headers);
	return requiredColumns.every((column) => headerSet.has(column));
}

function splitHeaders(headers: string[], requiredColumns: string[]) {
	const requiredSet = new Set(requiredColumns);
	return {
		requiredHeadersFound: headers.filter((header) => requiredSet.has(header)),
		missingHeaders: requiredColumns.filter((column) => !headers.includes(column)),
		extraHeaders: headers.filter((header) => !requiredSet.has(header)),
	};
}

/**
 * Inspects one CSV source file using the project structural dataset contract.
 *
 * The most specific primary signatures are tested before the generic
 * `cityLinkedAttributes` fallback. This prevents the `cities` table from being
 * misclassified only because it also contains `cityCode`.
 */
export function inspectCsvSourceFile(sourceFile: SourceFile): InspectedDatasetFile {
	const headers = parseCsv(sourceFile.text).headers;
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

/**
 * Inspects one JSON source file as a potential GeoJSON file.
 *
 * The migration only needs a structural GeoJSON check here. Semantic boundary
 * validation belongs to a later preparation step.
 */
export function inspectJsonSourceFile(sourceFile: SourceFile): InspectedDatasetFile {
	try {
		const value = JSON.parse(sourceFile.text) as { type?: unknown } | null;
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
			errors: [`invalid json: ${error instanceof Error ? error.message : String(error)}`],
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

/**
 * Inspects one source file.
 *
 * Unsupported extensions become `unknown` files instead of being discarded.
 * This keeps diagnostics complete and prevents silent data loss.
 */
export function inspectSourceFile(sourceFile: SourceFile): InspectedDatasetFile {
	const extension = sourceFile.name.slice(sourceFile.name.lastIndexOf('.')).toLowerCase();
	if (extension === '.csv') {
		return inspectCsvSourceFile(sourceFile);
	}
	if (extension === '.geojson' || extension === '.json') {
		return inspectJsonSourceFile(sourceFile);
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

/**
 * Inspects all source files without assuming their order.
 *
 * The returned list is intentionally file-local. Consumers must call
 * `resolveDatasetManifest` before parsing and assembling the dataset.
 */
export function inspectDatasetFiles(sourceFiles: SourceFile[]): InspectedDatasetFile[] {
	return sourceFiles.map(inspectSourceFile);
}

/**
 * Resolves an order-independent dataset manifest from inspected files.
 *
 * This function enforces uniqueness of primary files and groups optional
 * enrichment and GeoJSON files. Unknown files are retained as warnings.
 */
export function resolveDatasetManifest(inspectedFiles: InspectedDatasetFile[]): DatasetManifest {
	const diagnostics: DatasetDiagnostic[] = [];
	const primary = {} as Partial<DatasetManifest['primary']>;

	for (const kind of REQUIRED_PRIMARY_KINDS) {
		const matches = inspectedFiles.filter((file) => file.kind === kind);
		if (matches.length === 0) {
			diagnostics.push({ severity: 'error', code: 'missing-primary-file', kind });
		} else if (matches.length > 1) {
			diagnostics.push({
				severity: 'error',
				code: 'multiple-primary-files',
				kind,
				files: matches.map((file) => file.originalName).sort(),
			});
		} else {
			primary[kind] = matches[0];
		}
	}

	const unknown = inspectedFiles.filter((file) => file.kind === 'unknown').sort(byOriginalName);
	for (const file of unknown) {
		diagnostics.push({
			severity: 'warning',
			code: 'unknown-file',
			file: file.originalName,
			errors: file.errors,
		});
	}

	return {
		primary: primary as DatasetManifest['primary'],
		cityLinkedAttributes: inspectedFiles.filter((file) => file.kind === 'cityLinkedAttributes').sort(byOriginalName),
		geojson: inspectedFiles.filter((file) => file.kind === 'geojson').sort(byOriginalName),
		unknown,
		diagnostics,
		valid: diagnostics.every((diagnostic) => diagnostic.severity !== 'error'),
	};
}

