import {
	createLeafFromField,
	defaultComparatorForField,
	defaultValueForField,
	type QueryFieldDefinition,
} from '$lib/application/query';
import type { QueryGroup, QueryLeaf, QueryNode, QueryScalar } from '$lib/domain/query';

export function currentFieldForNode(
	node: QueryNode,
	fields: QueryFieldDefinition[],
): QueryFieldDefinition | undefined {
	if (node.nodeType !== 'filter') {
		return undefined;
	}
	return fields.find((field) => field.fieldKey === node.fieldKey) ?? fields[0];
}

export function selectFieldNode(
	node: QueryNode,
	fields: QueryFieldDefinition[],
	fieldKey: string,
): QueryLeaf | null {
	if (node.nodeType !== 'filter') {
		return null;
	}

	const nextField = fields.find((field) => field.fieldKey === fieldKey) ?? fields[0];
	if (!nextField) {
		return null;
	}

	return {
		...node,
		fieldKey: nextField.fieldKey,
		comparator: defaultComparatorForField(nextField),
		value: defaultValueForField(nextField),
	};
}

export function selectComparatorNode(
	node: QueryNode,
	fields: QueryFieldDefinition[],
	comparator: string,
): QueryLeaf | null {
	if (node.nodeType !== 'filter') {
		return null;
	}

	const nextComparator = comparator as QueryLeaf['comparator'];
	const selectedField = currentFieldForNode(node, fields);
	const nextValue =
		nextComparator === 'empty' || nextComparator === 'not empty'
			? null
			: node.value ?? defaultValueForField(selectedField ?? fields[0] ?? createSyntheticField(node.fieldKey));

	return {
		...node,
		comparator: nextComparator,
		value: nextValue,
	};
}

export function selectValueNode(
	node: QueryNode,
	fields: QueryFieldDefinition[],
	rawValue: string,
): QueryLeaf | null {
	if (node.nodeType !== 'filter') {
		return null;
	}

	return {
		...node,
		value: coerceValue(rawValue, currentFieldForNode(node, fields)?.valueType ?? 'unknown'),
	};
}

export function toggleGroupTypeNode(node: QueryNode, type: 'AND' | 'OR'): QueryGroup | null {
	if (node.nodeType !== 'group') {
		return null;
	}

	return {
		...node,
		type,
	};
}

export function createEmptyGroup(): QueryGroup {
	return {
		nodeType: 'group',
		type: 'AND',
		filters: [],
	};
}

export function createSyntheticField(fieldKey: string): QueryFieldDefinition {
	return {
		fieldKey,
		label: fieldKey,
		sourceKind: 'cities',
		sourceFileName: 'synthetic',
		column: fieldKey,
		valueType: 'unknown',
		characteristic: false,
		multiValued: false,
		supportedComparators: ['=', '<>', 'empty', 'not empty', 'in'] as QueryFieldDefinition['supportedComparators'],
	};
}

export function coerceValue(rawValue: string, valueType: QueryFieldDefinition['valueType']): QueryScalar {
	if (rawValue === '') {
		return '';
	}

	switch (valueType) {
		case 'number': {
			const parsed = Number(rawValue);
			return Number.isNaN(parsed) ? 0 : parsed;
		}
		case 'boolean':
			return rawValue === 'true';
		case 'string':
		case 'unknown':
		default:
			return rawValue;
	}
}

export function isComparatorValueFree(node: QueryNode): boolean {
	return node.nodeType === 'filter' && node.comparator !== 'empty' && node.comparator !== 'not empty';
}

export function defaultLeafForField(field: QueryFieldDefinition): QueryLeaf {
	return createLeafFromField(field);
}
