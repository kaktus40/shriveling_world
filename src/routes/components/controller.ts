import {
	townLimits,
	fromGeojson,
	generateVertices,
	IPreGeometry,
	setResolution,
} from '../../application/country/geojson2preVertex';
import { polygon as polygonTurf } from '@turf/helpers';

import {
	Scene,
	Vector3,
	Mesh,
	MeshBuilder,
	Color3,
	VertexData,
	DynamicTexture,
	Material,
	ActionManager,
	StandardMaterial,
	ExecuteCodeAction,
} from '@babylonjs/core';
import { CustomMaterial } from '@babylonjs/materials';
import type { Feature, Polygon } from 'geojson';
import { Fill, Stroke, Style, Text } from 'ol/style';
import type { Vector as VectorSource } from 'ol/source';
import OlFeature from 'ol/Feature';
import { Polygon as OlPolygon, Point as OlPoint } from 'ol/geom';

import GeoJSON from 'ol/format/GeoJSON';

let townBillBoardDict: {
	[name: string]: {
		bill: Mesh;
		poly?: Mesh;
		data: Feature<Polygon>;
		name: string;
		olCityPoint: OlFeature<OlPoint>;
		olPoly?: OlFeature<OlPolygon>;
		raw: Float32Array;
	};
} = {};
let townResolution = 1;
let countryResolution = 1;

let billboardActionManager: ActionManager;

let scene: Scene;
let earthMaterial: StandardMaterial;
let debugMaterial: StandardMaterial;

let countryCollection: Mesh[] = [];
let townLims: Float32Array;
let selectedTown: string;
const deg2rad = Math.PI / 180;
const privateContext = document.createElement('canvas').getContext('2d');
const geoJsonReader = new GeoJSON();
let vectorSource: VectorSource;
let myCities: { longitude: number; latitude: number; cityName: string }[] = [];

const polygonStyle = new Style({
	stroke: new Stroke({
		color: 'magenta',
		width: 3,
	}),
	fill: new Fill({
		color: 'rgba(255,0,255,0.3)',
	}),
});
const emptyStyle = new Style();

const labelStyle = new Style({
	text: new Text({
		font: '10px Calibri,sans-serif',
		fill: new Fill({
			color: 'red',
		}),
		stroke: new Stroke({
			color: '#fff',
			width: 4,
		}),
	}),
});

const townStyleFunction = function (feature: OlFeature<OlPoint>): Style {
	labelStyle.getText().setText(` ${feature.get('id')}`);
	if (feature.get('selected')) {
		labelStyle.getText().setFont('15px Calibri,sans-serif');
		labelStyle.getText().getFill().setColor('green');
	} else {
		labelStyle.getText().setFont('10px Calibri,sans-serif');
		labelStyle.getText().getFill().setColor('red');
	}
	return labelStyle;
};

const polygonStyleFunction = function (feature: OlFeature<OlPolygon>): Style {
	return feature.get('visible') ? polygonStyle : emptyStyle;
};

export function initOl(source: VectorSource) {
	vectorSource = source;
}

export function initBabylon(sc: Scene, ea: StandardMaterial, deb: StandardMaterial) {
	scene = sc;
	earthMaterial = ea;
	debugMaterial = deb;
	billboardActionManager = new ActionManager();
	billboardActionManager.registerAction(
		new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, (evt) => {
			evt.meshUnderPointer.scaling.x = 1.4;
			evt.meshUnderPointer.scaling.y = 1.4;
			evt.meshUnderPointer.scaling.z = 1.4;
		})
	);
	billboardActionManager.registerAction(
		new ExecuteCodeAction(ActionManager.OnPointerOutTrigger, (evt) => {
			evt.meshUnderPointer.scaling.x = 1;
			evt.meshUnderPointer.scaling.y = 1;
			evt.meshUnderPointer.scaling.z = 1;
		})
	);
	billboardActionManager.registerAction(
		new ExecuteCodeAction(ActionManager.OnPickTrigger, (evt) => {
			activateTown(evt.meshUnderPointer?.name);
		})
	);
}

