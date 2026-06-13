import { projectCityToAppPoint } from './geometry';
import type { AppPageState } from './page';
import {
	angleAtVertex3,
	angleBetween3,
	buildEarthCenterPlaneFrame,
	type AppMeasurementPlaneFrame,
	type AppMeasurementVector3,
} from './measurement-geometry';
import type { WorkspaceCitySummary } from '$lib/application/workspace';

/** Measure point slot used by the application tools. */
export type AppMeasurementSlot = 'a' | 'b' | 'c';

/** Mutable-like selection kept by the application route. */
export interface AppMeasurementSelection {
	readonly pointAIndex: number | null;
	readonly pointBIndex: number | null;
	readonly pointCIndex: number | null;
	readonly focusCityIndex: number | null;
	readonly localRotationDegrees: number;
}

/** One selected city exposed in the measurement summary. */
export interface AppMeasurementCitySummary {
	readonly slot: AppMeasurementSlot;
	readonly city: WorkspaceCitySummary;
	readonly point: AppMeasurementVector3;
}

/** Measurement viewport state shared by the scene and the overlay. */
export interface AppMeasurementSummary {
	readonly selectedCities: readonly AppMeasurementCitySummary[];
	readonly centralAngleDegrees: number | null;
	readonly angleAtBDegrees: number | null;
	readonly planeFrame: AppMeasurementPlaneFrame | null;
	readonly focusCityIndex: number | null;
	readonly localRotationDegrees: number;
}

/** Returns the default selection used when the app loads a dataset. */
export function createDefaultAppMeasurementSelection(selectedCityIndex: number): AppMeasurementSelection {
	return {
		pointAIndex: selectedCityIndex,
		pointBIndex: null,
		pointCIndex: null,
		focusCityIndex: selectedCityIndex,
		localRotationDegrees: 0,
	};
}

/** Assigns one city index to the requested measurement slot. */
export function setAppMeasurementSlot(
	selection: AppMeasurementSelection,
	slot: AppMeasurementSlot,
	cityIndex: number | null,
): AppMeasurementSelection {
	switch (slot) {
		case 'a':
			return { ...selection, pointAIndex: cityIndex };
		case 'b':
			return { ...selection, pointBIndex: cityIndex };
		case 'c':
		default:
			return { ...selection, pointCIndex: cityIndex };
	}
}

/** Resets the measurement selection to the current city focus. */
export function resetAppMeasurementSelection(selectedCityIndex: number): AppMeasurementSelection {
	return createDefaultAppMeasurementSelection(selectedCityIndex);
}

/** Replaces the local-rotation angle used by the measurement camera helper. */
export function setAppMeasurementLocalRotation(
	selection: AppMeasurementSelection,
	localRotationDegrees: number,
): AppMeasurementSelection {
	return { ...selection, localRotationDegrees };
}

/** Replaces the focused city used by the measurement camera helper. */
export function setAppMeasurementFocusCity(
	selection: AppMeasurementSelection,
	focusCityIndex: number | null,
): AppMeasurementSelection {
	return { ...selection, focusCityIndex };
}

/** Builds the angle summary and the small measurement viewport model. */
export function buildAppMeasurementSummary(
	appState: AppPageState | null,
	selection: AppMeasurementSelection,
): AppMeasurementSummary {
	if (!appState) {
		return {
			selectedCities: [],
			centralAngleDegrees: null,
			angleAtBDegrees: null,
			planeFrame: null,
			focusCityIndex: selection.focusCityIndex,
			localRotationDegrees: selection.localRotationDegrees,
		};
	}

	const selectedCities = buildSelectedCities(appState.cities, selection);
	const pointA = selectedCities.find((entry) => entry.slot === 'a')?.point ?? null;
	const pointB = selectedCities.find((entry) => entry.slot === 'b')?.point ?? null;
	const pointC = selectedCities.find((entry) => entry.slot === 'c')?.point ?? null;
	const angleAtBDegrees = pointA && pointB && pointC ? radiansToDegrees(angleAtVertex3(pointA, pointB, pointC)) : null;
	const centralAngleDegrees = pointA && pointB ? radiansToDegrees(angleBetween3(pointA, pointB)) : null;
	const planeFrame = pointA && pointB
		? buildEarthCenterPlaneFrame([
				{ label: 'A', cityIndex: selectedCities.find((entry) => entry.slot === 'a')?.city.cityIndex ?? null, point: pointA },
				{ label: 'B', cityIndex: selectedCities.find((entry) => entry.slot === 'b')?.city.cityIndex ?? null, point: pointB },
				...(pointC
					? [
							{
								label: 'C',
								cityIndex: selectedCities.find((entry) => entry.slot === 'c')?.city.cityIndex ?? null,
								point: pointC,
							},
						]
					: []),
			])
		: null;

	return {
		selectedCities,
		centralAngleDegrees,
		angleAtBDegrees,
		planeFrame,
		focusCityIndex: selection.focusCityIndex,
		localRotationDegrees: selection.localRotationDegrees,
	};
}

function buildSelectedCities(
	cities: readonly WorkspaceCitySummary[],
	selection: AppMeasurementSelection,
): AppMeasurementCitySummary[] {
	const resolved: AppMeasurementCitySummary[] = [];
	const entries: Array<[AppMeasurementSlot, number | null]> = [
		['a', selection.pointAIndex],
		['b', selection.pointBIndex],
		['c', selection.pointCIndex],
	];

	for (const [slot, cityIndex] of entries) {
		if (cityIndex == null) {
			continue;
		}
		const city = cities.find((candidate) => candidate.cityIndex === cityIndex);
		if (!city) {
			continue;
		}
		resolved.push({
			slot,
			city,
			point: projectCityToAppPoint(city.longitudeRadians, city.latitudeRadians),
		});
	}

	return resolved;
}

function radiansToDegrees(radians: number | null): number | null {
	return radians == null ? null : (radians * 180) / Math.PI;
}
