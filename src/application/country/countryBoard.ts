'use strict';
import { Scene, Camera, Raycaster as Raycaster, Mesh, Vector2, Material } from 'three';
import { LonLatH } from '../common/utils';
import { CONFIGURATION } from '../common/configuration';
import { CountryMeshShader } from './countryMeshShader';
import type * as GeoJSON from 'geojson';
export class CountryBoard {
	public countryMeshCollection: CountryMeshShader[] = [];
	public ready = false;
	private readonly _scene: Scene;
	private readonly _camera: Camera;
	private readonly _raycaster: Raycaster;
	private _selectedMeshes: Mesh[] = [];
	private _scale = 1;
	private _show = true;
	private _opacity = 1;
	private _extruded = 1;

	get show(): boolean {
		return this._show;
	}

	set show(value: boolean) {
		this.countryMeshCollection.forEach((country) => {
			country.visible = value;
		});
		this._show = value;
	}

	get extruded(): number {
		return this._extruded;
	}

	set extruded(value: number) {
		this.countryMeshCollection.forEach((country) => {
			country.extruded = value;
		});
		this._extruded = value;
	}

	get scale(): number {
		return this._scale;
	}

	set scale(value: number) {
		this._selectedMeshes.forEach((mesh) => {
			mesh.scale.setScalar(value);
		});
		this.countryMeshCollection.forEach((mesh) => {
			mesh.scale.setScalar(value);
		});
		this._scale = value;
	}

	get opacity(): number {
		return this._opacity;
	}

	set opacity(value: number) {
		if (value > 0 && value <= 1) {
			this._opacity = value;
			this.countryMeshCollection.forEach((country) => {
				(<Material>country.material).opacity = value;
			});
		}
	}

	public constructor(scene: Scene, camera: Camera) {
		this._scene = scene;
		this._camera = camera;
		this._raycaster = new Raycaster();
	}

	public async add(geoJson: GeoJSON.FeatureCollection): Promise<void> {
		this.ready = false;
		this.clean();
		const collection = await CountryMeshShader.generator(geoJson);
		collection.forEach((mesh) => {
			this.countryMeshCollection.push(mesh);
			this._scene.add(mesh);
			mesh.visible = this._show;
			mesh.scale.setScalar(this._scale);
		});
		this.ready = true;
	}

	public clean(): void {
		for (let i = this.countryMeshCollection.length - 1; i >= 0; i--) {
			this._scene.remove(this.countryMeshCollection[i]);
			this.countryMeshCollection.splice(i, 1);
		}

		this._selectedMeshes.forEach((mesh) => {
			mesh.visible = false;
		});
	}

	// public getMeshByMouse(event: MouseEvent, highLight = false): CountryMeshShader {
	// 	let result: CountryMeshShader;
	// 	const mouse = new Vector2();
	// 	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	// 	mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
	// 	this._raycaster.setFromCamera(mouse, this._camera);
	// 	const intersects = this._raycaster.intersectObjects(this.countryMeshCollection);
	// 	if (intersects.length > 0) {
	// 		result = <CountryMeshShader>intersects[0].object;
	// 		this.highLight(result.otherProperties, highLight);
	// 	} else {
	// 		this._selectedMeshes.forEach((mesh) => {
	// 			if (!Array.isArray(mesh.material)) {
	// 				mesh.material.visible = false;
	// 			}
	// 		});
	// 	}

	// 	return result;
	// }
}
