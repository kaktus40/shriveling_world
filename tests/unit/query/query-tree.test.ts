import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
	createDefaultQueryTree,
	createLeafFromField,
	insertQueryNodeAtPath,
	moveQueryNodeAtPath,
	removeQueryNodeAtPath,
	updateQueryNodeAtPath,
	type QueryFieldDefinition,
} from '$lib/application/query';
import type { QueryNode } from '$lib/domain/query';

const fields: QueryFieldDefinition[] = [
	{
		fieldKey: 'cities:towns.csv:cityName',
		label: 'cityName',
		sourceKind: 'cities',
		sourceFileName: 'towns.csv',
		column: 'cityName',
		valueType: 'string',
		characteristic: false,
		multiValued: false,
		supportedComparators: ['=', '<>', 'empty', 'not empty', 'in'],
	},
	{
		fieldKey: 'cityLinkedAttributes:population.csv:pop1950',
		label: 'population.csv · pop1950',
		sourceKind: 'cityLinkedAttributes',
		sourceFileName: 'population.csv',
		column: 'pop1950',
		valueType: 'number',
		characteristic: false,
		multiValued: true,
		supportedComparators: ['<', '<=', '>', '>=', '=', '<>', 'empty', 'not empty'],
	},
];

test('query tree helpers build a default editable root', () => {
	const tree = createDefaultQueryTree(fields);

	assert.equal(tree.nodeType, 'group');
	assert.equal(tree.filters.length, 1);
	assert.equal(tree.filters[0].nodeType, 'filter');
});

test('query tree helpers can insert and remove nested nodes', () => {
	const root = createDefaultQueryTree(fields);
	const nextRoot = insertQueryNodeAtPath(root, [], {
		nodeType: 'group',
		type: 'OR',
		filters: [createLeafFromField(fields[1])],
	});

	assert.equal(nextRoot.nodeType, 'group');
	assert.equal(nextRoot.filters.length, 2);

	const removedRoot = removeQueryNodeAtPath(nextRoot, [1]);
	assert.equal(removedRoot.nodeType, 'group');
	assert.equal(removedRoot.filters.length, 1);
});

test('query tree helpers can reorder sibling nodes', () => {
	const root = createDefaultQueryTree(fields);
	const withTwoChildren = insertQueryNodeAtPath(root, [], {
		nodeType: 'filter',
		fieldKey: fields[1].fieldKey,
		comparator: '>=',
		value: 1500,
	});

	const movedDown = moveQueryNodeAtPath(withTwoChildren, [0], 1);

	assert.equal(movedDown.nodeType, 'group');
	assert.equal(movedDown.filters[0].nodeType, 'filter');
	assert.equal(movedDown.filters[1].nodeType, 'filter');
	assert.equal(movedDown.filters[0].fieldKey, fields[1].fieldKey);
	assert.equal(movedDown.filters[1].fieldKey, fields[0].fieldKey);
});

test('query tree helpers update a node by path', () => {
	const root = createDefaultQueryTree(fields);
	const updated = updateQueryNodeAtPath(root, [0], (node): QueryNode => {
		if (node.nodeType !== 'filter') {
			return node;
		}

		return {
			...node,
			comparator: '>=',
			value: 1500,
		};
	});

	assert.equal(updated.nodeType, 'group');
	assert.equal(updated.filters[0].nodeType, 'filter');
	assert.equal(updated.filters[0].comparator, '>=');
	assert.equal(updated.filters[0].value, 1500);
});
