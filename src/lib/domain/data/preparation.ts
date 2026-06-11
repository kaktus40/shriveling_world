import type {
	BaseEdge,
	BaseNetwork,
	BaseTransportMode,
	DatasetDiagnostic,
	PreparedSpeedTimeline,
	PreparedSpeedYear,
	PreparedTransportModeTimeline,
	PrepareSpeedTimelineOptions,
	RoadModeReference,
	PreparedTimeSpan,
	SourceRecord,
} from './types';
import { toFiniteNumber } from './csv';

const DEFAULT_ROAD_MODE_NAME = 'road';

interface SpeedPoint {
	year: number;
	speedMetersPerSecond: number;
	sourceRecordId: number;
}

function normalizeRoadModeName(name: unknown): string {
	return String(name ?? '').trim().toLowerCase();
}

function normalizeTerrestrialFlag(value: unknown): boolean | null {
	if (typeof value === 'boolean') {
		return value;
	}
	if (typeof value === 'number') {
		if (value === 1) return true;
		if (value === 0) return false;
	}
	const normalized = String(value ?? '').trim().toLowerCase();
	if (['1', 'true', 'yes', 'y'].includes(normalized)) {
		return true;
	}
	if (['0', 'false', 'no', 'n'].includes(normalized)) {
		return false;
	}
	return null;
}

function kphToMetersPerSecond(speedKph: number): number {
	return (speedKph * 1000) / 3600;
}

function readOptionalYear(record: SourceRecord, column: string): number | null {
	return toFiniteNumber(record.raw[column]);
}

function readRequiredNumber(
	record: SourceRecord,
	column: string,
	diagnostics: DatasetDiagnostic[],
	context: Record<string, unknown>
): number | null {
	const value = toFiniteNumber(record.raw[column]);
	if (value === null) {
		diagnostics.push({
			severity: 'error',
			code: 'prepared-invalid-number',
			column,
			sourceRecordId: record.id,
			...context,
		});
	}
	return value;
}

/**
 * Identifies the unique reference road mode in a lossless base network.
 *
 * Source:
 * - `transportModes.characteristic.name`;
 * - `transportModes.characteristic.code`;
 * - `transportModes.characteristic.terrestrial`.
 *
 * Transform:
 * - compares the configured road mode name case-insensitively;
 * - requires exactly one matching mode;
 * - requires that mode to be terrestrial.
 *
 * Units:
 * - no measured value is converted by this function.
 *
 * Earlier equivalent:
 * - road mode identification, with stricter diagnostics.
 */
export function identifyRoadMode(
	baseNetwork: BaseNetwork,
	options: PrepareSpeedTimelineOptions = {},
	diagnostics: DatasetDiagnostic[] = []
): RoadModeReference | null {
	const roadModeName = normalizeRoadModeName(options.roadModeName ?? DEFAULT_ROAD_MODE_NAME);
	const candidates = baseNetwork.transportModes.filter(
		(mode) => normalizeRoadModeName(mode.characteristic.name) === roadModeName
	);

	if (candidates.length === 0) {
		diagnostics.push({ severity: 'error', code: 'road-mode-missing', roadModeName });
		return null;
	}
	if (candidates.length > 1) {
		diagnostics.push({
			severity: 'error',
			code: 'road-mode-ambiguous',
			roadModeName,
			modeIds: candidates.map((mode) => mode.id),
			modeCodes: candidates.map((mode) => mode.characteristic.code),
		});
		return null;
	}

	const roadMode = candidates[0];
	const terrestrial = normalizeTerrestrialFlag(roadMode.characteristic.terrestrial);
	if (terrestrial !== true) {
		diagnostics.push({
			severity: 'error',
			code: 'road-mode-not-terrestrial',
			modeId: roadMode.id,
			modeCode: roadMode.characteristic.code,
			terrestrial: roadMode.characteristic.terrestrial,
		});
		return null;
	}

	return {
		roadModeId: roadMode.id,
		roadModeCode: roadMode.characteristic.code,
	};
}

