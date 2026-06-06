import { prepareSpeedTimeline } from './preparation';
import {
	PREPARED_EDGE_STRIDE,
	UNBOUNDED_EDGE_YEAR_BEGIN,
	UNBOUNDED_EDGE_YEAR_END,
	type BaseNetwork,
	type DatasetDiagnostic,
	type PrepareSpeedTimelineOptions,
	type PreparedDataset,
	type PreparedSpeedTimeline,
} from './types';
import { toFiniteNumber } from './csv';

const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * Builds compact compute-ready buffers from a lossless base network.
 *
 * Source:
 * - stable city, edge, and transport-mode arrays from `BaseNetwork`;
 * - relationships resolved during lossless assembly;
 * - prepared speed timeline and mode classification.
 *
 * Transform:
 * - preserves stable base-network city and mode order;
 * - converts city longitude/latitude from source degrees to internal radians;
 * - excludes unresolved edges from compute buffers without mutating
 *   `BaseNetwork`;
 * - extracts every known non-road edge pair for curve-control precomputation;
 * - preserves ids linking every compact entity to the lossless network and
 *   source records.
 *
 * Historical equivalent:
 * - the linked and validated `IMergerData` state immediately before
 *   `prepareStaticTownGeometry` in `toBabylon/reader.ts`.
 */
export function prepareDataset(
	baseNetwork: BaseNetwork,
	options: PrepareSpeedTimelineOptions = {},
): PreparedDataset {
	const speedTimeline = prepareSpeedTimeline(baseNetwork, options);
	const diagnostics: DatasetDiagnostic[] = [...baseNetwork.diagnostics, ...speedTimeline.diagnostics];
	const cityCount = baseNetwork.cities.length;
	const cityIds = new Uint32Array(cityCount);
	const citySourceRecordIds = new Uint32Array(cityCount);
	const cityCodes = new Float64Array(cityCount);
	const cityLonLatRadians = new Float32Array(cityCount * 2);
	const cityIndexByCode: Record<string, number> = {};

	baseNetwork.cities.forEach((city, cityIndex) => {
		const { cityCode, longitude, latitude } = city.characteristic;
		cityIds[cityIndex] = city.id;
		citySourceRecordIds[cityIndex] = city.sourceRecordId;
		cityCodes[cityIndex] = cityCode;
		cityLonLatRadians[cityIndex * 2] = longitude * DEGREES_TO_RADIANS;
		cityLonLatRadians[cityIndex * 2 + 1] = latitude * DEGREES_TO_RADIANS;
		cityIndexByCode[String(cityCode)] = cityIndex;

		if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
			diagnostics.push({
				severity: 'error',
				code: 'prepared-city-invalid-coordinates',
				cityId: city.id,
				cityCode,
				longitudeDegrees: longitude,
				latitudeDegrees: latitude,
			});
		}
	});

	const modeCount = baseNetwork.transportModes.length;
	const modeIds = new Uint32Array(modeCount);
	const modeCodes = new Float64Array(modeCount);
	const modeSourceRecordIds = new Uint32Array(modeCount);
	baseNetwork.transportModes.forEach((mode, modeIndex) => {
		modeIds[modeIndex] = mode.id;
		modeCodes[modeIndex] = mode.characteristic.code;
		modeSourceRecordIds[modeIndex] = mode.sourceRecordId;
	});

	const validEdges = baseNetwork.edges.filter((edge) => {
		const resolved =
			edge.originCityId !== undefined &&
			edge.destinationCityId !== undefined &&
			edge.transportModeId !== undefined;
		if (!resolved) {
			diagnostics.push({
				severity: 'warning',
				code: 'prepared-edge-excluded-unresolved',
				edgeId: edge.id,
				sourceRecordId: edge.sourceRecordId,
			});
		}
		return resolved;
	});

	const edgeCount = validEdges.length;
	const edgeIds = new Uint32Array(edgeCount);
	const edgeSourceRecordIds = new Uint32Array(edgeCount);
	const edges = new Uint32Array(edgeCount * PREPARED_EDGE_STRIDE);
	const edgeYearBegins = new Int32Array(edgeCount);
	const edgeYearEnds = new Int32Array(edgeCount);
	const curvePairs: number[] = [];
	const curveEdgeIdValues: number[] = [];

	validEdges.forEach((edge, edgeIndex) => {
		const originCityIndex = edge.originCityId as number;
		const destinationCityIndex = edge.destinationCityId as number;
		const modeIndex = edge.transportModeId as number;
		const offset = edgeIndex * PREPARED_EDGE_STRIDE;
		edgeIds[edgeIndex] = edge.id;
		edgeSourceRecordIds[edgeIndex] = edge.sourceRecordId;
		edges[offset] = originCityIndex;
		edges[offset + 1] = destinationCityIndex;
		edges[offset + 2] = modeIndex;
		const sourceRecord = baseNetwork.sourceRecords[edge.sourceRecordId];
		const yearBegin = sourceRecord ? toFiniteNumber(sourceRecord.raw.eYearBegin) : null;
		const yearEnd = sourceRecord ? toFiniteNumber(sourceRecord.raw.eYearEnd) : null;
		edgeYearBegins[edgeIndex] = prepareEdgeYear(
			yearBegin,
			UNBOUNDED_EDGE_YEAR_BEGIN,
			'eYearBegin',
			edge.id,
			edge.sourceRecordId,
			diagnostics,
		);
		edgeYearEnds[edgeIndex] = prepareEdgeYear(
			yearEnd,
			UNBOUNDED_EDGE_YEAR_END,
			'eYearEnd',
			edge.id,
			edge.sourceRecordId,
			diagnostics,
		);
		if (edgeYearBegins[edgeIndex] > edgeYearEnds[edgeIndex]) {
			diagnostics.push({
				severity: 'error',
				code: 'prepared-edge-empty-period',
				edgeId: edge.id,
				sourceRecordId: edge.sourceRecordId,
				yearBegin: edgeYearBegins[edgeIndex],
				yearEnd: edgeYearEnds[edgeIndex],
			});
		}

		if (modeIndex !== speedTimeline.roadModeId) {
			curvePairs.push(originCityIndex, destinationCityIndex);
			curveEdgeIdValues.push(edge.id);
		}
	});

	return {
		cityCount,
		cityIds,
		citySourceRecordIds,
		cityCodes,
		cityLonLatRadians,
		cityIndexByCode,
		edgeCount,
		edgeIds,
		edgeSourceRecordIds,
		edges,
		edgeYearBegins,
		edgeYearEnds,
		modeCount,
		modeIds,
		modeCodes,
		modeSourceRecordIds,
		speedTimeline,
		curveEdgePairs: Uint32Array.from(curvePairs),
		curveEdgeIds: Uint32Array.from(curveEdgeIdValues),
		diagnostics,
	};
}

