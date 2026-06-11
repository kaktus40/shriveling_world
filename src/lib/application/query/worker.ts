import { evaluateQueryNode, validateQueryNode } from '$lib/domain/query';
import type { QueryExecutionResult, QueryWorkerRequest } from './types';

/**
 * Executes one city query against one serialized dataset snapshot.
 *
 * This function is pure and can be called directly in tests or from a Worker
 * message handler.
 *
 * @param request Query worker request.
 * @returns Matched city ids/indexes and diagnostics.
 */
export function executeQueryWorkerRequest(request: QueryWorkerRequest): QueryExecutionResult {
	const knownFieldKeys = new Set(request.dataset.fields.map((field) => field.fieldKey));
	const diagnostics = validateQueryNode(request.query, knownFieldKeys);
	const matchedCityIndexes: number[] = [];
	const matchedCityIds: number[] = [];

	if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
		return {
			matchedCityIndexes: new Uint32Array(),
			matchedCityIds: new Uint32Array(),
			diagnostics,
		};
	}

	for (const city of request.dataset.cities) {
		if (!evaluateQueryNode(request.query, { valuesByFieldKey: city.valuesByFieldKey })) {
			continue;
		}
		matchedCityIndexes.push(city.cityIndex);
		matchedCityIds.push(city.cityId);
	}

	return {
		matchedCityIndexes: Uint32Array.from(matchedCityIndexes),
		matchedCityIds: Uint32Array.from(matchedCityIds),
		diagnostics,
	};
}
