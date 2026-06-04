import { parseCsv, toNumber } from './dataset-utils.mjs';
import {
	inspectDatasetFiles,
	readDatasetSourceFiles,
	resolveDatasetManifest,
} from './dataset-inspection.mjs';

function pick(record, columns) {
	return Object.fromEntries(columns.map((column) => [column, record[column]]));
}

function omit(record, columns) {
	const columnSet = new Set(columns);
	return Object.fromEntries(Object.entries(record).filter(([column]) => !columnSet.has(column)));
}

function numberCharacteristic(record, column, diagnostics, context) {
	const number = toNumber(record[column]);
	if (number === null) {
		diagnostics.push({
			severity: 'error',
			code: 'invalid-number-characteristic',
			column,
			value: record[column],
			...context,
		});
	}
	return number;
}

function nullableNumberCharacteristic(record, column) {
	return toNumber(record[column]);
}

function createSourceRecords(sourceFilesByName, inspectedFile, requiredColumns) {
	const sourceFile = sourceFilesByName.get(inspectedFile.originalName);
	if (!sourceFile) {
		throw new Error(`Missing source file for inspected file: ${inspectedFile.originalName}`);
	}
	const csv = parseCsv(sourceFile.text);
	return csv.records.map((record, index) => ({
		sourceFileName: inspectedFile.originalName,
		sourceKind: inspectedFile.kind,
		rowIndex: index,
		characteristic: pick(record, requiredColumns),
		extra: omit(record, requiredColumns),
		raw: record,
	}));
}

function addIndexValue(index, key, value) {
	const normalizedKey = String(key);
	if (!index[normalizedKey]) {
		index[normalizedKey] = [];
	}
	index[normalizedKey].push(value);
}

function haversineKm(cityA, cityB) {
	const earthRadiusKm = 6371.0088;
	const latA = (cityA.latitude * Math.PI) / 180;
	const latB = (cityB.latitude * Math.PI) / 180;
	const deltaLat = ((cityB.latitude - cityA.latitude) * Math.PI) / 180;
	const deltaLon = ((cityB.longitude - cityA.longitude) * Math.PI) / 180;
	const a =
		Math.sin(deltaLat / 2) ** 2 +
		Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLon / 2) ** 2;
	return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function catalogFields(recordsByKind) {
	const fields = [];
	for (const [kind, records] of Object.entries(recordsByKind)) {
		const columns = new Map();
		records.forEach((record) => {
			Object.keys(record.raw).forEach((column) => {
				if (!columns.has(column)) {
					columns.set(column, {
						sourceKind: kind,
						column,
						occurrences: 0,
						characteristic: Object.prototype.hasOwnProperty.call(record.characteristic, column),
					});
				}
				columns.get(column).occurrences++;
			});
		});
		fields.push(...columns.values());
	}
	return fields.sort((fieldA, fieldB) =>
		`${fieldA.sourceKind}:${fieldA.column}`.localeCompare(`${fieldB.sourceKind}:${fieldB.column}`)
	);
}

export function assembleBaseNetworkFromSourceFiles(sourceFiles) {
	const inspectedFiles = inspectDatasetFiles(sourceFiles);
	const manifest = resolveDatasetManifest(inspectedFiles);
	if (!manifest.valid) {
		throw new Error(`Invalid dataset manifest: ${JSON.stringify(manifest.diagnostics, null, 2)}`);
	}

	const sourceFilesByName = new Map(sourceFiles.map((file) => [file.name, file]));
	const diagnostics = [];
	const sourceRecords = [];

	const addSourceRecords = (records) => {
		const firstId = sourceRecords.length;
		records.forEach((record, offset) => {
			record.id = firstId + offset;
			sourceRecords.push(record);
		});
		return records;
	};

	const cityRecords = addSourceRecords(
		createSourceRecords(sourceFilesByName, manifest.primary.cities, ['cityCode', 'latitude', 'longitude', 'radius'])
	);
	const edgeRecords = addSourceRecords(
		createSourceRecords(sourceFilesByName, manifest.primary.transportNetwork, [
			'cityCodeOri',
			'cityCodeDes',
			'transportModeCode',
		])
	);
	const transportModeRecords = addSourceRecords(
		createSourceRecords(sourceFilesByName, manifest.primary.transportModes, ['code', 'name', 'terrestrial'])
	);
	const transportModeSpeedRecords = addSourceRecords(
		createSourceRecords(sourceFilesByName, manifest.primary.transportModeSpeeds, ['transportModeCode', 'year', 'speedKPH'])
	);
	const cityLinkedAttributeRecordsByFile = {};
	for (const file of manifest.cityLinkedAttributes) {
		cityLinkedAttributeRecordsByFile[file.originalName] = addSourceRecords(
			createSourceRecords(sourceFilesByName, file, ['cityCode'])
		);
	}

	const indexes = {
		cityByCode: {},
		modeByCode: {},
		speedByModeAndYear: {},
		edgesByOrigin: {},
		edgesByDestination: {},
	};

	const cities = cityRecords.map((record, id) => {
		const context = { sourceFileName: record.sourceFileName, rowIndex: record.rowIndex };
		const characteristic = {
			cityCode: numberCharacteristic(record.raw, 'cityCode', diagnostics, context),
			latitude: numberCharacteristic(record.raw, 'latitude', diagnostics, context),
			longitude: numberCharacteristic(record.raw, 'longitude', diagnostics, context),
			radius: nullableNumberCharacteristic(record.raw, 'radius'),
		};
		const city = {
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

	const transportModes = transportModeRecords.map((record, id) => {
		const context = { sourceFileName: record.sourceFileName, rowIndex: record.rowIndex };
		const characteristic = {
			code: numberCharacteristic(record.raw, 'code', diagnostics, context),
			name: record.raw.name,
			terrestrial: record.raw.terrestrial,
		};
		const mode = {
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

	const edges = edgeRecords.map((record, id) => {
		const context = { sourceFileName: record.sourceFileName, rowIndex: record.rowIndex };
		const characteristic = {
			cityCodeOri: numberCharacteristic(record.raw, 'cityCodeOri', diagnostics, context),
			cityCodeDes: numberCharacteristic(record.raw, 'cityCodeDes', diagnostics, context),
			transportModeCode: numberCharacteristic(record.raw, 'transportModeCode', diagnostics, context),
		};
		const originCityId = indexes.cityByCode[String(characteristic.cityCodeOri)];
		const destinationCityId = indexes.cityByCode[String(characteristic.cityCodeDes)];
		const transportModeId = indexes.modeByCode[String(characteristic.transportModeCode)];
		const edge = {
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
			if (!cities[cityId].linkedRecords[fileName]) {
				cities[cityId].linkedRecords[fileName] = [];
			}
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

export function assembleBaseNetwork(datasetDir) {
	return assembleBaseNetworkFromSourceFiles(readDatasetSourceFiles(datasetDir));
}