function makeTextPlane(text: string, color: string, size: number) {
	//Set font
	const font_size = 20;
	const font = 'bold ' + font_size + 'px Arial';

	//Set height for dynamic texture
	const DTHeight = font_size; //or set as wished

	privateContext.font = font;
	const DTWidth = privateContext.measureText(text).width + 8;
	//Calculate width the plane has to be

	const dynamicTexture = new DynamicTexture('DynamicTexture', { width: DTWidth, height: DTHeight }, scene, false);
	dynamicTexture.hasAlpha = true;
	dynamicTexture.drawText(text, null, null, font, color, 'white', true);

	const plane = MeshBuilder.CreatePlane(text, { size, updatable: true }, scene);
	plane.material = new CustomMaterial('TextPlaneMaterial', scene);
	(plane.material as CustomMaterial).backFaceCulling = false;
	(plane.material as CustomMaterial).specularColor = Color3.Black();
	(plane.material as CustomMaterial).diffuseTexture = dynamicTexture;
	(plane.material as CustomMaterial).alpha = 0.0;
	(plane.material as CustomMaterial).Fragment_Custom_Alpha(`
        float myAlpha = 1.0;
        if (baseColor.r == 1.0 && baseColor.g == 1.0 && baseColor.b == 1.0)
            myAlpha = 0.0;
        result = myAlpha;
    `);
	return plane;
}

function geo2cartesian([lambda, phi, altitude = 0]: number[], isRadians = true) {
	const resultat: number[] = [];
	if (!isRadians) {
		lambda *= deg2rad;
		phi *= deg2rad;
	}
	const radius = ((6371e3 + altitude) / 6371e3) * 10;
	const cPhi = Math.cos(phi);
	const sPhi = Math.sin(phi);
	const cLambda = Math.cos(lambda);
	const sLambda = Math.sin(lambda);
	resultat.push(cLambda * cPhi * radius, -sLambda * cPhi * radius, sPhi * radius);
	return resultat;
}

function pregeo2Mesh(pre: IPreGeometry, material: Material, name: string, extruded = false): Mesh {
	const vertices = pre.vertices;
	const indices = pre.indexes;
	const uvs = pre.uvs;
	const positions: number[] = [];
	for (let i = 0; i < vertices.length; i += 3) {
		const geo = Array.from(vertices.subarray(i, i + 3));
		if (extruded && pre.extruded.begin < i) {
			geo[2] = 1000000;
		}
		positions.push(...geo2cartesian(geo));
	}
	const normals = [];
	VertexData.ComputeNormals(vertices, indices, normals);
	const vertexData = new VertexData();

	vertexData.positions = positions;
	vertexData.indices = indices;
	vertexData.normals = normals;
	vertexData.uvs = uvs;
	const customMesh = new Mesh(name, scene);
	customMesh.material = material;
	vertexData.applyToMesh(customMesh);
	return customMesh;
}

function json2Mesh(data: Feature<Polygon>, resolution: number, material: Material, name: string, extruded: boolean) {
	const tmp = generateVertices(data, resolution);
	return pregeo2Mesh(tmp, material, name, extruded);
}

export function showGeojson(gg: GeoJSON.FeatureCollection) {
	countryCollection.forEach((m) => {
		m.dispose();
		m = null;
	});
	countryCollection = [];
	const t0 = performance.now();
	fromGeojson(gg, countryResolution).forEach((pre, j) => {
		countryCollection.push(pregeo2Mesh(pre, earthMaterial, 'custom ' + j));
	});
	const t1 = performance.now();
	console.log(`geojson: ${t1 - t0} millisecondes`);
}

