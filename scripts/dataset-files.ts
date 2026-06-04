import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
	inspectDatasetFiles,
	parseCsv,
	resolveDatasetManifest,
	type DatasetManifest,
	type InspectedDatasetFile,
	type ParsedCsv,
	type SourceFile,
} from '../src/lib/domain/data';

/** Result returned when a dataset directory has been inspected from disk. */
export interface DatasetDirectoryInspection {
	/** Source files read from the dataset directory. */
	sourceFiles: SourceFile[];
	/** File-level inspection results. */
	files: InspectedDatasetFile[];
	/** Order-independent resolved manifest. */
	manifest: DatasetManifest;
}

/** Reads a UTF-8 text file while normalizing an optional BOM. */
export function readTextFile(file: string): string {
	return readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

/**
 * Reads all direct files from a dataset directory.
 *
 * The returned order is deterministic for reports, but consumers must still
 * rely on schema inspection rather than file order.
 */
export function readDatasetSourceFiles(datasetDir: string): SourceFile[] {
	return readdirSync(datasetDir, { withFileTypes: true })
		.filter((dirent) => dirent.isFile())
		.map((dirent) => dirent.name)
		.sort()
		.map((name) => ({
			name,
			text: readTextFile(path.join(datasetDir, name)),
		}));
}

/** Inspects every source file from a dataset directory and resolves its manifest. */
export function inspectDatasetDirectory(datasetDir: string): DatasetDirectoryInspection {
	const sourceFiles = readDatasetSourceFiles(datasetDir);
	const files = inspectDatasetFiles(sourceFiles);
	return {
		sourceFiles,
		files,
		manifest: resolveDatasetManifest(files),
	};
}

/**
 * Inspects a dataset directory and rejects it when a required primary table is
 * missing or ambiguous.
 */
export function requireValidDatasetManifest(datasetDir: string): DatasetDirectoryInspection {
	const inspection = inspectDatasetDirectory(datasetDir);
	if (!inspection.manifest.valid) {
		throw new Error(
			`${datasetDir}: invalid dataset manifest: ${JSON.stringify(inspection.manifest.diagnostics, null, 2)}`
		);
	}
	return inspection;
}

/** Reads the CSV content corresponding to an inspected file from a dataset directory. */
export function readManifestCsv(datasetDir: string, inspectedFile: InspectedDatasetFile): ParsedCsv {
	return parseCsv(readTextFile(path.join(datasetDir, inspectedFile.originalName)));
}