function collectSpeedPointsByMode(baseNetwork: BaseNetwork, diagnostics: DatasetDiagnostic[]): Map<number, SpeedPoint[]> {
	const speedPointsByMode = new Map<number, SpeedPoint[]>();

	baseNetwork.transportModes.forEach((mode) => {
		const points: SpeedPoint[] = [];
		mode.speedRecordIds.forEach((sourceRecordId) => {
			const record = baseNetwork.sourceRecords[sourceRecordId];
			if (!record) {
				diagnostics.push({ severity: 'error', code: 'speed-record-missing-source', modeId: mode.id, sourceRecordId });
				return;
			}

			const context = { modeId: mode.id, modeCode: mode.characteristic.code, sourceRecordId };
			const year = readRequiredNumber(record, 'year', diagnostics, context);
			const speedKph = readRequiredNumber(record, 'speedKPH', diagnostics, context);
			if (year === null || speedKph === null) {
				return;
			}
			if (speedKph <= 0) {
				diagnostics.push({
					severity: 'error',
					code: 'transport-mode-invalid-speed',
					modeId: mode.id,
					modeCode: mode.characteristic.code,
					year,
					speedKPH: speedKph,
					sourceRecordId,
				});
				return;
			}

			points.push({ year, speedMetersPerSecond: kphToMetersPerSecond(speedKph), sourceRecordId });
		});
		points.sort((pointA, pointB) => pointA.year - pointB.year);
		speedPointsByMode.set(mode.id, points);
	});

	return speedPointsByMode;
}

function modeEdges(baseNetwork: BaseNetwork, mode: BaseTransportMode): BaseEdge[] {
	return baseNetwork.edges.filter((edge) => edge.transportModeId === mode.id);
}

function computeEdgeBounds(baseNetwork: BaseNetwork, mode: BaseTransportMode): { begin: number | null; end: number | null; edgeCount: number } {
	const edges = modeEdges(baseNetwork, mode);
	let begin: number | null = null;
	let end: number | null = null;
	let hasMissingBegin = false;
	let hasMissingEnd = false;

	edges.forEach((edge) => {
		const record = baseNetwork.sourceRecords[edge.sourceRecordId];
		const edgeBegin = record ? readOptionalYear(record, 'eYearBegin') : null;
		const edgeEnd = record ? readOptionalYear(record, 'eYearEnd') : null;
		if (edgeBegin === null) {
			hasMissingBegin = true;
		} else {
			begin = begin === null ? edgeBegin : Math.min(begin, edgeBegin);
		}
		if (edgeEnd === null) {
			hasMissingEnd = true;
		} else {
			end = end === null ? edgeEnd : Math.max(end, edgeEnd);
		}
	});

	return {
		begin: hasMissingBegin ? null : begin,
		end: hasMissingEnd ? null : end,
		edgeCount: edges.length,
	};
}

/**
 * Computes per-mode validity periods from speed records and network-edge dates.
 *
 * Source:
 * - speed records linked to transport modes;
 * - edge date columns `eYearBegin` and `eYearEnd`;
 * - edge references produced by `assembleBaseNetwork`.
 *
 * Transform:
 * - speed years bound the period where a mode can be evaluated;
 * - edge dates bound the period where a non-road service exists;
 * - a missing edge begin/end removes that edge-date constraint.
 *
 * Units:
 * - years are dimensionless calendar years.
 *
 * Earlier equivalent:
 * - per-mode time bounds.
 */
export function computeTransportModeTimeBounds(
	baseNetwork: BaseNetwork,
	roadReference: RoadModeReference,
	diagnostics: DatasetDiagnostic[] = []
): PreparedTransportModeTimeline[] {
	const speedPointsByMode = collectSpeedPointsByMode(baseNetwork, diagnostics);
	return computeTransportModeTimeBoundsFromSpeedPoints(baseNetwork, roadReference, speedPointsByMode, diagnostics);
}

