import {
	EARTH_RADIUS_METERS,
	TWO_PI,
	angularDistanceRadians,
	buildNed2EcefMatrix,
	greatCircleFromBearing,
	initialBearingRadians,
	isAngleInsideContinuousInterval,
	nVectorToLonLat,
	readMatrixColumn3,
	readNVectorFromNed2Ecef,
} from '../../shared';
import type { Vec3 } from '../../shared';
import { add3, dot3, normalize3, scale3, subtract3 } from '../../shared';
import type {
	AzimuthInterval,
	BoundaryDiagnostic,
	BoundaryRaycastInput,
	BoundaryRaycastResult,
	TownBoundaryInput,
} from './types';

const EPSILON = 1e-10;

/** Builds overlapping continuous azimuth intervals centered on regular samples. */
export function buildAzimuthIntervals(sampleCount: number, halfWidthRadians = TWO_PI / sampleCount): AzimuthInterval[] {
	if (!Number.isInteger(sampleCount) || sampleCount <= 0) {
		throw new Error('azimuth sample count must be a positive integer');
	}

	const stepRadians = TWO_PI / sampleCount;
	return Array.from({ length: sampleCount }, (_, sampleIndex) => {
		const centerRadians = sampleIndex * stepRadians;
		return {
			minRadians: centerRadians - halfWidthRadians,
			maxRadians: centerRadians + halfWidthRadians,
		};
	});
}

/** Packs azimuth intervals into a stride-2 Float32Array for CPU and WGSL consumers. */
export function packAzimuthIntervals(intervals: AzimuthInterval[]): Float32Array {
	const packed = new Float32Array(intervals.length * 2);
	intervals.forEach((interval, index) => {
		packed[index * 2] = interval.minRadians;
		packed[index * 2 + 1] = interval.maxRadians;
	});
	return packed;
}

/** Builds CPU-reference NED-to-ECEF matrices for cities, preserving city order. */
export function buildCityNed2EcefMatrices(towns: TownBoundaryInput[], earthRadiusMeters = EARTH_RADIUS_METERS): Float32Array {
	const matrices = new Float32Array(towns.length * 16);
	towns.forEach((town, cityIndex) => {
		matrices.set(buildNed2EcefMatrix([town.longitudeRadians, town.latitudeRadians], earthRadiusMeters), cityIndex * 16);
	});
	return matrices;
}

function readContourNVector(buffer: Float32Array, pointIndex: number): Vec3 {
	const offset = pointIndex * 4;
	return [buffer[offset], buffer[offset + 1], buffer[offset + 2]];
}

function intersectGreatCircleWithSegment(greatCircleNormal: Vec3, segmentStart: Vec3, segmentEnd: Vec3): Vec3 | null {
	const bounds = subtract3(segmentEnd, segmentStart);
	const denominator = dot3(bounds, greatCircleNormal);
	if (Math.abs(denominator) <= EPSILON) {
		return null;
	}

	const ratio = -dot3(segmentStart, greatCircleNormal) / denominator;
	if (ratio < 0 || ratio > 1) {
		return null;
	}

	return normalize3(add3(segmentStart, scale3(bounds, ratio)));
}

function writeMiss(angular: Float32Array, ecef: Float32Array, outputIndex: number, townNVector: Vec3): void {
	const [longitude, latitude] = nVectorToLonLat(townNVector);
	const offset = outputIndex * 4;
	angular.set([longitude, latitude, -1, 0], offset);
	ecef.set([0, 0, 0, 0], offset);
}

function writeHit(
	angular: Float32Array,
	ecef: Float32Array,
	outputIndex: number,
	candidate: Vec3,
	angularDistance: number,
	earthRadiusMeters: number
): void {
	const [longitude, latitude] = nVectorToLonLat(candidate);
	const offset = outputIndex * 4;
	angular.set([longitude, latitude, angularDistance, 1], offset);
	ecef.set([candidate[0] * earthRadiusMeters, candidate[1] * earthRadiusMeters, candidate[2] * earthRadiusMeters, 1], offset);
}

