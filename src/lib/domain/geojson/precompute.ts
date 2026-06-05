import Delaunator from 'delaunator';
import type GeoJSON from 'geojson';
import { lonLatToNVector } from '../../shared';
import {
	degreesToRadians,
	densifyRing,
	generateInteriorPoints,
	openRing,
	pointInRing,
	triangleCentroid,
} from './geometry';
import type {
	BoundaryDiagnostic,
	BoundaryPrecompute,
	BoundaryPrecomputeOptions,
	CountryContour,
	CountryRenderPreGeometry,
	LonLatRadians,
	TownBoundaryInput,
	TownCountryAssociation,
} from './types';

const DEFAULT_OPTIONS: BoundaryPrecomputeOptions = {
	contourMaxSegmentRadians: degreesToRadians(5),
	interiorPointSpacingRadians: degreesToRadians(5),
	azimuthSampleCount: 360,
	countryExtrusionHeightMeters: 0,
};

function normalizeOptions(options: Partial<BoundaryPrecomputeOptions> = {}): BoundaryPrecomputeOptions {
	return {
		...DEFAULT_OPTIONS,
		...options,
	};
}

function toLonLatRing(positions: GeoJSON.Position[]): LonLatRadians[] {
	return positions
		.filter((position) => Number.isFinite(position[0]) && Number.isFinite(position[1]))
		.map((position) => [degreesToRadians(position[0]), degreesToRadians(position[1])]);
}

function extractFeatureContours(feature: GeoJSON.Feature, featureIndex: number, diagnostics: BoundaryDiagnostic[]): CountryContour[] {
	const geometry = feature.geometry;
	if (!geometry) {
		diagnostics.push({ severity: 'warning', code: 'geojson-feature-without-geometry', featureIndex });
		return [];
	}

	const contours: CountryContour[] = [];
	if (geometry.type === 'Polygon') {
		const ring = openRing(toLonLatRing(geometry.coordinates[0]));
		if (ring.length >= 3) {
			contours.push({ featureIndex, contourIndex: 0, properties: feature.properties, ring });
		}
	} else if (geometry.type === 'MultiPolygon') {
		geometry.coordinates.forEach((polygon, contourIndex) => {
			const ring = openRing(toLonLatRing(polygon[0]));
			if (ring.length >= 3) {
				contours.push({ featureIndex, contourIndex, properties: feature.properties, ring });
			}
		});
	} else {
		diagnostics.push({
			severity: 'warning',
			code: 'unsupported-geojson-geometry',
			featureIndex,
			geometryType: geometry.type,
		});
	}

	return contours;
}

/** Extracts external first-level contours from a GeoJSON feature collection. */
export function extractCountryContours(
	geojson: GeoJSON.FeatureCollection,
	diagnostics: BoundaryDiagnostic[] = []
): CountryContour[] {
	if (geojson.type !== 'FeatureCollection') {
		diagnostics.push({ severity: 'error', code: 'geojson-not-feature-collection' });
		return [];
	}

	return geojson.features.flatMap((feature, featureIndex) => extractFeatureContours(feature, featureIndex, diagnostics));
}

/** Builds one renderable country mesh using a densified contour and Fibonacci interior points. */
export function generateCountryGeometry(
	contour: CountryContour,
	options: BoundaryPrecomputeOptions,
	diagnostics: BoundaryDiagnostic[] = []
): CountryRenderPreGeometry {
	const densifiedContour = densifyRing(contour.ring, options.contourMaxSegmentRadians);
	const interiorPoints = generateInteriorPoints(densifiedContour, options.interiorPointSpacingRadians);
	const triangulationPoints = [...densifiedContour, ...interiorPoints];
	const coords = Float64Array.from(triangulationPoints.flat());
	const triangles = new Delaunator(coords).triangles;
	const indexes: number[] = [];

	for (let triangleIndex = 0; triangleIndex < triangles.length; triangleIndex += 3) {
		const indexA = triangles[triangleIndex];
		const indexB = triangles[triangleIndex + 1];
		const indexC = triangles[triangleIndex + 2];
		const centroid = triangleCentroid(triangulationPoints, indexA, indexB, indexC);
		if (pointInRing(centroid, densifiedContour)) {
			indexes.push(indexA, indexB, indexC);
		}
	}

	if (indexes.length === 0) {
		diagnostics.push({
			severity: 'warning',
			code: 'country-contour-without-triangles',
			featureIndex: contour.featureIndex,
			contourIndex: contour.contourIndex,
		});
	}

	const bottomVertexCount = triangulationPoints.length;
	const vertices: number[] = [];
	const uvs: number[] = [];

	for (const [longitude, latitude] of triangulationPoints) {
		vertices.push(longitude, latitude, 0);
		uvs.push(longitude / (2 * Math.PI) + 0.5, latitude / Math.PI + 0.5);
	}

	for (const [longitude, latitude] of triangulationPoints) {
		vertices.push(longitude, latitude, options.countryExtrusionHeightMeters);
		uvs.push(longitude / (2 * Math.PI) + 0.5, latitude / Math.PI + 0.5);
	}

	const bottomTriangleIndexCount = indexes.length;
	for (let index = 0; index < bottomTriangleIndexCount; index += 3) {
		indexes.push(indexes[index] + bottomVertexCount, indexes[index + 1] + bottomVertexCount, indexes[index + 2] + bottomVertexCount);
	}

	// Lateral faces are built only from the external contour. Interior Fibonacci
	// points improve surface triangulation but must not create side walls.
	for (let index = 0; index < densifiedContour.length; index++) {
		const nextIndex = (index + 1) % densifiedContour.length;
		const topIndex = index + bottomVertexCount;
		const nextTopIndex = nextIndex + bottomVertexCount;
		indexes.push(index, nextIndex, topIndex, nextIndex, nextTopIndex, topIndex);
	}

	return {
		sourceFeatureId: contour.featureIndex,
		sourceContourId: contour.contourIndex,
		vertices: Float32Array.from(vertices),
		uvs: Float32Array.from(uvs),
		indexes: Uint32Array.from(indexes),
		extruded: {
			begin: bottomVertexCount * 3,
			end: bottomVertexCount * 6,
		},
		bottomVertexCount,
	};
}

