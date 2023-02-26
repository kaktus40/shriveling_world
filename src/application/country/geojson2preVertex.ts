import { LonLatH, boundingBoxArray, lerp, meanArray } from '../common/utils';
import { CONFIGURATION } from '../common/configuration';
import type GeoJSON from 'geojson';
import { GPUComputer } from '../common/gpuComputer';
import pointInPolygonTurf from '@turf/boolean-point-in-polygon';
import { polygon as polygonTurf } from '@turf/helpers';
import type { Feature, Polygon } from 'geojson';
import boundaryAlgebre from './shaders/boundaryAlgebre.frag';
import Delaunator from 'delaunator';

export interface IMarkLimits {
	begin: number; // Inclusif
	end: number; // Exclusif
}

export interface IPreGeometry {
	vertices: Float32Array; // Cartographic.toThreeGLSL()
	extruded: IMarkLimits; // Position des extruded dans la propriété vertices
	uvs: Float32Array; // Uvs des vertices
	indexes: Uint16Array; // Index des vertices!!
	json: Feature<Polygon>;
}

const goldenRatio = (1 + Math.sqrt(5)) / 2;

/**
 *
 * @param d distance max in degrees
 * @param param1 the boundingBox [lonMin, lonMax, latMin, latMax]
 * @returns list of coordinates in degrees from Fibonacci lattice
 */
function fibonacciLattice(d: number, [lonMin, lonMax, latMin, latMax]: number[]) {
	const numPoints = Math.round((360 / d) ** 2 / Math.PI);

	const getPntLng = (idx) => (((idx / goldenRatio) * 360) % 360) - 180;
	const getPntLat = (idx) => Math.acos((2 * idx) / numPoints - 1) * CONFIGURATION.rad2deg - 90;
	const getPntIdx = (lat) => (numPoints * (Math.cos((lat + 90) * CONFIGURATION.deg2rad) + 1)) / 2;

	const pntIdxRange = [
		latMax !== undefined ? Math.ceil(getPntIdx(latMax)) : 0,
		latMin !== undefined ? Math.floor(getPntIdx(latMin)) : numPoints - 1,
	];

	let isLngInRange: (lon: number) => boolean;

	if (lonMin === undefined && lonMax === undefined) {
		isLngInRange = () => true;
	} else if (lonMin === undefined) {
		isLngInRange = (lon) => lon <= lonMax;
	} else if (lonMax === undefined) {
		isLngInRange = (lon) => lon >= lonMin;
	} else if (lonMax >= lonMin) {
		isLngInRange = (lon) => lon >= lonMin && lon <= lonMax;
	} else {
		isLngInRange = (lon) => lon >= lonMin || lon <= lonMax;
	}

	const pnts: [number, number][] = [];
	for (let i = pntIdxRange[0]; i <= pntIdxRange[1]; i++) {
		const lon = getPntLng(i);
		isLngInRange(lon) && pnts.push([lon, getPntLat(i)]);
	}

	return pnts;
}
function innerPointsGenerator(poly: Feature<Polygon>, distanceMax: number) {
	return fibonacciLattice(distanceMax, boundingBoxArray(2, ...poly.geometry.coordinates.flat(3))).filter((point) =>
		pointInPolygonTurf(point, poly)
	);
}

let u_countries = new Float32Array();
let boundariesSize: number[] = [];
let biggestSize = 0;
let boundariesTurf: Feature<Polygon>[] = [];

const _gpgpu: { [x: string]: GPUComputer } = {};
GPUComputer.GPUComputerFactory(boundaryAlgebre, { u_countries: 'RG32F', u_towns: 'RGB32F', u_countryLimits: 'R16I' }, [
	'RGBA32F',
	'RGBA32F',
]).then((instance) => {
	_gpgpu.boundaryAlgebre = instance;
});

function populateCountries() {
	u_countries = new Float32Array(biggestSize * 2 * boundariesTurf.length);
	for (let i = 0; i < boundariesTurf.length; i++) {
		const country = boundariesTurf[i].geometry.coordinates[0];
		const countryLength = country.length;
		for (let j = 0; j < countryLength; j++) {
			u_countries.set(country[j], (i * biggestSize + j) * 2);
		}
	}
}

export function townLimits(
	towns: { longitude: number; latitude: number; cityName: string }[],
	subdivision = 1
): { boundLimits: Float32Array; ECEFBoundLimits: Float32Array } {
	console.time('initialing towns limit');
	const boundariesLength = boundariesTurf.length;
	const townsLength = towns.length;
	const u_towns = new Float32Array(townsLength * 3);
	for (let i = 0; i < townsLength; i++) {
		const point = [towns[i].longitude, towns[i].latitude];
		const townName = towns[i].cityName;
		let index = -1;
		let j = 0;

		while (index === -1 && j < boundariesLength) {
			index = pointInPolygonTurf(point, boundariesTurf[j]) ? j : index;
			j++;
		}
		if (index === -1) throw new Error(townName + '_' + JSON.stringify(point) + ' not in continents ' + i);

		u_towns.set([towns[i].longitude, towns[i].latitude, index], i * 3);
	}
	console.timeEnd('initialing towns limit');
	console.time('generate towns limit');

	const gpu = _gpgpu.boundaryAlgebre;
	gpu.updateTextures({
		u_towns: { src: u_towns, width: townsLength, height: 1 },
		u_countries: { src: u_countries, width: biggestSize, height: boundariesLength },
		u_countryLimits: { src: new Int16Array(boundariesSize), width: boundariesSize.length, height: 1 },
	});
	gpu.updateUniforms({
		subdivision,
		earthRadius: CONFIGURATION.earthRadiusMeters,
	});
	const [boundLimits, ECEFBoundLimits] = gpu.calculate(subdivision * 360, townsLength);
	console.timeEnd('generate towns limit');
	return { boundLimits, ECEFBoundLimits };
}

