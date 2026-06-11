import { parseCsv, toFiniteNumber } from './csv';
import { inspectDatasetFiles, resolveDatasetManifest } from './inspection';
import type {
	BaseCity,
	BaseCityCharacteristic,
	BaseEdge,
	BaseNetwork,
	BaseNetworkIndexes,
	BaseTransportMode,
	BaseTransportModeCharacteristic,
	DatasetDiagnostic,
	DatasetManifest,
	InspectedDatasetFile,
	QueryableField,
	SourceFile,
	SourceRecord,
} from './types';

type SourceRecordDraft = Omit<SourceRecord, 'id'>;

function pick(record: Record<string, string>, columns: string[]): Record<string, unknown> {
	return Object.fromEntries(columns.map((column) => [column, record[column]]));
}

function omit(record: Record<string, string>, columns: string[]): Record<string, unknown> {
	const columnSet = new Set(columns);
	return Object.fromEntries(Object.entries(record).filter(([column]) => !columnSet.has(column)));
}

function numberCharacteristic(
	record: Record<string, unknown>,
	column: string,
	diagnostics: DatasetDiagnostic[],
	context: Record<string, unknown>
): number {
	const number = toFiniteNumber(record[column]);
	if (number === null) {
		diagnostics.push({
			severity: 'error',
			code: 'invalid-number-characteristic',
			column,
			value: record[column] ?? null,
			...context,
		});
		return Number.NaN;
	}
	return number;
}

function nullableNumberCharacteristic(record: Record<string, unknown>, column: string): number | null {
	return toFiniteNumber(record[column]);
}

function createSourceRecords(
	sourceFilesByName: Map<string, SourceFile>,
	inspectedFile: InspectedDatasetFile,
	requiredColumns: string[]
): SourceRecordDraft[] {
	const sourceFile = sourceFilesByName.get(inspectedFile.originalName);
	if (!sourceFile) {
		throw new Error(`Missing source file for inspected file: ${inspectedFile.originalName}`);
	}

	const csv = parseCsv(sourceFile.text);
	return csv.records.map((record, rowIndex) => ({
		sourceFileName: inspectedFile.originalName,
		sourceKind: inspectedFile.kind,
		rowIndex,
		characteristic: pick(record, requiredColumns),
		extra: omit(record, requiredColumns),
		raw: record,
	}));
}

function addIndexValue(index: Record<string, number[]>, key: unknown, value: number): void {
	const normalizedKey = String(key);
	index[normalizedKey] ??= [];
	index[normalizedKey].push(value);
}

function haversineKm(cityA: BaseCityCharacteristic, cityB: BaseCityCharacteristic): number {
	const earthRadiusKm = 6371.0088;
	const latA = (cityA.latitude * Math.PI) / 180;
	const latB = (cityB.latitude * Math.PI) / 180;
	const deltaLat = ((cityB.latitude - cityA.latitude) * Math.PI) / 180;
	const deltaLon = ((cityB.longitude - cityA.longitude) * Math.PI) / 180;
	const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLon / 2) ** 2;
	return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function catalogFields(recordsByKind: Record<string, SourceRecord[]>): QueryableField[] {
	const fields: QueryableField[] = [];

	for (const records of Object.values(recordsByKind)) {
		const columns = new Map<string, QueryableField>();
		records.forEach((record) => {
			Object.keys(record.raw).forEach((column) => {
				if (!columns.has(column)) {
					columns.set(column, {
						sourceKind: record.sourceKind,
						column,
						occurrences: 0,
						characteristic: Object.prototype.hasOwnProperty.call(record.characteristic, column),
					});
				}
				const field = columns.get(column);
				if (field) {
					field.occurrences++;
				}
			});
		});
		fields.push(...columns.values());
	}

	return fields.sort((fieldA, fieldB) =>
		`${fieldA.sourceKind}:${fieldA.column}`.localeCompare(`${fieldB.sourceKind}:${fieldB.column}`)
	);
}

/**
 * Assembles a lossless base network from source files and a resolved manifest.
 *
 * Prepared static and dynamic structures belong to the next preparation phase.
 *
 * @param input Source files and an already resolved dataset manifest.
 * @returns A lossless, indexed base network with diagnostics.
 */
