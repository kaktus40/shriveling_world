import { EARTH_RADIUS_METERS } from '../constants';

/** Canonical projection modes used by the project surfaces. */
export const PROJECTION_MODES = [
	'none',
	'equirectangular',
	'Mercator',
	'Winkel',
	'Eckert',
	'vanDerGrinten',
	'conicEquidistant',
] as const;

/** Canonical projection mode union used by shared math helpers. */
export type ProjectionMode = (typeof PROJECTION_MODES)[number];

/** Canonical projection settings shared by the application shell and tests. */
export interface ProjectionSettings {
	readonly globeRadius: number;
	readonly referenceLongitudeRadians: number;
	readonly referenceLatitudeRadians: number;
	readonly referenceHeightMeters: number;
	readonly standardParallel1Radians: number;
	readonly standardParallel2Radians: number;
	readonly zCoefficient: number;
}

/** Default projection settings aligned with the historical project defaults. */
export const DEFAULT_PROJECTION_SETTINGS: ProjectionSettings = {
	globeRadius: 1,
	referenceLongitudeRadians: 0,
	referenceLatitudeRadians: 0,
	referenceHeightMeters: 0,
	standardParallel1Radians: (30 * Math.PI) / 180,
	standardParallel2Radians: (45 * Math.PI) / 180,
	zCoefficient: 1,
};

/** Immutable 3D point used by the projection helpers. */
export type ProjectionPoint3 = readonly [number, number, number];

/** Transition between two projection modes. */
export interface ProjectionTransition {
	readonly start: ProjectionMode;
	readonly end: ProjectionMode;
	readonly percent: number;
	readonly settings?: ProjectionSettings;
}

/** Projects the 3D globe shell used as the historical `none` projection. */
export function projectGlobePoint(
	longitudeRadians: number,
	latitudeRadians: number,
	heightMeters: number,
	settings: ProjectionSettings,
): ProjectionPoint3 {
	const radius =
		settings.globeRadius + (heightMeters / EARTH_RADIUS_METERS) * settings.globeRadius;
	const cosLatitude = Math.cos(latitudeRadians);
	return [
		Math.cos(longitudeRadians) * cosLatitude * radius,
		-Math.sin(longitudeRadians) * cosLatitude * radius,
		Math.sin(latitudeRadians) * radius,
	];
}

/** Projects an equirectangular view. */
export function projectEquirectangularPoint(
	longitudeRadians: number,
	latitudeRadians: number,
	heightMeters: number,
	settings: ProjectionSettings,
): ProjectionPoint3 {
	return [
		(longitudeRadians - settings.referenceLongitudeRadians) *
			Math.cos(settings.referenceLatitudeRadians) *
			settings.globeRadius,
		(latitudeRadians - settings.referenceLatitudeRadians) * settings.globeRadius,
		((heightMeters - settings.referenceHeightMeters) / EARTH_RADIUS_METERS) *
			settings.globeRadius *
			settings.zCoefficient,
	];
}

/** Projects a Mercator view. */
export function projectMercatorPoint(
	longitudeRadians: number,
	latitudeRadians: number,
	heightMeters: number,
	settings: ProjectionSettings,
): ProjectionPoint3 {
	const clampedLatitude = Math.max(-1.48352986419518, Math.min(1.48352986419518, latitudeRadians));
	return [
		(longitudeRadians - settings.referenceLongitudeRadians) * settings.globeRadius,
		Math.log(Math.tan(Math.PI / 4 + clampedLatitude / 2)) * settings.globeRadius,
		((heightMeters - settings.referenceHeightMeters) / EARTH_RADIUS_METERS) *
			settings.globeRadius *
			settings.zCoefficient,
	];
}

/** Projects a Winkel Tripel view. */
export function projectWinkelTripelPoint(
	longitudeRadians: number,
	latitudeRadians: number,
	heightMeters: number,
	settings: ProjectionSettings,
): ProjectionPoint3 {
	const cosPhi = Math.cos(latitudeRadians);
	const sinPhi = Math.sin(latitudeRadians);
	const alpha = Math.acos(cosPhi * Math.cos(longitudeRadians / 2));
	const cardinalAlpha = Math.abs(alpha) < 1e-7 ? 1 : Math.sin(alpha) / alpha;
	return [
		(((longitudeRadians - settings.referenceLongitudeRadians) *
			Math.cos(settings.referenceLatitudeRadians)) +
			(2 * cosPhi * Math.sin(longitudeRadians / 2)) / cardinalAlpha) *
			(settings.globeRadius / 2),
		((latitudeRadians - settings.referenceLatitudeRadians) + sinPhi / cardinalAlpha) *
			(settings.globeRadius / 2),
		((heightMeters - settings.referenceHeightMeters) / EARTH_RADIUS_METERS) *
			settings.globeRadius *
			settings.zCoefficient,
	];
}