function computeTransportModeTimeBoundsFromSpeedPoints(
	baseNetwork: BaseNetwork,
	roadReference: RoadModeReference,
	speedPointsByMode: Map<number, SpeedPoint[]>,
	diagnostics: DatasetDiagnostic[]
): PreparedTransportModeTimeline[] {
	return baseNetwork.transportModes.map((mode) => {
		const speedPoints = speedPointsByMode.get(mode.id) ?? [];
		const speedYears = speedPoints.map((point) => point.year);
		const speedYearBegin = speedYears.length > 0 ? Math.min(...speedYears) : null;
		const speedYearEnd = speedYears.length > 0 ? Math.max(...speedYears) : null;
		const edgeBounds = computeEdgeBounds(baseNetwork, mode);
		const terrestrial = normalizeTerrestrialFlag(mode.characteristic.terrestrial) === true;

		if (speedYears.length === 0) {
			diagnostics.push({
				severity: 'error',
				code: 'transport-mode-without-speed',
				modeId: mode.id,
				modeCode: mode.characteristic.code,
			});
		}
		if (mode.id !== roadReference.roadModeId && edgeBounds.edgeCount === 0) {
			diagnostics.push({
				severity: 'error',
				code: 'non-road-mode-without-edge',
				modeId: mode.id,
				modeCode: mode.characteristic.code,
			});
		}

		const yearBegin =
			speedYearBegin === null ? null : Math.max(speedYearBegin, edgeBounds.begin === null ? -Infinity : edgeBounds.begin);
		const yearEnd = speedYearEnd === null ? null : Math.min(speedYearEnd, edgeBounds.end === null ? Infinity : edgeBounds.end);
		if (yearBegin !== null && yearEnd !== null && yearBegin > yearEnd) {
			diagnostics.push({
				severity: 'error',
				code: 'transport-mode-empty-period',
				modeId: mode.id,
				modeCode: mode.characteristic.code,
				yearBegin,
				yearEnd,
			});
		}

		return {
			modeId: mode.id,
			modeCode: mode.characteristic.code,
			name: mode.characteristic.name,
			terrestrial,
			speedYearBegin,
			speedYearEnd,
			edgeYearBegin: edgeBounds.begin,
			edgeYearEnd: edgeBounds.end,
			yearBegin,
			yearEnd,
		};
	});
}

/**
 * Computes the global time span where the differential model is valid.
 *
 * Source:
 * - per-mode timelines;
 * - unique road-mode reference.
 *
 * Transform:
 * - non-road modes define the differential period;
 * - road availability constrains that period because road defines the cone
 *   surface used as reference.
 *
 * Units:
 * - years are dimensionless calendar years.
 *
 * Earlier equivalent:
 * - global time span aggregation.
 */
export function computePreparedTimeSpan(
	timelines: PreparedTransportModeTimeline[],
	roadReference: RoadModeReference,
	diagnostics: DatasetDiagnostic[] = []
): PreparedTimeSpan | null {
	const roadTimeline = timelines.find((timeline) => timeline.modeId === roadReference.roadModeId);
	const nonRoadTimelines = timelines.filter(
		(timeline) => timeline.modeId !== roadReference.roadModeId && timeline.yearBegin !== null && timeline.yearEnd !== null
	);

	if (!roadTimeline || roadTimeline.yearBegin === null || roadTimeline.yearEnd === null) {
		diagnostics.push({ severity: 'error', code: 'road-mode-without-valid-period', roadModeId: roadReference.roadModeId });
		return null;
	}
	if (nonRoadTimelines.length === 0) {
		diagnostics.push({ severity: 'error', code: 'time-span-without-non-road-mode' });
		return null;
	}

	let beginYear = Math.min(...nonRoadTimelines.map((timeline) => timeline.yearBegin as number));
	let endYear = Math.max(...nonRoadTimelines.map((timeline) => timeline.yearEnd as number));

	beginYear = Math.max(beginYear, roadTimeline.yearBegin);
	endYear = Math.min(endYear, roadTimeline.yearEnd);

	if (!Number.isFinite(beginYear) || !Number.isFinite(endYear) || beginYear > endYear) {
		diagnostics.push({
			severity: 'error',
			code: 'time-span-empty',
			beginYear,
			endYear,
			roadModeId: roadReference.roadModeId,
		});
		return null;
	}

	return { beginYear, endYear };
}

function interpolateSpeed(points: SpeedPoint[], year: number): number | null {
	if (points.length === 0) {
		return null;
	}
	if (points.length === 1) {
		return points[0].speedMetersPerSecond;
	}

	const first = points[0];
	const last = points[points.length - 1];
	if (year <= first.year) {
		const next = points[1];
		return linearInterpolate(first, next, year);
	}
	if (year >= last.year) {
		const previous = points[points.length - 2];
		return linearInterpolate(previous, last, year);
	}

	for (let index = 0; index < points.length - 1; index++) {
		const left = points[index];
		const right = points[index + 1];
		if (year >= left.year && year <= right.year) {
			return linearInterpolate(left, right, year);
		}
	}

	return null;
}

function linearInterpolate(left: SpeedPoint, right: SpeedPoint, year: number): number {
	if (left.year === right.year) {
		return right.speedMetersPerSecond;
	}
	const ratio = (year - left.year) / (right.year - left.year);
	return left.speedMetersPerSecond + (right.speedMetersPerSecond - left.speedMetersPerSecond) * ratio;
}

function alphaFromSpeedRatio(maxSpeed: number, speed: number): number {
	const ratio = maxSpeed / speed;
	return Math.atan(Math.sqrt(Math.max(0, ratio * ratio - 1)));
}