export function updateCountryResolution(res: number) {
	countryResolution = res;
	countryCollection.forEach((m) => {
		m.dispose();
		m = null;
	});
	countryCollection = [];
	const t0 = performance.now();
	setResolution(countryResolution).forEach((pre, j) => {
		countryCollection.push(pregeo2Mesh(pre, earthMaterial, 'custom ' + j));
	});
	const t1 = performance.now();
	console.log(`geojson: ${t1 - t0} millisecondes`);
	countryResolution = res;
}
export function generateTowns(cities: { longitude: number; latitude: number; cityName: string }[]) {
	const t0 = performance.now();
	myCities = cities;
	for (const name in townBillBoardDict) {
		const index = townBillBoardDict[name];
		index.bill.dispose();
		index.bill = null;
		if (index.hasOwnProperty('poly')) {
			index.poly.dispose();
			index.poly = null;
		}
	}
	vectorSource.clear();
	townBillBoardDict = {};

	({ boundLimits: townLims } = townLimits(cities, townResolution));
	cities.forEach((city, order) => {
		const townGeo = [city.longitude * deg2rad, city.latitude * deg2rad, 100000];
		const townCart = new Vector3(...geo2cartesian(townGeo));
		const bill = makeTextPlane(city.cityName, 'red', 0.3);
		bill.position = townCart;
		bill.billboardMode = Mesh.BILLBOARDMODE_ALL;
		bill.actionManager = billboardActionManager;
		const begin2 = order * 360 * townResolution * 4;
		const prepoly: number[][] = [];

		for (let i = 0; i < 360 * townResolution; i++) {
			const sub0 = townLims.subarray(begin2 + i * 4, begin2 + i * 4 + 4);
			prepoly.push([sub0[0], sub0[1]]);
		}

		const raw = townLims.subarray(begin2, begin2 + 360 * townResolution * 4);
		prepoly.push(prepoly[0]);
		const turfPol = polygonTurf([prepoly]);
		const olCityPoint = new OlFeature({
			geometry: new OlPoint([city.longitude, city.latitude]),
			id: city.cityName,
			selected: false,
		});
		olCityPoint.setStyle(townStyleFunction);
		vectorSource.addFeature(olCityPoint);
		townBillBoardDict[city.cityName] = {
			bill,
			data: turfPol,
			name: city.cityName,
			olCityPoint,
			raw,
		};
	});

	const t1 = performance.now();
	console.log(`townlimits: ${t1 - t0} millisecondes`);
}

export function updateTownResolution(res: number) {
	townResolution = res;
	if (myCities.length > 0) generateTowns(myCities);
	activateTown();
}

export function activateTown(newName?: string) {
	const oldTowny = townBillBoardDict[selectedTown];
	if (oldTowny?.poly) {
		oldTowny.poly.isVisible = false;
		oldTowny.olPoly.set('visible', false);
		oldTowny.olCityPoint.set('selected', false);
		oldTowny.olCityPoint.setStyle(townStyleFunction);
		oldTowny.olPoly.setStyle(polygonStyleFunction);
	}
	selectedTown = newName ? newName : selectedTown;
	const towny = townBillBoardDict[selectedTown];
	if (towny) {
		if (towny.poly) {
			towny.poly.isVisible = true;
			towny.olCityPoint.set('selected', true);
			towny.olPoly.set('visible', true);
		} else {
			towny.poly = json2Mesh(towny.data, townResolution, debugMaterial, towny.name + ' poly', true);
			towny.olPoly = geoJsonReader.readFeature(towny.data) as OlFeature<OlPolygon>;
			towny.olCityPoint.set('selected', true);
			towny.olPoly.set('id', towny.name + ' poly');
			towny.olPoly.set('visible', true);
			vectorSource.addFeature(towny.olPoly);
		}
		towny.olCityPoint.setStyle(townStyleFunction);
		towny.olPoly.setStyle(polygonStyleFunction);
		const tab = towny.raw;
		let good = true;
		for (let i = 0; i < tab.length; i += 4) {
			if (tab[i + 2] < 6) {
				// console.log(i / 4, tab[i], tab[i + 1], tab[i + 2], tab[i + 3]);
				good = false;
			}
		}
		if (good) console.log('all is good');
	}
}

export function activateFeature(feature: OlFeature) {
	if (feature.getGeometry().getType() === 'Point') {
		activateTown(feature.get('id'));
	}
}