/** Projects an Eckert VI view. */
export function projectEckertVIPoint(
	longitudeRadians: number,
	latitudeRadians: number,
	heightMeters: number,
	settings: ProjectionSettings,
): ProjectionPoint3 {
	const eckertDeltaConst = 2.57079632679489661923;
	const eckertConst = 2.26750802723822639138;
	let theta = settings.referenceLatitudeRadians;
	for (let iteration = 0; iteration < 40; iteration += 1) {
		const denominator = 1 + Math.cos(theta);
		theta -=
			(theta + Math.sin(theta) - eckertDeltaConst * Math.sin(latitudeRadians)) /
			(denominator === 0 ? 1 : denominator);
	}
	return [
		((longitudeRadians - settings.referenceLongitudeRadians) * (1 + Math.cos(theta)) * settings.globeRadius) /
			eckertConst,
		(2 * theta * settings.globeRadius) / eckertConst,
		((heightMeters - settings.referenceHeightMeters) / EARTH_RADIUS_METERS) *
			settings.globeRadius *
			settings.zCoefficient,
	];
}

/** Projects a van der Grinten I view. */
export function projectVanDerGrintenIPoint(
	longitudeRadians: number,
	latitudeRadians: number,
	heightMeters: number,
	settings: ProjectionSettings,
): ProjectionPoint3 {
	const pi = Math.PI;
	const safeLatitude = Math.max(-1.5707963267948966, Math.min(1.5707963267948966, latitudeRadians));
	const theta = Math.asin(Math.abs((2 * safeLatitude) / pi));
	let x = 0;
	let y = 0;
	if (
		Math.abs(longitudeRadians - settings.referenceLongitudeRadians) < 1e-6 ||
		Math.abs(theta - pi / 2) < 1e-6
	) {
		y = Math.sign(safeLatitude) * pi * settings.globeRadius * Math.tan(theta / 2);
	} else if (Math.abs(safeLatitude) < 1e-6) {
		x = (longitudeRadians - settings.referenceLongitudeRadians) * settings.globeRadius;
	} else {
		const delta = longitudeRadians - settings.referenceLongitudeRadians;
		const A = 0.5 * Math.abs(pi / delta - delta / pi);
		const sinTheta = Math.sin(theta);
		const cosTheta = Math.cos(theta);
		const G = cosTheta / (sinTheta + cosTheta - 1);
		const P = G * (2 / sinTheta - 1);
		const Q = A * A + G;
		const A2 = A * A;
		const P2 = P * P;
		const denominateur = P2 + A2;
		x =
			(Math.sign(delta) * pi * settings.globeRadius) / denominateur *
			(A * (G - P2) +
				Math.sqrt(Math.max(0, (A * (G - P2)) ** 2 - (P2 + A2) * (G * G - P2))));
		y =
			(Math.sign(safeLatitude) * pi * settings.globeRadius) / denominateur *
			Math.abs(P * Q - A * Math.sqrt(Math.max(0, (A2 + 1) * denominateur - Q * Q)));
	}
	return [
		x,
		y,
		((heightMeters - settings.referenceHeightMeters) / EARTH_RADIUS_METERS) *
			settings.globeRadius *
			settings.zCoefficient,
	];
}

/** Projects a conic equidistant view. */
export function projectConicEquidistantPoint(
	longitudeRadians: number,
	latitudeRadians: number,
	heightMeters: number,
	settings: ProjectionSettings,
): ProjectionPoint3 {
	const n =
		(Math.cos(settings.standardParallel1Radians) - Math.cos(settings.standardParallel2Radians)) /
		(settings.standardParallel2Radians - settings.standardParallel1Radians || 1);
	const G = Math.cos(settings.standardParallel1Radians) / n + settings.standardParallel1Radians;
	const rho0 = G - settings.referenceLatitudeRadians;
	const theta = n * (longitudeRadians - settings.referenceLongitudeRadians);
	const rho = G - latitudeRadians;
	return [
		rho * Math.sin(theta) * settings.globeRadius,
		(rho0 - rho * Math.cos(theta)) * settings.globeRadius,
		((heightMeters - settings.referenceHeightMeters) / EARTH_RADIUS_METERS) *
			settings.globeRadius *
			settings.zCoefficient,
	];
}