/**
 * Adapts a prepared dataset to the static-town CPU profile input contract.
 *
 * Typed arrays are shared by reference; this function performs no copy.
 */
export function toStaticTownInput(preparedDataset: PreparedDataset): {
	cityLonLatRadians: Float32Array;
	curveEdgePairs: Uint32Array;
} {
	return {
		cityLonLatRadians: preparedDataset.cityLonLatRadians,
		curveEdgePairs: preparedDataset.curveEdgePairs,
	};
}

/**
 * Returns whether preparation emitted any blocking diagnostic.
 *
 * This helper does not throw so callers can display all diagnostics before
 * deciding whether to start compute precomputation.
 */
export function hasPreparedDatasetErrors(preparedDataset: PreparedDataset): boolean {
	return preparedDataset.diagnostics.some((diagnostic) => diagnostic.severity === 'error');
}

function prepareEdgeYear(
	year: number | null,
	unboundedValue: number,
	column: string,
	edgeId: number,
	sourceRecordId: number,
	diagnostics: DatasetDiagnostic[],
): number {
	if (year === null) {
		return unboundedValue;
	}
	if (!Number.isSafeInteger(year) || year <= UNBOUNDED_EDGE_YEAR_BEGIN || year >= UNBOUNDED_EDGE_YEAR_END) {
		diagnostics.push({
			severity: 'error',
			code: 'prepared-edge-invalid-year',
			column,
			edgeId,
			sourceRecordId,
			year,
		});
		return unboundedValue;
	}
	return year;
}
