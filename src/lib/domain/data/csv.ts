import Papa from 'papaparse';

/**
 * Parsed CSV content.
 *
 * Values are intentionally kept as strings. Type interpretation belongs to the
 * assembly and preparation phases, where diagnostics can be emitted with full
 * source context.
 */
export interface ParsedCsv {
	headers: string[];
	records: Array<Record<string, string>>;
}

/**
 * Parses CSV text through PapaParse.
 *
 * PapaParse is already used by the historical `Merger`, works in both browser
 * and Node contexts, and avoids maintaining a project-specific CSV parser.
 *
 * `dynamicTyping` is deliberately disabled: the data layer must preserve source
 * values, then convert only characteristic fields with explicit diagnostics.
 */
export function parseCsv(text: string): ParsedCsv {
	const result = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ''), {
		header: true,
		skipEmptyLines: true,
		dynamicTyping: false,
	});

	return {
		headers: result.meta.fields ?? [],
		records: result.data,
	};
}

/**
 * Parses a finite number from a source value.
 *
 * `NA` and empty values are treated as missing values and return `null`.
 */
export function toFiniteNumber(value: unknown): number | null {
	if (value === undefined || value === null || value === '' || value === 'NA') {
		return null;
	}
	const number = Number(value);
	return Number.isFinite(number) ? number : null;
}

