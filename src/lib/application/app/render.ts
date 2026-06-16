import type { ComputeResult } from '$lib/compute';
import { EARTH_RADIUS_METERS } from '$lib/shared';
import { APP_GLOBE_RADIUS } from './geometry';
import { projectAppEcefPoint, projectAppGeographicPoint } from './projection';
import type { AppProjectionMode } from './page';
import type { WorkspaceCitySummary } from '$lib/application/workspace';

/** Immutable 3D point used by the Babylon scene adapters. */
export type AppPoint3 = readonly [number, number, number];

/** RGB color tuple used by the Babylon scene adapters. */
export type AppColor3 = readonly [number, number, number];

/** One polyline ready to be turned into a Babylon lines mesh. */
export interface AppPolylineDescriptor {
        readonly name: string;
        readonly bufferOffset: number;
        readonly pointCount: number;
        readonly closed?: boolean;
}

/** One business layer surfaced by the operational app renderer. */
export interface AppBusinessLayerDescriptor {
        readonly name: string;
        readonly color: AppColor3;
        readonly opacity?: number;
        readonly polylines: readonly AppPolylineDescriptor[];
}

/** One cone mesh surfaced by the operational app renderer. */
export interface AppConeMeshDescriptor {
        readonly name: string;
        readonly cityIndex: number;
        readonly cityCode: number;
        readonly color: AppColor3;
        readonly opacity?: number;
        readonly apex: AppPoint3;
        readonly bufferOffset: number;
        readonly sampleCount: number;
}

const ecefScale = APP_GLOBE_RADIUS / EARTH_RADIUS_METERS;

/** Converts one ECEF point in meters to the app globe space. */
export function ecefToAppPoint(xMeters: number, yMeters: number, zMeters: number): AppPoint3 {
        return [xMeters * ecefScale, yMeters * ecefScale, zMeters * ecefScale];
}

/** Builds the real business layers consumed by the Babylon scene. */
export function buildAppBusinessLayers(
        result: ComputeResult | null,
        projectionStart: AppProjectionMode = 'none',
        projectionEnd: AppProjectionMode = 'equirectangular',
        projectionPercent = 50,
        focusCityIndex: number | null = null,
): readonly AppBusinessLayerDescriptor[] {
        if (!result) {
                return [];
        }

        const layers: AppBusinessLayerDescriptor[] = [];

        for (const [runIndex, geojsonRun] of result.geojsonRuns.entries()) {
                const isFocused = focusCityIndex === runIndex;
                const boundaryColor: AppColor3 = isFocused ? [0.7, 0.9, 1] : [0.58, 0.8, 0.96];
                const boundaryOpacity = isFocused ? 0.86 : 0.66;
                if (geojsonRun.boundaryRaycast) {
                        layers.push({
                                name: `boundary-${runIndex}-${geojsonRun.fileName}`,
                                color: boundaryColor,
                                opacity: boundaryOpacity,
                                polylines: [{
                                        name: `boundary-${runIndex}`,
                                        bufferOffset: 0, // Need actual offset calculation
                                        pointCount: geojsonRun.boundaryRaycast.azimuthIntervalCount,
                                        closed: true
                                }],
                        });
                }
        }

        if (result.curveGeometry) {
                layers.push({
                        name: 'curve-geometry',
                        color: [0.37, 0.89, 0.65],
                        opacity: 0.72,
                        polylines: [{
                                name: 'curves',
                                bufferOffset: 0, // Need actual offset calculation
                                pointCount: result.curveGeometry.pointsPerCurve + 1,
                        }],
                });
        }

        return layers;
}

/**
 * Builds the Babylon cone-mesh descriptors from the final cone geometry.
 */
export function buildAppConeMeshDescriptors(
        result: ComputeResult | null,
        cities: readonly WorkspaceCitySummary[],
        projectionStart: AppProjectionMode = 'none',
        projectionEnd: AppProjectionMode = 'equirectangular',
        projectionPercent = 50,
        focusCityIndex: number | null = null,
        queryMatchedCityIndexes: readonly number[] = [],
): readonly AppConeMeshDescriptor[] {
        if (!result || cities.length === 0) {
                return [];
        }

        const descriptors: AppConeMeshDescriptor[] = [];
        const queryMatchedCityIndexSet = new Set(queryMatchedCityIndexes);
        for (const [runIndex, geojsonRun] of result.geojsonRuns.entries()) {
                const finalCones = geojsonRun.finalCones;
                if (!finalCones || finalCones.azimuthSampleCount <= 0) {
                        continue;
                }
                
                const cityCount = Math.min(finalCones.cityCount, cities.length);
                const sampleCount = finalCones.azimuthSampleCount;

                for (let cityIndex = 0; cityIndex < cityCount; cityIndex += 1) {
                        const city = cities[cityIndex];
                        if (!city) {
                                continue;
                        }
                        const isFocused = focusCityIndex === city.cityIndex;
                        const isMatched = queryMatchedCityIndexSet.has(city.cityIndex);
                        const coneColor: AppColor3 = isFocused
                                ? [1, 0.83, 0.36]
                                : isMatched
                                        ? [0.96, 0.73, 0.35]
                                        : [0.9, 0.7, 0.32];
                        const coneOpacity = isFocused ? 0.88 : 0.68;
                        
                        const bufferOffset = cityIndex * sampleCount * 16; 

                        descriptors.push({
                                name: `final-cones-${runIndex}-${geojsonRun.fileName}-${city.cityIndex}`,
                                cityIndex: city.cityIndex,
                                cityCode: city.cityCode,
                                color: coneColor,
                                opacity: coneOpacity,
                                apex: projectAppGeographicPoint(
                                        city.longitudeRadians,
                                        city.latitudeRadians,
                                        0,
                                        projectionStart,
                                        projectionEnd,
                                        projectionPercent,
                                ),
                                bufferOffset,
                                sampleCount,
                        });
                }
        }

        return descriptors;
}
