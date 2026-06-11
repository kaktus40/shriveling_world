/** Human-facing comparator strings shared by the query tree and evaluator. */
export type TComparatorString =
	| '<'
	| '<='
	| '>'
	| '>='
	| '='
	| '<>'
	| 'empty'
	| 'not empty'
	| 'in';

/** Scalar value supported by the query AST and by serialized worker payloads. */
export type QueryScalar = string | number | boolean | null;

/** One atomic filter in the query AST. */
export interface QueryLeaf {
	nodeType: 'filter';
	fieldKey: string;
	comparator: TComparatorString;
	value: QueryScalar;
}

/** One logical group in the query AST. */
export interface QueryGroup {
	nodeType: 'group';
	type: 'AND' | 'OR';
	filters: QueryNode[];
}

/** One node in the human-editable query tree. */
export type QueryNode = QueryLeaf | QueryGroup;

/** One serializable record consumed by the pure query evaluator. */
export interface QueryRecord {
	valuesByFieldKey: Record<string, QueryScalar[]>;
}

/** Structured diagnostics emitted while evaluating or building query payloads. */
export interface QueryDiagnostic {
	severity: 'error' | 'warning';
	code: string;
	[key: string]: unknown;
}
