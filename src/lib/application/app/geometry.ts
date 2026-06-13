/**
 * Projects a city expressed in spherical coordinates to the app globe space.
 *
 * The convention stays aligned with the legacy Babylon shell:
 * - x grows toward the local east-west axis;
 * - y is flipped to preserve the historical screen-space orientation;
 * - z grows toward the local north-south vertical axis.
 */
export function projectCityToAppPoint(
	longitudeRadians: number,
	latitudeRadians: number,
	radius = 12,
): readonly [number, number, number] {
	const cLatitude = Math.cos(latitudeRadians);
	const sLatitude = Math.sin(latitudeRadians);
	const cLongitude = Math.cos(longitudeRadians);
	const sLongitude = Math.sin(longitudeRadians);

	return [cLongitude * cLatitude * radius, -sLongitude * cLatitude * radius, sLatitude * radius];
}
