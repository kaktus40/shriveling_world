import type { ComputeResult } from '$lib/compute';
import { EARTH_RADIUS_METERS } from '$lib/shared';
import { APP_GLOBE_RADIUS } from './geometry';

/** Immutable 3D point used by the Babylon scene adapters. */
export type AppPoint3 = readonly [number, number, number];

/** RGB color tuple used by the Babylon scene adapters. */
export type AppColor3 = readonly [number, number, number];

/** One polyline ready to be turned into a Babylon lines mesh. */
export interface AppPolylineDescriptor {
	readonly points: readonly AppPoint3[];
	readonly closed?: boolean;
}

/** One business layer surfaced by the operational app renderer. */
export interface AppBusinessLayerDescriptor {
	readonly name: string;
	readonly color: AppColor3;
	readonly polylines: readonly AppPolylineDescriptor[];
}

const ecefScale = APP_GLOBE_RADIUS / EARTH_RADIUS_METERS;

/** Converts one ECEF point in meters to the app globe space. */
export function ecefToAppPoint(xMeters: number, yMeters: number, zMeters: number): AppPoint3 {
	return [xMeters * ecefScale, yMeters * ecefScale, zMeters * ecefScale];
}

/** Builds the real business layers consumed by the Babylon scene. */
export function buildAppBusinessLayers(result: ComputeResult | null): readonly AppBusinessLayerDescriptor[] {
	if (!result) {
		return [];
	}

	const layers: AppBusinessLayerDescriptor[] = [];

	for (const [runIndex, geojsonRun] of result.geojsonRuns.entries()) {
		if (geojsonRun.boundaryRaycast) {
			layers.push({
				name: `boundary-${runIndex}-${geojsonRun.fileName}`,
				color: [0.58, 0.8, 0.96],
				polylines: buildCityPolylinesFromVec4Buffer(
					geojsonRun.boundaryRaycast.townBoundaryEcef,
					geojsonRun.boundaryRaycast.azimuthIntervalCount,
					true,
				),
			});
		}

		if (geojsonRun.finalCones) {
			layers.push({
				name: `final-cones-${runIndex}-${geojsonRun.fileName}`,
				color: [0.96, 0.73, 0.35],
				polylines: buildCityPolylinesFromVec4Buffer(
					geojsonRun.finalCones.finalConeGeometryEcef,
					geojsonRun.finalCones.azimuthSampleCount,
					true,
				),
			});
		}
	}

	if (result.curveGeometry) {
		layers.push({
			name: 'curve-geometry',
			color: [0.37, 0.89, 0.65],
			polylines: buildCurvePolylines(result.curveGeometry.positions, result.curveGeometry.curveCount, result.curveGeometry.pointsPerCurve),
		});
	}

	return layers;
}

function buildCityPolylinesFromVec4Buffer(
	buffer: Float32Array,
	sampleCount: number,
	closed: boolean,
): AppPolylineDescriptor[] {
	if (sampleCount <= 0 || buffer.length === 0) {
		return [];
	}

	const stride = 4;
	const groupCount = Math.floor(buffer.length / (sampleCount * stride));
	const polylines: AppPolylineDescriptor[] = [];

	for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
		const points: AppPoint3[] = [];
		for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
			const offset = (groupIndex * sampleCount + sampleIndex) * stride;
			points.push(ecefToAppPoint(buffer[offset], buffer[offset + 1], buffer[offset + 2]));
		}
		if (closed && points.length > 0) {
			points.push(points[0]);
		}
		polylines.push({ points, closed });
	}

	return polylines;
}

function buildCurvePolylines(
	buffer: Float32Array,
	curveCount: number,
	pointsPerCurve: number,
): AppPolylineDescriptor[] {
	if (curveCount <= 0 || pointsPerCurve < 0 || buffer.length === 0) {
		return [];
	}

	const stride = 4;
	const pointsPerPolyline = pointsPerCurve + 1;
	const polylines: AppPolylineDescriptor[] = [];

	for (let curveIndex = 0; curveIndex < curveCount; curveIndex += 1) {
		const points: AppPoint3[] = [];
		for (let sampleIndex = 0; sampleIndex < pointsPerPolyline; sampleIndex += 1) {
			const offset = (curveIndex * pointsPerPolyline + sampleIndex) * stride;
			points.push(ecefToAppPoint(buffer[offset], buffer[offset + 1], buffer[offset + 2]));
		}
		polylines.push({ points });
	}

	return polylines;
}
