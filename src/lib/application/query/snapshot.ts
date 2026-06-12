import type { TComparatorString } from '$lib/domain/query';
import type { BaseCity, DatasetFileKind, QueryableField, SourceRecord } from '$lib/domain/data';
import type { WorkspaceDatasetSnapshot } from '$lib/application/workspace';
import type { QueryDatasetSnapshot, QueryFieldDefinition, QueryFieldValueType } from './types';

/**
 * Builds a serializable city-query snapshot from one loaded workspace.
 *
 * The resulting payload is detached from `BaseNetwork` object graphs so it can
 * be posted to a worker without sending non-serializable domain helpers.
 *
 * @param workspace Prepared dataset workspace.
 * @returns Query-ready snapshot for worker execution.
 */
export function buildQueryDatasetSnapshot(workspace: WorkspaceDatasetSnapshot): QueryDatasetSnapshot {
	const fields = buildFieldDefinitions(workspace);
	const fieldByKey = new Map(fields.map((field) => [field.fieldKey, field]));
	const cities = workspace.pipeline.baseNetwork.cities.map((city, cityIndex) =>
		buildCitySnapshot(city, cityIndex, workspace, fieldByKey),
	);
	return { fields, cities };
}

function buildFieldDefinitions(workspace: WorkspaceDatasetSnapshot): QueryFieldDefinition[] {
	const fields = workspace.pipeline.baseNetwork.fields
		.filter((field) => field.sourceKind === 'cities' || field.sourceKind === 'cityLinkedAttributes')
		.map((field) => {
			const sourceFileName = resolveRepresentativeSourceFileName(workspace, field);
			const valueType = inferFieldValueType(workspace, field, sourceFileName);
			const multiValued = field.sourceKind === 'cityLinkedAttributes';
			return {
				fieldKey: toFieldKey(field.sourceKind, sourceFileName, field.column),
				label: multiValued ? `${sourceFileName} · ${field.column}` : field.column,
				sourceKind: field.sourceKind,
				sourceFileName,
				column: field.column,
				valueType,
				characteristic: field.characteristic,
				multiValued,
				supportedComparators: supportedComparatorsForType(valueType),
			};
		});

	fields.sort((left, right) => left.label.localeCompare(right.label));
	return fields;
}

function buildCitySnapshot(
	city: BaseCity,
	cityIndex: number,
	workspace: WorkspaceDatasetSnapshot,
	fieldByKey: Map<string, QueryFieldDefinition>,
) {
	const cityRecord = workspace.pipeline.baseNetwork.sourceRecords[city.sourceRecordId];
	const valuesByFieldKey: Record<string, Array<string | number | boolean | null>> = {};

	appendRecordValues(cityRecord, 'cities', cityRecord.sourceFileName, valuesByFieldKey, fieldByKey);

	for (const [sourceFileName, recordIds] of Object.entries(city.linkedRecords)) {
		for (const recordId of recordIds) {
			const record = workspace.pipeline.baseNetwork.sourceRecords[recordId];
			appendRecordValues(record, 'cityLinkedAttributes', sourceFileName, valuesByFieldKey, fieldByKey);
		}
	}

	return {
		cityIndex,
		cityId: workspace.pipeline.preparedDataset.cityIds[cityIndex],
		cityCode: workspace.pipeline.preparedDataset.cityCodes[cityIndex],
		valuesByFieldKey,
	};
}

function appendRecordValues(
	record: SourceRecord,
	sourceKind: DatasetFileKind,
	sourceFileName: string,
	valuesByFieldKey: Record<string, Array<string | number | boolean | null>>,
	fieldByKey: Map<string, QueryFieldDefinition>,
): void {
	for (const [column, value] of Object.entries(record.raw)) {
		const fieldKey = toFieldKey(sourceKind, sourceFileName, column);
		if (!fieldByKey.has(fieldKey)) {
			continue;
		}
		const target = (valuesByFieldKey[fieldKey] ??= []);
		target.push(toQueryScalar(value));
	}
}

function inferFieldValueType(
	workspace: WorkspaceDatasetSnapshot,
	field: QueryableField,
	sourceFileName: string,
): QueryFieldValueType {
	const values = collectFieldValues(workspace, field.sourceKind, sourceFileName, field.column);
	const nonNullValues = values.filter((value) => value !== null);
	if (nonNullValues.length === 0) {
		return 'unknown';
	}
	if (nonNullValues.every((value) => typeof value === 'number')) {
		return 'number';
	}
	if (nonNullValues.every((value) => typeof value === 'boolean')) {
		return 'boolean';
	}
	return 'string';
}

function collectFieldValues(
	workspace: WorkspaceDatasetSnapshot,
	sourceKind: DatasetFileKind,
	sourceFileName: string,
	column: string,
): Array<string | number | boolean | null> {
	const values: Array<string | number | boolean | null> = [];
	for (const record of workspace.pipeline.baseNetwork.sourceRecords) {
		if (record.sourceKind !== sourceKind || record.sourceFileName !== sourceFileName) {
			continue;
		}
		if (!(column in record.raw)) {
			continue;
		}
		values.push(toQueryScalar(record.raw[column]));
	}
	return values;
}

function resolveRepresentativeSourceFileName(workspace: WorkspaceDatasetSnapshot, field: QueryableField): string {
	for (const record of workspace.pipeline.baseNetwork.sourceRecords) {
		if (record.sourceKind === field.sourceKind && field.column in record.raw) {
			return record.sourceFileName;
		}
	}
	return field.sourceKind;
}

function supportedComparatorsForType(valueType: QueryFieldValueType): TComparatorString[] {
	switch (valueType) {
		case 'number':
			return ['<', '<=', '>', '>=', '=', '<>', 'empty', 'not empty'];
		case 'boolean':
			return ['=', '<>', 'empty', 'not empty'];
		case 'string':
		case 'unknown':
		default:
			return ['=', '<>', 'empty', 'not empty', 'in'];
	}
}

function toFieldKey(sourceKind: DatasetFileKind, sourceFileName: string, column: string): string {
	return `${sourceKind}:${sourceFileName}:${column}`;
}

function toQueryScalar(value: unknown): string | number | boolean | null {
	if (value === null || value === undefined) {
		return null;
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (trimmed === '') {
			return null;
		}
		if (trimmed.toLowerCase() === 'true') {
			return true;
		}
		if (trimmed.toLowerCase() === 'false') {
			return false;
		}
		const numeric = Number(trimmed);
		if (!Number.isNaN(numeric)) {
			return numeric;
		}
		return trimmed;
	}
	return String(value);
}
