import { CONFIGURATION } from '../common/configuration';
import { NEDLocal } from '../common/referential';
import { LonLatH } from '../common/utils';
import type { IMergerData, IDynamicTownPreGeometry } from '.';
import cityFrag from './shaders/city.frag';
import { GPUComputer } from '../common/gpuComputer';

const _gpgpu: { [x: string]: GPUComputer } = {};
GPUComputer.GPUComputerFactory(cityFrag, { u_towns: 'RG32F' }, ['RGBA32F', 'RGBA32F', 'RGBA32F']).then(
	(instance) => (_gpgpu.cities = instance)
);

export function prepareStaticTownGeometry(datas: IMergerData, nbSector = 6) {
	const cities = datas.cities;

	const lengthTown = cities.length;
	const u_towns = new Float32Array(lengthTown * 2);
	const cityMap: Map<number, number> = new Map(); // à retourner
	console.time('ned');
	const citiesGlslDatas = cities.map((city, i) => {
		const position = new LonLatH(city.longitude, city.latitude, 0, false);
		u_towns.set([position.longitude, position.latitude], i * 2);
		if (cityMap.has(city.cityCode)) {
			throw Error('same cityCode:' + city.cityCode);
		}
		cityMap.set(city.cityCode, i);
		const ned = new NEDLocal(position);
		return ned.glslDatas;
	});
	console.timeEnd('ned');
	console.time('gpu');
	_gpgpu.cities.updateTextures({
		u_towns: {
			src: u_towns,
			height: 1,
			width: lengthTown,
		},
	});
	console.timeEnd('gpu');
	// outputs[0] = azimut-distance-midpoint of town A (abscisses) to town B (ordonnées)
	// outputs[1] = point P - point Q  of town A (abscisses) to town B (ordonnées)
	// outputs[2] = vecteur unitaire de A vers B dans NED de A +elevation  from town A (abscisses) to town B (ordonnées)
	const outputs = _gpgpu.cities.calculate(lengthTown, lengthTown); // à retourner
	const neighboorLimit = Math.min(lengthTown - 1, 100); // à retourner

	// recherche des neighboorLimit (ici 100) villes les plus proches répartis sur 10 secteurs angulaires de 36°
	// pour construire floatarray qui représente en tableau en deux dimensions (dim 1 = num ordre ville,dim 2 correspond au numéro d'ordre de la k-ième ville la plus proche de dim 1 (sur neighboorLimit). Les éléments représentés sont les suivants : pour une ville A en entrée, on a une des neighboorLimit villes les plus proches nommée B avec la structure suivante { num ordre ville B, azimut ville A vers ville B, azimut ville B vers ville A}
	const townOverlaps = new Float32Array(lengthTown * 3 * neighboorLimit); // à retourner
	const sectorAngle = 360 / nbSector;
	for (let i = 0; i < lengthTown; i++) {
		interface Itmp {
			az: number;
			townBOrder: number;
			townBAz: number;
			distance: number;
		}
		const temp: Itmp[][] = new Array(nbSector);
		for (let w = 0; w < nbSector; w++) {
			temp[w] = [];
		}
		for (let j = 0; j < lengthTown; j++) {
			if (i !== j) {
				const pos = i * 4 + j * 4 * lengthTown;
				const az = outputs[0][pos];
				const distance = outputs[0][pos + 1];
				const townBAz = outputs[0][j * 4 + i * 4 * lengthTown];
				const sector = Math.trunc((az * CONFIGURATION.rad2deg) / sectorAngle);
				temp[sector].push({ az, distance, townBAz, townBOrder: j });
			}
		}
		// des secteurs peuvent être insuffisamment alimentés! => rangement dans l'ordre croissant puis détermination du nombre de candidats par secteur
		temp.sort((a, b) => a.length - b.length);
		let remainingSlots = neighboorLimit;
		let contributionNb = 0;
		const tLength = temp.length;
		const contrib: Itmp[] = [];
		for (let j = 0; j < tLength; j++) {
			const tempList = temp[j].sort((a, b) => a.distance - b.distance); // secteur considéré et ordonné selon la distance
			contributionNb = Math.min(tempList.length, Math.ceil(remainingSlots / (tLength - j))); // la contribution du secteur dépend du nb de secteurs restant à étudier et du nombre de slots restants
			contrib.push(...tempList.slice(0, contributionNb));
			remainingSlots -= contributionNb;
		}
		const townOverlapsI = 3 * neighboorLimit * i;
		contrib
			.sort((a, b) => a.az - b.az)
			.forEach((tmp, k) => {
				const townOverlapsK = townOverlapsI + 3 * k;
				townOverlaps[townOverlapsK] = tmp.townBOrder;
				townOverlaps[townOverlapsK + 1] = tmp.az;
				townOverlaps[townOverlapsK + 2] = tmp.townBAz;
			});
	}
	datas.staticTownData = {
		cityMap,
		neighboorLimit,
		townOverlaps,
		azDistMid: outputs[0],
		pointPPointQ: outputs[1],
		vUnitAndElevation: outputs[2],
		citiesGlslDatas,
	};
	return datas.staticTownData;
}

