import assert from 'node:assert/strict';
import { test } from 'vitest';

import { buildAppMeasurementSummary, createDefaultAppMeasurementSelection, resetAppMeasurementSelection, setAppMeasurementFocusCity, setAppMeasurementLocalRotation, setAppMeasurementSlot } from '$lib/application/app/measurement';
import type { AppPageState } from '$lib/application/app';

function buildAppState(): AppPageState {
	return {
		workspace: null as unknown as AppPageState['workspace'],
		summary: null as unknown as AppPageState['summary'],
		cities: [
			{ cityIndex: 0, cityId: 10, cityCode: 100, cityLabel: 'Alpha', longitudeRadians: 0, latitudeRadians: 0, linkedRecordCount: 0, inEdgeCount: 0, outEdgeCount: 0 },
			{ cityIndex: 1, cityId: 11, cityCode: 101, cityLabel: 'Beta', longitudeRadians: Math.PI / 2, latitudeRadians: 0, linkedRecordCount: 0, inEdgeCount: 0, outEdgeCount: 0 },
			{ cityIndex: 2, cityId: 12, cityCode: 102, cityLabel: 'Gamma', longitudeRadians: 0, latitudeRadians: Math.PI / 2, linkedRecordCount: 0, inEdgeCount: 0, outEdgeCount: 0 },
		],
		yearOptions: [2000],
		querySnapshot: null as unknown as AppPageState['querySnapshot'],
		selection: {
			datasetName: 'fixture',
			year: 2000,
			cityIndex: 0,
			cameraMode: 'orbit',
			computeProfile: 'cpu',
			projectionStart: 'none',
			projectionEnd: 'equirectangular',
			projectionPercent: 50,
			showCityLabels: false,
		},
	};
}

test('measurement selection helpers keep the current city focus and slots', () => {
	const base = createDefaultAppMeasurementSelection(1);
	const withB = setAppMeasurementSlot(base, 'b', 2);
	const withFocus = setAppMeasurementFocusCity(withB, 0);
	const withRotation = setAppMeasurementLocalRotation(withFocus, 45);
	const reset = resetAppMeasurementSelection(2);

	assert.equal(withRotation.pointAIndex, 1);
	assert.equal(withRotation.pointBIndex, 2);
	assert.equal(withRotation.focusCityIndex, 0);
	assert.equal(withRotation.localRotationDegrees, 45);
	assert.equal(reset.pointAIndex, 2);
	assert.equal(reset.focusCityIndex, 2);
});

test('measurement summary exposes the earth-center plane and a central angle', () => {
	const summary = buildAppMeasurementSummary(buildAppState(), {
		pointAIndex: 0,
		pointBIndex: 1,
		pointCIndex: null,
		focusCityIndex: 1,
		localRotationDegrees: 30,
	});

	assert.equal(summary.centralAngleDegrees?.toFixed(0), '90');
	assert.equal(summary.angleAtBDegrees, null);
	assert.equal(summary.planeFrame?.points.length, 3);
	assert.equal(summary.planeFrame?.points[0].label, 'O');
	assert.equal(summary.focusCityIndex, 1);
	assert.equal(summary.localRotationDegrees, 30);
});
