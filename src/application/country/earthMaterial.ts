'use strict';
import { StandardMaterial, Texture } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { map, specularMap, bumpMap, normalMap } from './configuration.json';

let output: StandardMaterial;

export function generateEarthMaterial(scene: Scene) {
	output = new StandardMaterial('earthMaterial', scene);
	// output.bumpTexture = new Texture(bumpMap, scene);
	output.diffuseTexture = new Texture(map, scene);
	// output.specularTexture = new Texture(specularMap, scene);
	output.backFaceCulling = false;
	output.freeze();
}

export function earthMaterial() {
	return output;
}