function groupBy<K, V>(list: Array<V>, keyGetter: (V) => K) {
	const map = new Map<K, Array<V>>();
	list.forEach((item) => {
		const key = keyGetter(item);
		const collection = map.get(key);
		if (!collection) {
			map.set(key, [item]);
		} else {
			collection.push(item);
		}
	});
	return map;
}

export function prepareDynamicTownGeometry(datas: IMergerData) {
	// return for each city and each year the list of alpha (road by default for each year and alpha for each edges terresterial)
	const roadCode = datas.roadCode;
	const speedPerTranspModePerYear = datas.speedPerTranspModePerYear;
	const cities = datas.cities;
	const citiesLength = cities.length;
	const cityMap = datas.staticTownData.cityMap;
	const azDistMid = datas.staticTownData.azDistMid;
	const spanBeginning = datas.span.begin,
		spanEnding = datas.span.end;
	const tmpResult: {
		[year: string]: {
			terrestrial: { [cityOrder: string]: { cityDestOrder: number; azimut: number; alpha: number }[] };
			roadAlpha: number;
		};
	} = {};
	for (let year = spanBeginning; year <= spanEnding; year++) {
		tmpResult[year] = {
			terrestrial: {},
			roadAlpha: speedPerTranspModePerYear[roadCode].tabSpeedPerYear[year].alpha,
		};
	}
	let definitiveBeginning = -Infinity,
		definitiveEnding = Infinity;
	cities.forEach((city, i) => {
		city.edges.forEach((edge) => {
			const edgeBeginning = Math.max(
				edge.eYearBegin === undefined ? spanBeginning : edge.eYearBegin,
				spanBeginning
			);
			const edgeEnding = Math.min(edge.eYearEnd === undefined ? spanEnding : edge.eYearEnd, spanEnding);
			definitiveBeginning = Math.max(definitiveBeginning, edgeBeginning);
			definitiveEnding = Math.min(definitiveEnding, edgeEnding);
			let cityDestOrder;
			if (city.cityCode == edge.cityCodeOri) {
				cityDestOrder = cityMap.get(edge.cityCodeDes);
			} else {
				cityDestOrder = cityMap.get(edge.cityCodeOri);
			}
			const azimut = azDistMid[4 * (i + cityDestOrder * citiesLength)];
			const speeds = speedPerTranspModePerYear[edge.transportModeCode].tabSpeedPerYear;

			if (speedPerTranspModePerYear[edge.transportModeCode].terrestrial) {
				for (let year = edgeBeginning; year <= edgeEnding; year++) {
					if (!tmpResult[year].terrestrial.hasOwnProperty(i)) {
						tmpResult[year].terrestrial[i] = [];
					}
					tmpResult[year].terrestrial[i].push({ cityDestOrder, azimut, alpha: speeds[year].alpha });
				}
			} else {
				//TODO curves
			}
		});
	});
	datas.span = { begin: definitiveBeginning, end: definitiveEnding };
	const resultat: { [year: string]: IDynamicTownPreGeometry } = {};
	for (const year in tmpResult) {
		const roadAlpha = tmpResult[year].roadAlpha;
		const terresterial = tmpResult[year].terrestrial;
		const tmpArray: { [cityOrder: string]: { cityDestOrder: number; azimut: number; alpha: number }[] } = {};
		for (const cityOrder in terresterial) {
			const groupedMap = groupBy(
				terresterial[cityOrder],
				(V: { cityDestOrder: number; azimut: number; alpha: number }) => V.cityDestOrder
			);

			const tmp = Array.from(groupedMap)
				// on garde seulement alpha le plus grand si on a plusieurs transports pour la même destination
				.map(([, tab]) => tab.sort((a, b) => b.alpha - a.alpha)[0])
				//on réordonne dans l'ordre croissant des azimuts
				.sort((a, b) => a.azimut - b.azimut);
			tmpArray[cityOrder] = tmp;
		}
		const citiesArray: number[] = [];
		const citiesDictArray: number[] = [];
		let oldPos = 0,
			newPos = 0;
		for (let i = 0; i < cities.length; i++) {
			if (tmpArray.hasOwnProperty(i)) {
				newPos = oldPos + tmpArray[i].length;
				tmpArray[i].forEach((v) => citiesArray.push(v.cityDestOrder, v.azimut, v.alpha));
				citiesDictArray.push(oldPos, newPos);
				oldPos = newPos + 1;
			} else {
				citiesDictArray.push(-1, -1);
			}
		}
		resultat[year] = {
			cityLinks: Float32Array.from(citiesArray),
			citiesDict: Int16Array.from(citiesDictArray),
			roadAlpha,
		};
	}
	datas.dynamicTownData = resultat;

	return resultat;
}