/** Projects one ECEF point through the shared cartographic projection transition. */
export function projectEcefPoint(
	xMeters: number,
	yMeters: number,
	zMeters: number,
	transition: ProjectionTransition,
): ProjectionPoint3 {
	const settings = transition.settings ?? DEFAULT_PROJECTION_SETTINGS;
	const radius = Math.sqrt(xMeters * xMeters + yMeters * yMeters + zMeters * zMeters);
	if (radius <= 0) {
		return projectGeographicPoint(0, 0, 0, transition, settings);
	}
	const longitude = Math.atan2(yMeters, xMeters);
	const latitude = Math.asin(Math.max(-1, Math.min(1, zMeters / radius)));
	const heightMeters = radius - EARTH_RADIUS_METERS;
	return projectGeographicPoint(longitude, latitude, heightMeters, transition, settings);
}

/** Projects one geographic point through the shared cartographic projection transition. */
export function projectGeographicPoint(
	longitudeRadians: number,
	latitudeRadians: number,
	heightMeters: number,
	transition: ProjectionTransition,
	settings: ProjectionSettings = DEFAULT_PROJECTION_SETTINGS,
): ProjectionPoint3 {
	const startPoint = projectProjectionModePoint(
		longitudeRadians,
		latitudeRadians,
		heightMeters,
		transition.start,
		settings,
	);
	if (transition.start === transition.end) {
		return startPoint;
	}
	const endPoint = projectProjectionModePoint(
		longitudeRadians,
		latitudeRadians,
		heightMeters,
		transition.end,
		settings,
	);
	return blendProjectionPoints(startPoint, endPoint, transition.percent);
}

/** Projects one point to a single projection mode. */
export function projectProjectionModePoint(
	longitudeRadians: number,
	latitudeRadians: number,
	heightMeters: number,
	projectionMode: ProjectionMode,
	settings: ProjectionSettings = DEFAULT_PROJECTION_SETTINGS,
): ProjectionPoint3 {
	switch (projectionMode) {
		case 'equirectangular':
			return projectEquirectangularPoint(longitudeRadians, latitudeRadians, heightMeters, settings);
		case 'Mercator':
			return projectMercatorPoint(longitudeRadians, latitudeRadians, heightMeters, settings);
		case 'Winkel':
			return projectWinkelTripelPoint(longitudeRadians, latitudeRadians, heightMeters, settings);
		case 'Eckert':
			return projectEckertVIPoint(longitudeRadians, latitudeRadians, heightMeters, settings);
		case 'vanDerGrinten':
			return projectVanDerGrintenIPoint(longitudeRadians, latitudeRadians, heightMeters, settings);
		case 'conicEquidistant':
			return projectConicEquidistantPoint(longitudeRadians, latitudeRadians, heightMeters, settings);
		case 'none':
		default:
			return projectGlobePoint(longitudeRadians, latitudeRadians, heightMeters, settings);
	}
}

/** Converts a projection mode to a dense shader-friendly index. */
export function projectionModeToIndex(projectionMode: ProjectionMode): number {
	switch (projectionMode) {
		case 'none':
			return 0;
		case 'equirectangular':
			return 1;
		case 'Mercator':
			return 2;
		case 'Winkel':
			return 3;
		case 'Eckert':
			return 4;
		case 'vanDerGrinten':
			return 5;
		case 'conicEquidistant':
			return 6;
	}
}

/** Blends two projection results using the provided percentage. */
export function blendProjectionPoints(
	startPoint: ProjectionPoint3,
	endPoint: ProjectionPoint3,
	percent: number,
): ProjectionPoint3 {
	const blend = Math.min(1, Math.max(0, percent / 100));
	return [
		startPoint[0] + (endPoint[0] - startPoint[0]) * blend,
		startPoint[1] + (endPoint[1] - startPoint[1]) * blend,
		startPoint[2] + (endPoint[2] - startPoint[2]) * blend,
	];
}
