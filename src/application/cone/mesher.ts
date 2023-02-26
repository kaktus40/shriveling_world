import { CONFIGURATION } from '../common/configuration';
import { GPUComputer } from '../common/gpuComputer';
import type { IMergerData } from '../merger';
import rawConesFrag from './shaders/rawCones.frag';
import ciseledConesFrag from './shaders/ciseledCones.frag';
import finalizedConesFrag from './shaders/finalCones.frag';

let mergerData: IMergerData = {};
let available = false;
/**
 * use dynamicTownData  and staticTownData to generate local vertices of intersected cones in ECEF referentials
 */
let ciseledCones = new Float32Array();
/**
 * design the limit of towns from geojson (see townLimits function)
 */
//TODO changer cartographic pour ECEF?
let townECEFBoundaries = new Float32Array();
/**
 * use ciseledCones and dynamicTownData to generate intersection with townBoundaries to generates the definitives vertex of cones in ECEF
 */
let finalizedCones = new Float32Array();
let citiesNumber = 0;
let limits = new Int8Array();
let indexDatas = new Uint16Array();
let vertexNb = 0;

const callBackFunctions: ((
	finalCones: Float32Array,
	citiesNumber: number,
	vertexNb: number,
	indexData: Uint16Array
) => void)[] = [];

const _gpgpu: { [x: string]: GPUComputer } = {};
GPUComputer.GPUComputerFactory(
	rawConesFrag,
	{
		summitECEF: 'RGB32F',
		u_ned2ECEF0s: 'RGB32F',
		u_ned2ECEF1s: 'RGB32F',
		u_ned2ECEF2s: 'RGB32F',
		u_city_dict: 'RG16I',
		u_city_links: 'RGB32F',
	},
	['RGBA32F']
).then((instance) => {
	_gpgpu.rawCones = instance;
});

GPUComputer.GPUComputerFactory(
	ciseledConesFrag,
	{
		u_rawCones: 'RGBA32F',
		u_townOverLaps: 'RGB32F',
	},
	['RGBA32F']
).then((instance) => {
	_gpgpu.ciseledCones = instance;
});

GPUComputer.GPUComputerFactory(
	finalizedConesFrag,
	{
		u_townsBoundaries: 'RGBA32F',
		u_AcceptLimits: 'R16I',
		u_ciseledCones: 'RGBA32F',
	},
	['RGBA32F']
).then((instance) => {
	_gpgpu.finalizedCones = instance;
});

function generateCiseledCones() {
	const year = CONFIGURATION.year;
	if (year >= mergerData.span.begin && year <= mergerData.span.end) {
		const dataYear = mergerData.dynamicTownData[year];

		const options = {
			u_city_dict: { src: dataYear.citiesDict, width: 1, height: citiesNumber },
			u_city_links: { src: dataYear.cityLinks, width: 1, height: citiesNumber },
		};
		_gpgpu.rawCones.updateTextures(options);

		const uniforms: { [x: string]: number | ArrayBufferView } = {};
		uniforms.longueurMaxi = CONFIGURATION.extrudedHeight;
		uniforms.earthRadius = CONFIGURATION.earthRadiusMeters;
		uniforms.attenuation = 5 * CONFIGURATION.deg2rad;
		uniforms.roadAlpha = dataYear.roadAlpha;
		_gpgpu.rawCones.updateUniforms(uniforms);
		// cones non intersectés
		const [rawCones] = _gpgpu.rawCones.calculate(citiesNumber, 361);

		const options2 = {
			u_rawCones: { src: rawCones, width: citiesNumber, height: 361 },
		};
		_gpgpu.ciseledCones.updateTextures(options2);
		// cones intersectés
		[ciseledCones] = _gpgpu.ciseledCones.calculate(citiesNumber, 361);
		generateFinalCones();
	}
}

function generateFinalCones() {
	const options = {
		u_ciseledCones: { src: ciseledCones, width: citiesNumber, height: 361 },
		u_AcceptLimits: { src: limits, width: 1, height: citiesNumber },
	};
	_gpgpu.finalizedCones.updateTextures(options);
	[finalizedCones] = _gpgpu.finalizedCones.calculate(citiesNumber, 361);
	generateDisplayedCones();
}

function generateDisplayedCones() {
	//TODO

	const convertedDatas = new Float32Array(); // sortie de calculs
	callBackFunctions.forEach((fun) => fun(convertedDatas, citiesNumber, vertexNb, indexDatas));
}

function isReady() {
	available = townECEFBoundaries.length > 0 && citiesNumber > 0;
}

function generateIndexes() {
	const index: number[] = [];
	let ia: number;
	let ib: number;

	vertexNb = 361;
	for (let i = 0; i < 360; i++) {
		ia = i;
		ib = (ia + 1) % (vertexNb - 1);
		index.push(ia, ib, vertexNb - 1);
	}
	indexDatas = new Uint16Array(index);
}

export function setTownECEFBoundaries(_townBoundaries: Float32Array) {
	townECEFBoundaries = _townBoundaries;
	const options = {
		u_townsBoundaries: { src: townECEFBoundaries, width: 360, height: citiesNumber },
	};
	_gpgpu.finalizedCones.updateTextures(options);
	isReady();
	if (available) {
		generateFinalCones();
	}
}

export function setDatas(_mergerData: IMergerData) {
	mergerData = _mergerData;
	citiesNumber = mergerData.cities.length;
	const summits: number[] = [];
	const ned2ECEF0: number[] = [];
	const ned2ECEF1: number[] = [];
	const ned2ECEF2: number[] = [];
	mergerData.staticTownData.citiesGlslDatas.forEach((cityData) => {
		summits.push(...cityData.summit);
		ned2ECEF0.push(...cityData.ned2ECEF0);
		ned2ECEF1.push(...cityData.ned2ECEF1);
		ned2ECEF2.push(...cityData.ned2ECEF2);
	});

	const options = {
		summitECEF: { src: new Float32Array(summits), width: 1, height: citiesNumber },
		u_ned2ECEF0s: { src: new Float32Array(ned2ECEF0), width: 1, height: citiesNumber },
		u_ned2ECEF1s: { src: new Float32Array(ned2ECEF1), width: 1, height: citiesNumber },
		u_ned2ECEF2s: { src: new Float32Array(ned2ECEF2), width: 1, height: citiesNumber },
	};
	_gpgpu.rawCones.updateTextures(options);

	const options2 = {
		u_townOverLaps: {
			src: mergerData.staticTownData.townOverlaps,
			width: mergerData.staticTownData.neighboorLimit,
			height: citiesNumber,
		},
	};
	_gpgpu.ciseledCones.updateTextures(options2);
	_gpgpu.ciseledCones.updateUniforms({ neighboorLimit: mergerData.staticTownData.neighboorLimit });
	generateIndexes();
	limits = new Int8Array(citiesNumber);
	isReady();
	if (available) {
		generateCiseledCones();
	}
}

export function setLimits(...lims: { position: number; state: boolean }[]) {
	if (available) {
		lims.forEach((item) => {
			if (item.position < citiesNumber) {
				limits[item.position] = item.state ? 1 : 0;
			}
		});
		generateFinalCones();
	}
}
export function setAllLimits(state: boolean) {
	limits.fill(state ? 1 : 0);
	if (available) {
		generateFinalCones();
	}
}
export function AddcallBack(
	fun: (finalCones: Float32Array, citiesNumber: number, vertexNb: number, indexData: Uint16Array) => void
) {
	callBackFunctions.push(fun);
}
