import type GeoJSON from 'geojson';
import {
	buildAzimuthIntervals,
	buildCityNed2EcefMatrices,
	computeTownBoundaryLimitsCpu,
	packAzimuthIntervals,
	prepareBoundaryPrecompute,
	type BoundaryDiagnostic,
	type BoundaryPrecompute,
	type BoundaryPrecomputeOptions,
	type BoundaryRaycastResult,
	type TownBoundaryInput,
} from '../../domain/geojson';
import type { PreparedDataset, SourceFile, InspectedDatasetFile } from '../../domain/data';
import { EARTH_RADIUS_METERS } from '../../shared';
import type { ComputeOptions, StageTiming } from '../core';
import { measureStage } from '../core/timing';

interface CpuBoundarySource {
	fileName: string;
	geojson: GeoJSON.FeatureCollection;
}

/** One CPU reference GeoJSON boundary stage result. */
export interface CpuBoundaryRun {
	fileName: string;
	geojson: GeoJSON.FeatureCollection;
	boundaryPrecompute: BoundaryPrecompute;
	boundaryRaycast: BoundaryRaycastResult;
	precomputeTiming: StageTiming;
	raycastTiming: StageTiming;
	diagnostics: BoundaryDiagnostic[];
}

/**
 * Runs the CPU boundary precompute and raycast stages for every GeoJSON source
 * belonging to a workspace snapshot.
 */
export function runCpuBoundaryStages(
	sourceFiles: readonly SourceFile[],
	inspectedFiles: readonly InspectedDatasetFile[],
	preparedDataset: PreparedDataset,
	options: ComputeOptions,
	overrideSources?: readonly CpuBoundarySource[],
): CpuBoundaryRun[] {
	return resolveCpuGeojsonSources(sourceFiles, inspectedFiles, overrideSources).map((source) =>
		runCpuBoundaryStage(source, preparedDataset, options),
	);
}

function runCpuBoundaryStage(
	source: CpuBoundarySource,
	preparedDataset: PreparedDataset,
	options: ComputeOptions,
): CpuBoundaryRun {
	const diagnostics: BoundaryDiagnostic[] = [];
	const townInputs = buildCpuTownBoundaryInputs(preparedDataset);
	const boundaryOptions: Partial<BoundaryPrecomputeOptions> = {
		azimuthSampleCount: options.boundaryRaycast?.azimuthSampleCount ?? 360,
		...options.boundaryPrecompute,
	};
	const precomputeTimed = measureStage('geojson-boundary-precompute', 'precompute', 'cpu', () =>
		prepareBoundaryPrecompute(source.geojson, townInputs, boundaryOptions),
	);
	diagnostics.push(...precomputeTimed.value.diagnostics);

	const raycastTimed = measureStage('geojson-boundary-raycast', 'precompute', 'cpu', () =>
		computeTownBoundaryLimitsCpu({
			cityNed2EcefMatrices: buildCityNed2EcefMatrices(townInputs, EARTH_RADIUS_METERS),
			cityContourIndexes: precomputeTimed.value.cityContourIndexes,
			countryContourNVectorBuffer: precomputeTimed.value.countryContourNVectorBuffer,
			countryContourOffsets: precomputeTimed.value.countryContourOffsets,
			countryContourSizes: precomputeTimed.value.countryContourSizes,
			azimuthIntervals: packAzimuthIntervals(buildAzimuthIntervals(precomputeTimed.value.azimuthSampleCount)),
			earthRadiusMeters: EARTH_RADIUS_METERS,
		}),
	);
	diagnostics.push(...raycastTimed.value.diagnostics);

	return {
		fileName: source.fileName,
		geojson: source.geojson,
		boundaryPrecompute: precomputeTimed.value,
		boundaryRaycast: raycastTimed.value,
		precomputeTiming: precomputeTimed.timing,
		raycastTiming: raycastTimed.timing,
		diagnostics,
	};
}

function resolveCpuGeojsonSources(
	sourceFiles: readonly SourceFile[],
	inspectedFiles: readonly InspectedDatasetFile[],
	overrideSources?: readonly CpuBoundarySource[],
): CpuBoundarySource[] {
	if (overrideSources && overrideSources.length > 0) {
		return [...overrideSources];
	}

	const sourceFilesByName = new Map(sourceFiles.map((file) => [file.name, file]));
	return inspectedFiles
		.filter((file) => file.kind === 'geojson')
		.map((file) => {
			const sourceFile = sourceFilesByName.get(file.originalName);
			if (!sourceFile) {
				throw new Error(`Missing GeoJSON source file: ${file.originalName}`);
			}
			return {
				fileName: file.originalName,
				geojson: JSON.parse(sourceFile.text) as GeoJSON.FeatureCollection,
			};
		});
}

function buildCpuTownBoundaryInputs(preparedDataset: PreparedDataset): TownBoundaryInput[] {
	return Array.from({ length: preparedDataset.cityCount }, (_, cityIndex) => ({
		cityId: preparedDataset.cityIds[cityIndex],
		cityCode: preparedDataset.cityCodes[cityIndex],
		longitudeRadians: preparedDataset.cityLonLatRadians[cityIndex * 2],
		latitudeRadians: preparedDataset.cityLonLatRadians[cityIndex * 2 + 1],
	}));
}
