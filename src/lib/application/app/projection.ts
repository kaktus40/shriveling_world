import {
	blendProjectionPoints,
	DEFAULT_PROJECTION_SETTINGS,
	projectEcefPoint,
	projectGeographicPoint,
	projectProjectionModePoint,
	type ProjectionPoint3,
	type ProjectionSettings,
} from '$lib/shared/math';
import { APP_GLOBE_RADIUS } from './geometry';
import type { AppProjectionMode } from './page';

/** Default projection settings aligned with the historical project defaults. */
export const APP_DEFAULT_PROJECTION_SETTINGS: ProjectionSettings = {
	...DEFAULT_PROJECTION_SETTINGS,
	globeRadius: APP_GLOBE_RADIUS,
};

/**
 * Projects one geographic point expressed as longitude/latitude/height to the
 * Babylon application space.
 *
 * The `none` projection keeps the globe-like 3D projection. Other modes
 * reproduce the historical cartographic projections used by the legacy scene.
 */
export function projectAppLonLatPoint(
	longitudeRadians: number,
	latitudeRadians: number,
	heightMeters = 0,
	projectionMode: AppProjectionMode,
	settings: ProjectionSettings = APP_DEFAULT_PROJECTION_SETTINGS,
): ProjectionPoint3 {
	return projectProjectionModePoint(longitudeRadians, latitudeRadians, heightMeters, projectionMode, settings);
}

/**
 * Projects one geographic point and blends the selected start/end projections.
 */
export function projectAppGeographicPoint(
	longitudeRadians: number,
	latitudeRadians: number,
	heightMeters: number,
	projectionStart: AppProjectionMode,
	projectionEnd: AppProjectionMode,
	projectionPercent: number,
	settings: ProjectionSettings = APP_DEFAULT_PROJECTION_SETTINGS,
): ProjectionPoint3 {
	return projectGeographicPoint(
		longitudeRadians,
		latitudeRadians,
		heightMeters,
		{
			start: projectionStart,
			end: projectionEnd,
			percent: projectionPercent,
			settings,
		},
		settings,
	);
}

/**
 * Projects one ECEF point in meters to the Babylon application space.
 */
export function projectAppEcefPoint(
	xMeters: number,
	yMeters: number,
	zMeters: number,
	projectionStart: AppProjectionMode,
	projectionEnd: AppProjectionMode,
	projectionPercent: number,
	settings: ProjectionSettings = APP_DEFAULT_PROJECTION_SETTINGS,
): ProjectionPoint3 {
	return projectEcefPoint(xMeters, yMeters, zMeters, {
		start: projectionStart,
		end: projectionEnd,
		percent: projectionPercent,
		settings,
	});
}

/** Keeps the historical blend helper name used by the app tests and adapters. */
export function mixAppProjectionPoints(
	startPoint: ProjectionPoint3,
	endPoint: ProjectionPoint3,
	percent: number,
): ProjectionPoint3 {
	return blendProjectionPoints(startPoint, endPoint, percent);
}
