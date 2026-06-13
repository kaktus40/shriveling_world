import { strict as assert } from 'node:assert';
import { describe, test } from 'vitest';
import { EARTH_RADIUS_METERS } from '$lib/shared';
import {
	APP_DEFAULT_PROJECTION_SETTINGS,
	mixAppProjectionPoints,
	projectAppEcefPoint,
	projectAppGeographicPoint,
	projectAppLonLatPoint,
} from '$lib/application/app/projection';
import { APP_GLOBE_RADIUS } from '$lib/application/app/geometry';

function approxEqual(actual: number, expected: number, epsilon = 1e-9): void {
	assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

describe('app projection helpers', () => {
	test('project the globe like the legacy 3D shell', () => {
		const origin = projectAppLonLatPoint(0, 0, 0, 'none');
		const quarterTurn = projectAppLonLatPoint(Math.PI / 2, 0, 0, 'none');
		approxEqual(origin[0], APP_GLOBE_RADIUS);
		approxEqual(origin[1], 0);
		approxEqual(origin[2], 0);
		approxEqual(quarterTurn[0], 0);
		approxEqual(quarterTurn[1], -APP_GLOBE_RADIUS);
		approxEqual(quarterTurn[2], 0);
	});

	test('project equirectangular coordinates with the historical defaults', () => {
		const projected = projectAppLonLatPoint(1, 0.5, 100, 'equirectangular', APP_DEFAULT_PROJECTION_SETTINGS);
		approxEqual(projected[0], APP_GLOBE_RADIUS);
		approxEqual(projected[1], 0.5 * APP_GLOBE_RADIUS);
		approxEqual(projected[2], (100 / EARTH_RADIUS_METERS) * APP_GLOBE_RADIUS);
	});

	test('project Mercator coordinates with the historical clamp', () => {
		const latitude = 0.5;
		const projected = projectAppLonLatPoint(0.75, latitude, 0, 'Mercator');
		approxEqual(projected[0], 0.75 * APP_GLOBE_RADIUS);
		approxEqual(projected[1], Math.log(Math.tan(Math.PI / 4 + latitude / 2)) * APP_GLOBE_RADIUS);
	});

	test('project Winkel Tripel coordinates with the historical formula', () => {
		const longitude = 0.4;
		const latitude = 0.3;
		const projected = projectAppLonLatPoint(longitude, latitude, 0, 'Winkel');
		const cosPhi = Math.cos(latitude);
		const sinPhi = Math.sin(latitude);
		const alpha = Math.acos(cosPhi * Math.cos(longitude / 2));
		const cardinalAlpha = Math.abs(alpha) < 1e-7 ? 1 : Math.sin(alpha) / alpha;
		approxEqual(
			projected[0],
			(((longitude - APP_DEFAULT_PROJECTION_SETTINGS.referenceLongitudeRadians) *
				Math.cos(APP_DEFAULT_PROJECTION_SETTINGS.referenceLatitudeRadians)) +
				(2 * cosPhi * Math.sin(longitude / 2)) / cardinalAlpha) *
				(APP_GLOBE_RADIUS / 2),
		);
		approxEqual(
			projected[1],
			((latitude - APP_DEFAULT_PROJECTION_SETTINGS.referenceLatitudeRadians) + sinPhi / cardinalAlpha) *
				(APP_GLOBE_RADIUS / 2),
		);
	});

	test('project Eckert VI coordinates with the historical solver', () => {
		const longitude = 0.4;
		const latitude = 0.3;
		const projected = projectAppLonLatPoint(longitude, latitude, 0, 'Eckert');
		const eckertDeltaConst = 2.57079632679489661923;
		const eckertConst = 2.26750802723822639138;
		let theta = APP_DEFAULT_PROJECTION_SETTINGS.referenceLatitudeRadians;
		for (let iteration = 0; iteration < 40; iteration += 1) {
			const denominator = 1 + Math.cos(theta);
			theta -=
				(theta + Math.sin(theta) - eckertDeltaConst * Math.sin(latitude)) /
				(denominator === 0 ? 1 : denominator);
		}
		approxEqual(
			projected[0],
			((longitude - APP_DEFAULT_PROJECTION_SETTINGS.referenceLongitudeRadians) * (1 + Math.cos(theta)) * APP_GLOBE_RADIUS) /
				eckertConst,
		);
		approxEqual(projected[1], (2 * theta * APP_GLOBE_RADIUS) / eckertConst);
	});

	test('project van der Grinten I coordinates with the historical formula', () => {
		const longitude = 0.7;
		const latitude = 0.25;
		const projected = projectAppLonLatPoint(longitude, latitude, 0, 'vanDerGrinten');
		const pi = Math.PI;
		const theta = Math.asin(Math.abs((2 * latitude) / pi));
		const delta = longitude - APP_DEFAULT_PROJECTION_SETTINGS.referenceLongitudeRadians;
		const A = 0.5 * Math.abs(pi / delta - delta / pi);
		const sinTheta = Math.sin(theta);
		const cosTheta = Math.cos(theta);
		const G = cosTheta / (sinTheta + cosTheta - 1);
		const P = G * (2 / sinTheta - 1);
		const Q = A * A + G;
		const A2 = A * A;
		const P2 = P * P;
		const denominateur = P2 + A2;
		const expectedX =
			(Math.sign(delta) * pi * APP_GLOBE_RADIUS) / denominateur *
			(A * (G - P2) + Math.sqrt(Math.max(0, (A * (G - P2)) ** 2 - (P2 + A2) * (G * G - P2))));
		const expectedY =
			(Math.sign(latitude) * pi * APP_GLOBE_RADIUS) / denominateur *
			Math.abs(P * Q - A * Math.sqrt(Math.max(0, (A2 + 1) * denominateur - Q * Q)));
		approxEqual(projected[0], expectedX);
		approxEqual(projected[1], expectedY);
	});

	test('project conic equidistant coordinates with the historical formula', () => {
		const longitude = 0.2;
		const latitude = 0.15;
		const projected = projectAppLonLatPoint(longitude, latitude, 0, 'conicEquidistant');
		const settings = APP_DEFAULT_PROJECTION_SETTINGS;
		const n =
			(Math.cos(settings.standardParallel1Radians) - Math.cos(settings.standardParallel2Radians)) /
			(settings.standardParallel2Radians - settings.standardParallel1Radians || 1);
		const G = Math.cos(settings.standardParallel1Radians) / n + settings.standardParallel1Radians;
		const rho0 = G - settings.referenceLatitudeRadians;
		const theta = n * (longitude - settings.referenceLongitudeRadians);
		const rho = G - latitude;
		approxEqual(projected[0], rho * Math.sin(theta) * APP_GLOBE_RADIUS);
		approxEqual(projected[1], (rho0 - rho * Math.cos(theta)) * APP_GLOBE_RADIUS);
	});

	test('project geographic points by blending the two selected projections', () => {
		const startPoint = projectAppLonLatPoint(Math.PI / 2, 0, 0, 'none');
		const endPoint = projectAppLonLatPoint(Math.PI / 2, 0, 0, 'equirectangular');
		const blended = projectAppGeographicPoint(Math.PI / 2, 0, 0, 'none', 'equirectangular', 50);
		assert.deepEqual(blended, mixAppProjectionPoints(startPoint, endPoint, 50));
	});

	test('project ECEF points through the same geographic projection pipeline', () => {
		const projected = projectAppEcefPoint(0, EARTH_RADIUS_METERS, 0, 'none', 'none', 0);
		assert.deepEqual(projected, projectAppLonLatPoint(Math.PI / 2, 0, 0, 'none'));
	});
});
