import type { QueryDiagnostic, QueryNode, QueryRecord, QueryScalar, TComparatorString } from './types';

/**
 * Evaluates one query AST against one serializable record.
 *
 * Multi-valued fields follow the migration rule validated for user
 * enrichments: a leaf predicate is true when at least one value satisfies it.
 *
 * @param node Query AST node.
 * @param record Serialized record values.
 * @returns True when the record matches the AST.
 */
export function evaluateQueryNode(node: QueryNode, record: QueryRecord): boolean {
	if (node.nodeType === 'group') {
		return evaluateGroup(node, record);
	}

	return evaluateLeaf(node.fieldKey, node.comparator, node.value, record.valuesByFieldKey[node.fieldKey] ?? []);
}

/**
 * Returns diagnostics for one query AST against a known field catalog.
 *
 * @param node Query AST node.
 * @param knownFieldKeys Available field keys.
 * @returns Structured diagnostics describing invalid leaves or empty groups.
 */
export function validateQueryNode(node: QueryNode, knownFieldKeys: Set<string>): QueryDiagnostic[] {
	const diagnostics: QueryDiagnostic[] = [];
	collectQueryDiagnostics(node, knownFieldKeys, diagnostics);
	return diagnostics;
}

function evaluateGroup(node: Extract<QueryNode, { nodeType: 'group' }>, record: QueryRecord): boolean {
	if (node.filters.length === 0) {
		return true;
	}

	return node.type === 'AND'
		? node.filters.every((child) => evaluateQueryNode(child, record))
		: node.filters.some((child) => evaluateQueryNode(child, record));
}

function evaluateLeaf(
	fieldKey: string,
	comparator: TComparatorString,
	expectedValue: QueryScalar,
	values: QueryScalar[],
): boolean {
	if (comparator === 'empty') {
		return values.length === 0 || values.every((value) => normalizeValue(value) === null);
	}
	if (comparator === 'not empty') {
		return values.some((value) => normalizeValue(value) !== null);
	}

	return values.some((value) => compareValues(fieldKey, comparator, value, expectedValue));
}

function compareValues(
	fieldKey: string,
	comparator: TComparatorString,
	leftValue: QueryScalar,
	rightValue: QueryScalar,
): boolean {
	const normalizedLeft = normalizeValue(leftValue);
	const normalizedRight = normalizeValue(rightValue);

	if (normalizedLeft === null) {
		return false;
	}

	if (comparator === 'in') {
		return evaluateContains(normalizedLeft, normalizedRight);
	}

	if (typeof normalizedLeft === 'number' && typeof normalizedRight === 'number') {
		switch (comparator) {
			case '<':
				return normalizedLeft < normalizedRight;
			case '<=':
				return normalizedLeft <= normalizedRight;
			case '>':
				return normalizedLeft > normalizedRight;
			case '>=':
				return normalizedLeft >= normalizedRight;
			case '=':
				return normalizedLeft === normalizedRight;
			case '<>':
				return normalizedLeft !== normalizedRight;
			default:
				return false;
		}
	}

	const leftText = String(normalizedLeft).toLocaleLowerCase();
	const rightText = String(normalizedRight ?? '').toLocaleLowerCase();

	switch (comparator) {
		case '=':
			return leftText === rightText;
		case '<>':
			return leftText !== rightText;
		case '<':
			return leftText < rightText;
		case '<=':
			return leftText <= rightText;
		case '>':
			return leftText > rightText;
		case '>=':
			return leftText >= rightText;
		default:
			throw new RangeError(`Unsupported comparator "${comparator}" for field "${fieldKey}"`);
	}
}

function evaluateContains(leftValue: QueryScalar, rightValue: QueryScalar): boolean {
	if (rightValue === null) {
		return false;
	}
	const tokens = String(rightValue)
		.toLocaleLowerCase()
		.split(/\s+/)
		.map((token) => token.trim())
		.filter((token) => token.length > 0);
	if (tokens.length === 0) {
		return false;
	}

	const haystack = String(leftValue).toLocaleLowerCase();
	return tokens.some((token) => haystack.includes(token));
}

function normalizeValue(value: QueryScalar): QueryScalar {
	if (value === undefined || value === null) {
		return null;
	}
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (trimmed === '') {
			return null;
		}
		const parsedNumber = Number(trimmed);
		if (!Number.isNaN(parsedNumber) && trimmed === String(parsedNumber)) {
			return parsedNumber;
		}
		return trimmed;
	}
	return value;
}

function collectQueryDiagnostics(
	node: QueryNode,
	knownFieldKeys: Set<string>,
	diagnostics: QueryDiagnostic[],
): void {
	if (node.nodeType === 'group') {
		if (node.filters.length === 0) {
			diagnostics.push({
				severity: 'warning',
				code: 'query-group-empty',
				groupType: node.type,
			});
			return;
		}
		node.filters.forEach((child) => collectQueryDiagnostics(child, knownFieldKeys, diagnostics));
		return;
	}

	if (!knownFieldKeys.has(node.fieldKey)) {
		diagnostics.push({
			severity: 'error',
			code: 'query-field-unknown',
			fieldKey: node.fieldKey,
		});
	}

	if ((node.comparator === 'empty' || node.comparator === 'not empty') && node.value !== null) {
		diagnostics.push({
			severity: 'warning',
			code: 'query-comparator-ignores-value',
			fieldKey: node.fieldKey,
			comparator: node.comparator,
		});
	}
}
