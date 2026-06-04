import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import path from 'path';

export function ensureCleanDir(dir) {
	mkdirSync(path.dirname(dir), { recursive: true });
	if (existsSync(dir)) {
		rmSync(dir, { recursive: true, force: true });
	}
	mkdirSync(dir, { recursive: true });
}

export function ensureDir(dir) {
	mkdirSync(dir, { recursive: true });
}

export function readText(file) {
	return readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

export function writeJson(file, data) {
	ensureDir(path.dirname(file));
	writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function detectDelimiter(text) {
	const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
	const commaCount = (firstLine.match(/,/g) ?? []).length;
	const semicolonCount = (firstLine.match(/;/g) ?? []).length;
	return semicolonCount > commaCount ? ';' : ',';
}

export function parseCsv(text) {
	const delimiter = detectDelimiter(text);
	const rows = [];
	let row = [];
	let field = '';
	let quoted = false;

	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		if (quoted) {
			if (char === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					quoted = false;
				}
			} else {
				field += char;
			}
		} else if (char === '"') {
			quoted = true;
		} else if (char === delimiter) {
			row.push(field);
			field = '';
		} else if (char === '\n') {
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else if (char !== '\r') {
			field += char;
		}
	}

	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	const nonEmptyRows = rows.filter((items) => items.some((item) => item !== ''));
	const headers = nonEmptyRows[0] ?? [];
	const records = nonEmptyRows.slice(1).map((items) => {
		const record = {};
		headers.forEach((header, index) => {
			record[header] = items[index] ?? '';
		});
		return record;
	});

	return { headers, records };
}

export function stringifyCsv(headers, records) {
	const escapeField = (value) => {
		const text = value == null ? '' : String(value);
		return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
	};
	const lines = [headers.map(escapeField).join(',')];
	records.forEach((record) => {
		lines.push(headers.map((header) => escapeField(record[header])).join(','));
	});
	return `${lines.join('\n')}\n`;
}

export function readCsv(file) {
	return parseCsv(readText(file));
}

export function writeCsv(file, headers, records) {
	writeFileSync(file, stringifyCsv(headers, records));
}

export function copyDatasetFile(sourceDir, targetDir, fileName) {
	copyFileSync(path.join(sourceDir, fileName), path.join(targetDir, fileName));
}

export function toNumber(value) {
	if (value === undefined || value === null || value === '' || value === 'NA') {
		return null;
	}
	const number = Number(value);
	return Number.isFinite(number) ? number : null;
}

export function minMax(values) {
	const numbers = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
	return numbers.length === 0 ? { min: null, max: null } : { min: Math.min(...numbers), max: Math.max(...numbers) };
}
