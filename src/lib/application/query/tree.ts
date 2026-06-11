import type { QueryFieldDefinition } from './types';
import type {
	QueryGroup,
	QueryLeaf,
	QueryNode,
	QueryScalar,
	TComparatorString,
} from '$lib/domain/query';

/**
 * Creates the default query tree exposed by the workspace editor.
 *
 * The root stays a group so the UI can always insert more filters without
 * replacing the root node.
 *
 * @param fields Queryable fields available in the current workspace snapshot.
 * @returns A minimal editable query tree.
 */
export function createDefaultQueryTree(fields: QueryFieldDefinition[]): QueryGroup {
	const firstField = fields[0];
	if (!firstField) {
		return {
			nodeType: 'group',
			type: 'AND',
			filters: [],
		};
	}

	return {
		nodeType: 'group',
		type: 'AND',
		filters: [createLeafFromField(firstField)],
	};
}

/**
 * Creates one leaf from the selected field definition.
 *
 * @param field Selected field definition.
 * @returns A default leaf compatible with the field type.
 */
export function createLeafFromField(field: QueryFieldDefinition): QueryLeaf {
	return {
		nodeType: 'filter',
		fieldKey: field.fieldKey,
		comparator: field.supportedComparators[0] ?? '=',
		value: defaultValueForField(field),
	};
}

/**
 * Returns the default scalar value for one field definition.
 *
 * @param field Field definition.
 * @returns A default scalar compatible with the field type.
 */
export function defaultValueForField(field: QueryFieldDefinition): QueryScalar {
	switch (field.valueType) {
		case 'number':
			return 0;
		case 'boolean':
			return false;
		case 'string':
			return '';
		case 'unknown':
		default:
			return null;
	}
}

/**
 * Returns the default comparator set for one field definition.
 *
 * @param field Field definition.
 * @returns The first supported comparator when available.
 */
export function defaultComparatorForField(field: QueryFieldDefinition): TComparatorString {
	return field.supportedComparators[0] ?? '=';
}

/**
 * Replaces one node in a query tree.
 *
 * @param root Root query group.
 * @param path Path of indexes leading to the target node.
 * @param updater Pure transformation applied to the target node.
 * @returns A new tree with the updated node.
 */
export function updateQueryNodeAtPath(
	root: QueryNode,
	path: number[],
	updater: (node: QueryNode) => QueryNode,
): QueryNode {
	if (path.length === 0) {
		return updater(root);
	}

	if (root.nodeType !== 'group') {
		return root;
	}

	const [head, ...tail] = path;
	const filters = root.filters.map((child, index) =>
		index === head ? updateQueryNodeAtPath(child, tail, updater) : child,
	);
	return {
		...root,
		filters,
	};
}

/**
 * Inserts one child node under the group designated by `path`.
 *
 * @param root Root query group.
 * @param path Path to the parent group.
 * @param child Child node to insert.
 * @param index Insertion index, appended by default.
 * @returns A new tree with the inserted child.
 */
export function insertQueryNodeAtPath(
	root: QueryNode,
	path: number[],
	child: QueryNode,
	index?: number,
): QueryNode {
	return updateQueryNodeAtPath(root, path, (node) => {
		if (node.nodeType !== 'group') {
			return node;
		}

		const nextFilters = [...node.filters];
		const nextIndex = index === undefined ? nextFilters.length : Math.max(0, Math.min(index, nextFilters.length));
		nextFilters.splice(nextIndex, 0, child);
		return {
			...node,
			filters: nextFilters,
		};
	});
}

/**
 * Removes one node designated by `path`.
 *
 * The root node is kept intact because the editor always expects a group root.
 *
 * @param root Root query group.
 * @param path Path to the node to remove.
 * @returns A new tree without the removed node.
 */
export function removeQueryNodeAtPath(root: QueryNode, path: number[]): QueryNode {
	if (path.length === 0) {
		return root;
	}

	const parentPath = path.slice(0, -1);
	const targetIndex = path[path.length - 1];
	return updateQueryNodeAtPath(root, parentPath, (node) => {
		if (node.nodeType !== 'group') {
			return node;
		}

		return {
			...node,
			filters: node.filters.filter((_, index) => index !== targetIndex),
		};
	});
}

/**
 * Moves one node designated by `path` one step up or down.
 *
 * The root node is kept intact and only sibling order changes.
 *
 * @param root Root query group.
 * @param path Path to the node to move.
 * @param direction Movement direction, `-1` for up and `1` for down.
 * @returns A new tree with the reordered node when possible.
 */
export function moveQueryNodeAtPath(root: QueryNode, path: number[], direction: -1 | 1): QueryNode {
	if (path.length === 0) {
		return root;
	}

	const parentPath = path.slice(0, -1);
	const targetIndex = path[path.length - 1];
	const nextIndex = targetIndex + direction;
	return updateQueryNodeAtPath(root, parentPath, (node) => {
		if (node.nodeType !== 'group') {
			return node;
		}

		if (nextIndex < 0 || nextIndex >= node.filters.length) {
			return node;
		}

		const nextFilters = [...node.filters];
		[nextFilters[targetIndex], nextFilters[nextIndex]] = [nextFilters[nextIndex], nextFilters[targetIndex]];
		return {
			...node,
			filters: nextFilters,
		};
	});
}
