import type { QueryDiagnostic, QueryNode, QueryScalar, TComparatorString } from '$lib/domain/query';

/** Inferred field type exposed by the application query catalog. */
export type QueryFieldValueType = 'number' | 'string' | 'boolean' | 'unknown';

/** One field that can be shown in the human-facing query tree. */
export interface QueryFieldDefinition {
	fieldKey: string;
	label: string;
	sourceKind: string;
	sourceFileName: string;
	column: string;
	valueType: QueryFieldValueType;
	characteristic: boolean;
	multiValued: boolean;
	supportedComparators: TComparatorString[];
}

/** Serialized city values sent to the query worker. */
export interface QueryCitySnapshot {
	cityIndex: number;
	cityId: number;
	cityCode: number;
	valuesByFieldKey: Record<string, QueryScalar[]>;
}

/** Serialized dataset consumed by the query worker. */
export interface QueryDatasetSnapshot {
	fields: QueryFieldDefinition[];
	cities: QueryCitySnapshot[];
}

/** Worker request payload for city queries. */
export interface QueryWorkerRequest {
	dataset: QueryDatasetSnapshot;
	query: QueryNode;
}

/** Query execution result returned by the worker. */
export interface QueryExecutionResult {
	matchedCityIndexes: Uint32Array;
	matchedCityIds: Uint32Array;
	diagnostics: QueryDiagnostic[];
}