/**
 * Prepares yearly speed and cone-angle timelines from a lossless base network.
 *
 * Source:
 * - `transport_modes.csv`: `code`, `name`, `terrestrial`;
 * - `transport_mode_speed.csv`: `transportModeCode`, `year`, `speedKPH`;
 * - `transport_network.csv`: `transportModeCode`, `eYearBegin`, `eYearEnd`.
 *
 * Transform:
 * - identifies the unique `Road` mode;
 * - computes per-mode and global time spans;
 * - interpolates speeds for each integer year in each mode validity period;
 * - computes yearly maximum speed;
 * - computes cone slope angles from speed ratios.
 *
 * Units:
 * - reads `speedKPH` as source data;
 * - writes speeds in meters per second;
 * - writes alpha values in radians.
 *
 * Earlier equivalent:
 * - `identifyingRoadMode`;
 * - `timeSpan`;
 * - `setSpeedDatas`.
 */
export function prepareSpeedTimeline(
	baseNetwork: BaseNetwork,
	options: PrepareSpeedTimelineOptions = {}
): PreparedSpeedTimeline {
	const diagnostics: DatasetDiagnostic[] = [];
	const roadReference = identifyRoadMode(baseNetwork, options, diagnostics) ?? { roadModeId: -1, roadModeCode: Number.NaN };
	const speedPointsByMode = collectSpeedPointsByMode(baseNetwork, diagnostics);
	const timelines = computeTransportModeTimeBoundsFromSpeedPoints(baseNetwork, roadReference, speedPointsByMode, diagnostics);
	const span = computePreparedTimeSpan(timelines, roadReference, diagnostics) ?? { beginYear: 0, endYear: -1 };
	const speedByModeByYear: Record<string, Record<string, PreparedSpeedYear>> = {};
	const maxSpeedMetersPerSecondByYear: Record<string, number> = {};
	const terrestrialMinAlphaRadiansByYear: Record<string, number> = {};
	const transportTypes = { cones: [] as number[], curves: [] as number[] };

	for (const timeline of timelines) {
		transportTypes[timeline.terrestrial ? 'cones' : 'curves'].push(timeline.modeId);
		if (timeline.yearBegin === null || timeline.yearEnd === null || timeline.yearBegin > timeline.yearEnd) {
			continue;
		}
		const modeSpeeds: Record<string, PreparedSpeedYear> = {};
		const points = speedPointsByMode.get(timeline.modeId) ?? [];
		for (let year = timeline.yearBegin; year <= timeline.yearEnd; year++) {
			const speed = interpolateSpeed(points, year);
			if (speed === null || !Number.isFinite(speed)) {
				diagnostics.push({ severity: 'error', code: 'speed-interpolation-impossible', modeId: timeline.modeId, year });
				continue;
			}
			modeSpeeds[String(year)] = { speedMetersPerSecond: speed, alphaRadians: Number.NaN };
			maxSpeedMetersPerSecondByYear[year] = Math.max(maxSpeedMetersPerSecondByYear[year] ?? 0, speed);
			terrestrialMinAlphaRadiansByYear[year] ??= Infinity;
		}
		speedByModeByYear[timeline.modeCode] = modeSpeeds;
	}

	for (const timeline of timelines) {
		const modeSpeeds = speedByModeByYear[timeline.modeCode];
		if (!modeSpeeds) {
			continue;
		}
		for (const [year, speedYear] of Object.entries(modeSpeeds)) {
			const maxSpeed = maxSpeedMetersPerSecondByYear[year];
			const alphaRadians = alphaFromSpeedRatio(maxSpeed, speedYear.speedMetersPerSecond);
			if (!Number.isFinite(alphaRadians)) {
				diagnostics.push({ severity: 'error', code: 'speed-alpha-not-finite', modeId: timeline.modeId, year });
				continue;
			}
			speedYear.alphaRadians = alphaRadians;
			if (timeline.terrestrial) {
				terrestrialMinAlphaRadiansByYear[year] = Math.min(terrestrialMinAlphaRadiansByYear[year], alphaRadians);
			}
		}
	}

	return {
		roadModeId: roadReference.roadModeId,
		roadModeCode: roadReference.roadModeCode,
		span,
		modes: timelines,
		transportTypes,
		speedByModeByYear,
		maxSpeedMetersPerSecondByYear,
		terrestrialMinAlphaRadiansByYear,
		diagnostics,
	};
}
