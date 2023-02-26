import { Writer } from './meshWriter';
import { CONFIGURATION } from '../../common/configuration';
import { Vector3 } from '@babylonjs/core';
import type { IWriter } from './meshWriter';
import type { Scene } from '@babylonjs/core';
import type { Merger } from '../merger';

let writer: (text: string) => IWriter;
let merger: Merger;
let nameDict: { [name: string]: IWriter } = {};

export function initWriter(scene: Scene, _merger: Merger): void {
	writer = Writer(scene);
	merger = _merger;
}
/**
 * Rescale all text by the sizeText p
 * @memberof BigBoard
 */
export function rescaleText(size: number): void {
	const scaleVector = new Vector3(size, size, size);
	for (const [_, value] of Object.entries(nameDict)) {
		value.getMesh().scaling = scaleVector;
	}
}

/**
 * Update all the city which will be displayed regarding the population threshold parameter
 */
export function generateCityNames(): void {
	if (merger.state !== 'complete') {
		return;
	}

	for (let j = 0; j < merger.Cities.length / 2; j++) {
		const obj = merger.Cities[j];
		const pop =
			merger.edgesWithTranspModes.lookupCityGraph[merger.Cities[j].cityCode].origCityProperties.populations;
		const population = (pop as any).pop2020;
		if (population > this._populations) {
			const writted = writer(obj.cityName);
			// mesh = new Mesh3(geometry, CONFIGURATION.BASIC_TEXT_MATERIAL);
			// TODO prendre en compte position ville en fonction de projection avec la verticale et orientation
			const cart = merger.edgesWithTranspModes.lookupCityGraph[merger.Cities[j].cityCode].referential.latLonHRef;
			const x =
				-CONFIGURATION.THREE_EARTH_RADIUS * 1.1 * Math.cos(cart.latitude * 0.95) * Math.cos(cart.longitude);
			const y = CONFIGURATION.THREE_EARTH_RADIUS * 1.1 * Math.sin(cart.latitude * 0.95);
			const z =
				CONFIGURATION.THREE_EARTH_RADIUS * 1.1 * Math.cos(cart.latitude * 0.95) * Math.sin(cart.longitude);
			nameDict[obj.cityName] = writted;
			writted.getSPS().billboard = true;
			writted.getMesh().position.set(x, y, z);

			// Mesh.rotation.set(0,Math.cos(cart.latitude*CONFIGURATION.rad2deg),0);
		}
	}
}

export function updatePosition() {
	for (const [key, value] of Object.entries(nameDict)) {
		console.log(`${key}: ${value}`);
	}
}

export function updateScale() {
	for (const [key, value] of Object.entries(nameDict)) {
		console.log(`${key}: ${value}`);
	}
}

export function clear() {
	for (const [key, value] of Object.entries(nameDict)) {
		console.log(`${key}: ${value}`);
		value.dispose();
	}
	nameDict = {};
}
