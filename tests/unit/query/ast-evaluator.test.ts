import assert from 'node:assert/strict';
import { test } from 'vitest';

import { evaluateQueryNode, type QueryGroup, type QueryLeaf, type QueryRecord } from '$lib/domain/query';

const record: QueryRecord = {
	valuesByFieldKey: {
		pop1950: [120000],
		surface: [12.5],
		name: ['Paris'],
		aliases: ['Paris intra muros', 'Ville de Paris'],
		emptyField: [null],
	}
};

test('query evaluator supports nested AND/OR groups', () => {
	const query: QueryGroup = {
		nodeType: 'group',
		type: 'AND',
		filters: [
			{ nodeType: 'filter', fieldKey: 'pop1950', comparator: '>=', value: 100000 },
			{
				nodeType: 'group',
				type: 'OR',
				filters: [
					{ nodeType: 'filter', fieldKey: 'surface', comparator: '>', value: 20 },
					{ nodeType: 'filter', fieldKey: 'name', comparator: '=', value: 'Paris' },
				],
			},
		],
	};

	assert.equal(evaluateQueryNode(query, record), true);
});

test('query evaluator treats multivalued fields as any-match', () => {
	const query: QueryLeaf = {
		nodeType: 'filter',
		fieldKey: 'aliases',
		comparator: 'in',
		value: 'ville',
	};

	assert.equal(evaluateQueryNode(query, record), true);
});

test('query evaluator supports empty and not empty comparators', () => {
	assert.equal(
		evaluateQueryNode({ nodeType: 'filter', fieldKey: 'emptyField', comparator: 'empty', value: null }, record),
		true,
	);
	assert.equal(
		evaluateQueryNode({ nodeType: 'filter', fieldKey: 'surface', comparator: 'not empty', value: null }, record),
		true,
	);
});