function buildContourBuffers(contours: CountryContour[]): {
	buffer: Float32Array;
	nVectorBuffer: Float32Array;
	offsets: Int32Array;
	sizes: Int32Array;
} {
	const totalPointCount = contours.reduce((sum, contour) => sum + contour.ring.length, 0);
	const buffer = new Float32Array(totalPointCount * 2);
	const nVectorBuffer = new Float32Array(totalPointCount * 4);
	const offsets = new Int32Array(contours.length);
	const sizes = new Int32Array(contours.length);
	let pointOffset = 0;
	let coordinateOffset = 0;

	contours.forEach((contour, contourIndex) => {
		offsets[contourIndex] = pointOffset;
		sizes[contourIndex] = contour.ring.length;
		contour.ring.forEach(([longitude, latitude]) => {
			const [x, y, z] = lonLatToNVector([longitude, latitude]);
			buffer[coordinateOffset++] = longitude;
			buffer[coordinateOffset++] = latitude;
			nVectorBuffer[pointOffset * 4] = x;
			nVectorBuffer[pointOffset * 4 + 1] = y;
			nVectorBuffer[pointOffset * 4 + 2] = z;
			nVectorBuffer[pointOffset * 4 + 3] = 0;
			pointOffset++;
		});
	});

	return { buffer, nVectorBuffer, offsets, sizes };
}

function buildDensifiedContourBuffers(
	contours: CountryContour[],
	options: BoundaryPrecomputeOptions
): {
	buffer: Float32Array;
	nVectorBuffer: Float32Array;
	offsets: Int32Array;
	sizes: Int32Array;
} {
	return buildContourBuffers(
		contours.map((contour) => ({
			...contour,
			ring: densifyRing(contour.ring, options.contourMaxSegmentRadians),
		}))
	);
}

/** Associates each prepared town with the first retained country contour containing it. */
export function associateTownsToContours(
	towns: TownBoundaryInput[],
	contours: CountryContour[],
	diagnostics: BoundaryDiagnostic[] = []
): { indexes: Int32Array; cityIndexes: Int32Array; associations: TownCountryAssociation[] } {
	const maxCityId = towns.reduce((max, town) => Math.max(max, town.cityId), -1);
	const indexes = new Int32Array(maxCityId + 1);
	const cityIndexes = new Int32Array(towns.length);
	indexes.fill(-1);
	cityIndexes.fill(-1);
	const associations: TownCountryAssociation[] = [];

	towns.forEach((town, cityIndex) => {
		const point: LonLatRadians = [town.longitudeRadians, town.latitudeRadians];
		const contourIndex = contours.findIndex((contour) => pointInRing(point, contour.ring));
		if (contourIndex === -1) {
			diagnostics.push({
				severity: 'warning',
				code: 'town-outside-country-contours',
				cityId: town.cityId,
				cityCode: town.cityCode,
				cityName: town.cityName,
				longitudeRadians: town.longitudeRadians,
				latitudeRadians: town.latitudeRadians,
			});
		}
		indexes[town.cityId] = contourIndex;
		cityIndexes[cityIndex] = contourIndex;
		associations.push({
			cityId: town.cityId,
			cityCode: town.cityCode,
			countryContourId: contourIndex,
		});
	});

	return { indexes, cityIndexes, associations };
}

/** Prepares GeoJSON country meshes and town-to-contour associations. */
export function prepareBoundaryPrecompute(
	geojson: GeoJSON.FeatureCollection,
	towns: TownBoundaryInput[],
	options: Partial<BoundaryPrecomputeOptions> = {}
): BoundaryPrecompute {
	const normalizedOptions = normalizeOptions(options);
	const diagnostics: BoundaryDiagnostic[] = [];
	const contours = extractCountryContours(geojson, diagnostics);
	const countryGeometries = contours.map((contour) => generateCountryGeometry(contour, normalizedOptions, diagnostics));
	const {
		buffer: countryContourBuffer,
		nVectorBuffer: countryContourNVectorBuffer,
		offsets: countryContourOffsets,
		sizes: countryContourSizes,
	} = buildDensifiedContourBuffers(contours, normalizedOptions);
	const {
		indexes: townCountryIndexes,
		cityIndexes: cityContourIndexes,
		associations: townCountryAssociations,
	} = associateTownsToContours(
		towns,
		contours,
		diagnostics
	);

	return {
		contours,
		countryGeometries,
		countryContourBuffer,
		countryContourNVectorBuffer,
		countryContourOffsets,
		countryContourSizes,
		cityContourIndexes,
		townCountryIndexes,
		townCountryAssociations,
		azimuthSampleCount: normalizedOptions.azimuthSampleCount,
		diagnostics,
	};
}