export function assembleBaseNetwork(input: { files: SourceFile[]; manifest: DatasetManifest }): BaseNetwork {
	if (!input.manifest.valid) {
		throw new Error(`Invalid dataset manifest: ${JSON.stringify(input.manifest.diagnostics, null, 2)}`);
	}

	const sourceFilesByName = new Map(input.files.map((file) => [file.name, file]));
	const diagnostics: DatasetDiagnostic[] = [...input.manifest.diagnostics];
	const sourceRecords: SourceRecord[] = [];

	const addSourceRecords = (records: SourceRecordDraft[]): SourceRecord[] => {
		const firstId = sourceRecords.length;
		const completeRecords = records.map((record, offset) => ({
			id: firstId + offset,
			...record,
		}));
		sourceRecords.push(...completeRecords);
		return completeRecords;
	};

	const cityRecords = addSourceRecords(
		createSourceRecords(sourceFilesByName, input.manifest.primary.cities, [
			'cityCode',
			'latitude',
			'longitude',
			'radius',
		])
	);
	const edgeRecords = addSourceRecords(
		createSourceRecords(sourceFilesByName, input.manifest.primary.transportNetwork, [
			'cityCodeOri',
			'cityCodeDes',
			'transportModeCode',
		])
	);
	const transportModeRecords = addSourceRecords(
		createSourceRecords(sourceFilesByName, input.manifest.primary.transportModes, ['code', 'name', 'terrestrial'])
	);
	const transportModeSpeedRecords = addSourceRecords(
		createSourceRecords(sourceFilesByName, input.manifest.primary.transportModeSpeeds, [
			'transportModeCode',
			'year',
			'speedKPH',
		])
	);

	const cityLinkedAttributeRecordsByFile: Record<string, SourceRecord[]> = {};
	for (const file of input.manifest.cityLinkedAttributes) {
		cityLinkedAttributeRecordsByFile[file.originalName] = addSourceRecords(
			createSourceRecords(sourceFilesByName, file, ['cityCode'])
		);
	}

	const indexes: BaseNetworkIndexes = {
		cityByCode: {},
		modeByCode: {},
		speedByModeAndYear: {},
		edgesByOrigin: {},
		edgesByDestination: {},
	};

	const cities = cityRecords.map<BaseCity>((record, id) => {
		const context = { sourceFileName: record.sourceFileName, rowIndex: record.rowIndex };
		const characteristic: BaseCityCharacteristic = {
			cityCode: numberCharacteristic(record.raw, 'cityCode', diagnostics, context),
			latitude: numberCharacteristic(record.raw, 'latitude', diagnostics, context),
			longitude: numberCharacteristic(record.raw, 'longitude', diagnostics, context),
			radius: nullableNumberCharacteristic(record.raw, 'radius'),
		};
		const city: BaseCity = {
			id,
			characteristic,
			sourceRecordId: record.id,
			linkedRecords: {},
			inEdgeIds: [],
			outEdgeIds: [],
		};
		const key = String(characteristic.cityCode);
		if (indexes.cityByCode[key] !== undefined) {
			diagnostics.push({
				severity: 'error',
				code: 'duplicate-city-code',
				cityCode: characteristic.cityCode,
				cityIds: [indexes.cityByCode[key], id],
			});
		}
		indexes.cityByCode[key] = id;
		return city;
	});

	const transportModes = transportModeRecords.map<BaseTransportMode>((record, id) => {
		const context = { sourceFileName: record.sourceFileName, rowIndex: record.rowIndex };
		const characteristic: BaseTransportModeCharacteristic = {
			code: numberCharacteristic(record.raw, 'code', diagnostics, context),
			name: String(record.raw.name ?? ''),
			terrestrial: record.raw.terrestrial,
		};
		const mode: BaseTransportMode = {
			id,
			characteristic,
			sourceRecordId: record.id,
			speedRecordIds: [],
		};
		const key = String(characteristic.code);
		if (indexes.modeByCode[key] !== undefined) {
			diagnostics.push({
				severity: 'error',
				code: 'duplicate-transport-mode-code',
				transportModeCode: characteristic.code,
				modeIds: [indexes.modeByCode[key], id],
			});
		}
		indexes.modeByCode[key] = id;
		return mode;
	});

	for (const record of transportModeSpeedRecords) {
		const context = { sourceFileName: record.sourceFileName, rowIndex: record.rowIndex };
		const transportModeCode = numberCharacteristic(record.raw, 'transportModeCode', diagnostics, context);
		const year = numberCharacteristic(record.raw, 'year', diagnostics, context);
		numberCharacteristic(record.raw, 'speedKPH', diagnostics, context);
		const speedKey = `${transportModeCode}:${year}`;
		addIndexValue(indexes.speedByModeAndYear, speedKey, record.id);

		const modeId = indexes.modeByCode[String(transportModeCode)];
		if (modeId === undefined) {
			diagnostics.push({
				severity: 'warning',
				code: 'speed-missing-transport-mode',
				transportModeCode,
				year,
				sourceRecordId: record.id,
			});
		} else {
			transportModes[modeId].speedRecordIds.push(record.id);
		}
	}

	const edges = edgeRecords.map<BaseEdge>((record, id) => {
		const context = { sourceFileName: record.sourceFileName, rowIndex: record.rowIndex };
		const characteristic = {
			cityCodeOri: numberCharacteristic(record.raw, 'cityCodeOri', diagnostics, context),
			cityCodeDes: numberCharacteristic(record.raw, 'cityCodeDes', diagnostics, context),
			transportModeCode: numberCharacteristic(record.raw, 'transportModeCode', diagnostics, context),
		};
		const originCityId = indexes.cityByCode[String(characteristic.cityCodeOri)];
		const destinationCityId = indexes.cityByCode[String(characteristic.cityCodeDes)];
		const transportModeId = indexes.modeByCode[String(characteristic.transportModeCode)];
		const edge: BaseEdge = {
			id,
			characteristic,
			sourceRecordId: record.id,
			originCityId,
			destinationCityId,
			transportModeId,
			derived: {},
		};

		if (originCityId === undefined) {
			diagnostics.push({
				severity: 'warning',
				code: 'edge-missing-origin-city',
				edgeId: id,
				cityCode: characteristic.cityCodeOri,
			});
		} else {
			cities[originCityId].outEdgeIds.push(id);
			addIndexValue(indexes.edgesByOrigin, characteristic.cityCodeOri, id);
		}

		if (destinationCityId === undefined) {
			diagnostics.push({
				severity: 'warning',
				code: 'edge-missing-destination-city',
				edgeId: id,
				cityCode: characteristic.cityCodeDes,
			});
		} else {
			cities[destinationCityId].inEdgeIds.push(id);
			addIndexValue(indexes.edgesByDestination, characteristic.cityCodeDes, id);
		}

		if (transportModeId === undefined) {
			diagnostics.push({
				severity: 'warning',
				code: 'edge-missing-transport-mode',
				edgeId: id,
				transportModeCode: characteristic.transportModeCode,
			});
		}

		if (originCityId !== undefined && destinationCityId !== undefined) {
			edge.derived.distCrowKM = haversineKm(cities[originCityId].characteristic, cities[destinationCityId].characteristic);
		}
		return edge;
	});

	for (const [fileName, records] of Object.entries(cityLinkedAttributeRecordsByFile)) {
		for (const record of records) {
			const context = { sourceFileName: record.sourceFileName, rowIndex: record.rowIndex };
			const cityCode = numberCharacteristic(record.raw, 'cityCode', diagnostics, context);
			const cityId = indexes.cityByCode[String(cityCode)];
			if (cityId === undefined) {
				diagnostics.push({
					severity: 'warning',
					code: 'city-linked-record-missing-city',
					fileName,
					cityCode,
					sourceRecordId: record.id,
				});
				continue;
			}
			cities[cityId].linkedRecords[fileName] ??= [];
			cities[cityId].linkedRecords[fileName].push(record.id);
		}
	}

	const recordsByKind = {
		cities: cityRecords,
		transportNetwork: edgeRecords,
		transportModes: transportModeRecords,
		transportModeSpeeds: transportModeSpeedRecords,
		cityLinkedAttributes: Object.values(cityLinkedAttributeRecordsByFile).flat(),
	};

	return {
		cities,
		edges,
		transportModes,
		sourceRecords,
		indexes,
		fields: catalogFields(recordsByKind),
		diagnostics,
	};
}

/**
 * Inspects, resolves, and assembles source files in one call.
 *
 * This helper is convenient for UI/import flows. Tests and migration scripts can
 * call `inspectDatasetFiles` and `resolveDatasetManifest` separately when they
 * need to inspect intermediate diagnostics.
 */
export function assembleBaseNetworkFromFiles(files: SourceFile[]): BaseNetwork {
	const inspectedFiles = inspectDatasetFiles(files);
	const manifest = resolveDatasetManifest(inspectedFiles);
	return assembleBaseNetwork({ files, manifest });
}