function interpolateContourPoints(polygon: number[][], maxDistance: number) {
	let previous = polygon[0];
	let actual = polygon[1];
	const resultat = [previous];
	for (let i = 1; i < polygon.length; i++) {
		const { generator, distance } = lerp(previous, actual, false);
		if (distance > maxDistance) {
			const step = 1 / Math.ceil(distance / maxDistance);
			let t = step;
			while (t < 1) {
				resultat.push(generator(t));
				t += step;
			}
		}
		resultat.push(actual);
		previous = actual;
		actual = polygon[i];
	}
	return resultat;
}

export function generateVertices(feature: GeoJSON.Feature, discriminant: number): IPreGeometry {
	let polygon: number[][];
	switch (feature.geometry.type) {
		case 'Polygon':
			polygon = feature.geometry.coordinates[0];
			break;
		case 'MultiPolygon':
			polygon = feature.geometry.coordinates[0][0];
			break;
		default:
			polygon = [[]];
	}
	const json = polygonTurf([polygon]);

	const contour = interpolateContourPoints(polygon, discriminant);
	const innerPoints = innerPointsGenerator(json, discriminant);

	const flatVertices: number[] = [...contour.flat(), ...innerPoints.flat()];

	const triangles = new Delaunator(flatVertices).triangles;
	const indexes: number[] = [];
	for (let i = 0; i < triangles.length; i += 3) {
		const inds = Array.from(triangles.subarray(i, i + 3));
		const triangle = inds.map((t) => [flatVertices[2 * t], flatVertices[2 * t + 1]]);
		const meanPoint = meanArray(2, ...triangle.flat());
		if (pointInPolygonTurf(meanPoint, json)) {
			indexes.push(...inds);
		}
	}

	// Index n'a que la surface inférieure!
	const vertices: LonLatH[] = [];
	for (let i = 0; i < flatVertices.length; i += 2) {
		vertices.push(new LonLatH(flatVertices[i], flatVertices[i + 1], 0, false));
	}
	// Vertices n'a que la surface inférieure!
	const uvs: number[] = [];
	vertices.forEach((vertex) =>
		uvs.push(vertex.longitude * CONFIGURATION.OVER_TWO_PI + 0.5, vertex.latitude * CONFIGURATION.OVER_PI + 0.5)
	);

	const verticesPerSurfaceCount = vertices.length;
	const indexesPerSurfaceCount = indexes.length;
	// Peuplement de la seconde surface
	for (let i = 0; i < verticesPerSurfaceCount; i++) {
		const carto = vertices[i].clone();
		carto.height = CONFIGURATION.hatHeight;
		vertices.push(carto);
		uvs.push(carto.longitude * CONFIGURATION.OVER_TWO_PI + 0.5, carto.latitude * CONFIGURATION.OVER_PI + 0.5);
	}

	const lateralIndexes: number[] = [];
	let ia: number;
	let ib: number;
	let ian: number;
	let ibn: number;
	for (let i = 0; i < indexesPerSurfaceCount; i += 3) {
		indexes.push(
			indexes[i] + verticesPerSurfaceCount,
			indexes[i + 1] + verticesPerSurfaceCount,
			indexes[i + 2] + verticesPerSurfaceCount
		);
		// Triangles latéraux!
		for (let j = 0; j < 3; j++) {
			ia = indexes[i + j];
			ib = indexes[i + ((j + 1) % 3)];
			ian = indexes[i + j + indexesPerSurfaceCount];
			ibn = indexes[i + ((j + 1) % 3) + indexesPerSurfaceCount];
			lateralIndexes.push(ia, ib, ian, ib, ibn, ian);
		}
	}

	lateralIndexes.forEach((latIndex) => {
		indexes.push(latIndex);
	});
	const tempVertex: number[] = [];
	vertices.forEach((vertex) => tempVertex.push(...vertex.toGLSL()));

	const result: IPreGeometry = {
		vertices: Float32Array.from(tempVertex),
		extruded: {
			begin: verticesPerSurfaceCount * 3,
			end: verticesPerSurfaceCount * 6,
		},
		uvs: Float32Array.from(uvs),
		indexes: Uint16Array.from(indexes),
		json,
	};

	return result;
}

export function fromGeojson(geoJson: GeoJSON.FeatureCollection, discriminant = 5): IPreGeometry[] {
	let resultat: IPreGeometry[] = [];
	if (geoJson.type === 'FeatureCollection') {
		u_countries = null;
		boundariesSize = [];
		boundariesTurf = [];
		resultat = geoJson.features.map((g) => {
			const res = generateVertices(g, discriminant);
			boundariesTurf.push(res.json);
			boundariesSize.push(res.json.geometry.coordinates[0].length);
			return res;
		});
		biggestSize = Math.max(...boundariesSize);
		populateCountries();
	}
	return resultat;
}

export function setResolution(discriminant: number): IPreGeometry[] {
	return boundariesTurf.map((p) => generateVertices(p, discriminant));
}