function writeMissesForCity(
	angular: Float32Array,
	ecef: Float32Array,
	cityIndex: number,
	azimuthIntervalCount: number,
	townNVector: Vec3
): void {
	for (let azimuthIndex = 0; azimuthIndex < azimuthIntervalCount; azimuthIndex++) {
		writeMiss(angular, ecef, cityIndex * azimuthIntervalCount + azimuthIndex, townNVector);
	}
}

/** Computes country-boundary intersections for every city and azimuth interval on CPU. */
export function computeTownBoundaryLimitsCpu(input: BoundaryRaycastInput): BoundaryRaycastResult {
	const cityCount = input.cityNed2EcefMatrices.length / 16;
	const azimuthIntervalCount = input.azimuthIntervals.length / 2;
	const townBoundaryAngular = new Float32Array(cityCount * azimuthIntervalCount * 4);
	const townBoundaryEcef = new Float32Array(cityCount * azimuthIntervalCount * 4);
	const diagnostics: BoundaryDiagnostic[] = [];

	for (let cityIndex = 0; cityIndex < cityCount; cityIndex++) {
		const townNVector = readNVectorFromNed2Ecef(input.cityNed2EcefMatrices, cityIndex);
		const north = readMatrixColumn3(input.cityNed2EcefMatrices, cityIndex, 0);
		const east = readMatrixColumn3(input.cityNed2EcefMatrices, cityIndex, 1);
		const contourIndex = input.cityContourIndexes[cityIndex] ?? -1;

		if (contourIndex < 0 || contourIndex >= input.countryContourSizes.length) {
			diagnostics.push({ severity: 'warning', code: 'city-without-country-contour', cityIndex, contourIndex });
			writeMissesForCity(townBoundaryAngular, townBoundaryEcef, cityIndex, azimuthIntervalCount, townNVector);
			continue;
		}

		const contourOffset = input.countryContourOffsets[contourIndex];
		const contourSize = input.countryContourSizes[contourIndex];
		if (contourSize < 3) {
			diagnostics.push({ severity: 'warning', code: 'country-contour-too-small-for-raycast', cityIndex, contourIndex, contourSize });
			writeMissesForCity(townBoundaryAngular, townBoundaryEcef, cityIndex, azimuthIntervalCount, townNVector);
			continue;
		}

		for (let azimuthIndex = 0; azimuthIndex < azimuthIntervalCount; azimuthIndex++) {
			const intervalOffset = azimuthIndex * 2;
			const minRadians = input.azimuthIntervals[intervalOffset];
			const maxRadians = input.azimuthIntervals[intervalOffset + 1];
			const centerRadians = (minRadians + maxRadians) / 2;
			const greatCircleNormal = greatCircleFromBearing(townNVector, north, east, centerRadians);
			let bestCandidate: Vec3 | null = null;
			let bestDistance = Infinity;

			for (let segmentIndex = 0; segmentIndex < contourSize; segmentIndex++) {
				const start = readContourNVector(input.countryContourNVectorBuffer, contourOffset + segmentIndex);
				const end = readContourNVector(input.countryContourNVectorBuffer, contourOffset + ((segmentIndex + 1) % contourSize));
				const candidate = intersectGreatCircleWithSegment(greatCircleNormal, start, end);
				if (!candidate) {
					continue;
				}

				const candidateAzimuth = initialBearingRadians(north, east, candidate);
				if (!isAngleInsideContinuousInterval(candidateAzimuth, minRadians, maxRadians)) {
					continue;
				}

				const distance = angularDistanceRadians(candidate, townNVector);
				if (distance < bestDistance) {
					bestDistance = distance;
					bestCandidate = candidate;
				}
			}

			const outputIndex = cityIndex * azimuthIntervalCount + azimuthIndex;
			if (bestCandidate) {
				writeHit(townBoundaryAngular, townBoundaryEcef, outputIndex, bestCandidate, bestDistance, input.earthRadiusMeters);
			} else {
				writeMiss(townBoundaryAngular, townBoundaryEcef, outputIndex, townNVector);
			}
		}
	}

	return {
		townBoundaryAngular,
		townBoundaryEcef,
		azimuthIntervalCount,
		diagnostics,
	};
}
