#!/usr/bin/env node
import { createDeflate } from 'zlib';
import { createWriteStream, readdirSync, readFileSync } from 'fs';
import { Readable } from 'stream';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureCleanDir, ensureDir, writeJson } from './dataset-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'datasets');
const targetDir = path.join(rootDir, 'static', 'datasets');

function listDatasetDirectories() {
	return readdirSync(sourceDir, { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name)
		.sort();
}

function folderToFileList(datasetDir) {
	return readdirSync(datasetDir, { withFileTypes: true })
		.filter((dirent) => !dirent.isDirectory())
		.map((dirent) => dirent.name)
		.sort()
		.map((name) => ({
			name,
			text: readFileSync(path.join(datasetDir, name), 'utf8')
		}));
}

function writeDeflatedJson(file, data) {
	return new Promise((resolve, reject) => {
		const readable = new Readable({
			read() {}
		});
		const deflate = createDeflate({ level: 9 });
		const output = createWriteStream(file);
		output.on('finish', resolve);
		output.on('error', reject);
		deflate.on('error', reject);
		readable.pipe(deflate).pipe(output);
		readable.push(JSON.stringify(data), 'utf8');
		readable.push(null);
	});
}

ensureCleanDir(targetDir);
const datasets = listDatasetDirectories();

for (const dataset of datasets) {
	const files = folderToFileList(path.join(sourceDir, dataset));
	await writeDeflatedJson(path.join(targetDir, dataset), files);
}

ensureDir(targetDir);
writeJson(path.join(targetDir, 'datasets.json'), datasets);

console.log(`Built ${datasets.length} compressed datasets in ${path.relative(rootDir, targetDir)}.`);
