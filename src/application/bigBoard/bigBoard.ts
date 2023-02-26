'use strict';
import { CONFIGURATION } from '../common/configuration';
import { addLegend } from './addons/moveable';
// import { initWriter, generateCityNames } from './addons/cityVisualisation';
import { initSaver, exporterOBJ } from './addons/saver';
// import { prepareConfiguration } from './addons/initThree';
// import { ConeAndCurveBoard } from '../cone/coneBoard';
// import { CountryBoard } from '../country/countryBoard';
import { Merger } from './merger';
import type { IMergerState, ILookupCurvesAndCityGraph } from '../definitions/project';
import { filesToInsert, unzip } from './addons/fileManager';

import type { PseudoCone } from '../cone/base';
import type { CountryMeshShader } from '../country/countryMeshShader';
import { GUI } from './addons/guiDAT';
import type * as GeoJSON from 'geojson';
import type { IListFile } from '../definitions/project';
import '@babylonjs/core/Debug/debugLayer';
import '@babylonjs/inspector';
import {
	Engine,
	Scene,
	ArcRotateCamera,
	Vector3,
	Vector4,
	DirectionalLight,
	Mesh,
	MeshBuilder,
	SceneLoader,
	ShadowGenerator,
	HemisphericLight,
	Color3,
	Color4,
} from '@babylonjs/core';

/**
 * This class controls all the application:
 * * the list of [[_cones]],
 * * [[_countries]],
 * * curves
 * This is where the THREE.JS scene is defined with commands and behaviors
 */
export class BigBoard {
	/**
	 * the configuration of the app, available in static
	 */
	public static configuration = CONFIGURATION;

	public light: DirectionalLight;
	public ambient: HemisphericLight;
	/**
	 * set of cones: a [[_cone]] corresponds to a city and a mode of terrestrial transport
	 */
	// public coneAndCurveBoard: ConeAndCurveBoard;
	/**
	 * list of countries generated from a geojson file
	 */
	// public countryBoard: CountryBoard;
	// Is orthographic camera
	public orthographic: boolean;
	private _populations: number;
	private _windowHalfX: number = window.innerWidth / 2;
	private _windowHalfY: number = window.innerHeight / 2;
	private _merger: Merger;
	private _gui: GUI;
	private _sizeText = 1;

	private _engine: Engine;
	private _scene: Scene;
	private _camera: ArcRotateCamera;

	/**
	 * Creates an instance of bigBoard
	 *
	 * GUI is linked to bigBoard (but not contained in)
	 */
	constructor(element: HTMLElement, dat: HTMLElement) {
		this._merger = new Merger();
		// this._init3(element);
		this._init(element);
		initSaver(element).addEventListener('click', () => {
			// exporterOBJ(this.coneAndCurveBoard.coneMeshCollection, this.countryBoard.countryMeshCollection, this.coneAndCurveBoard.curveCollection);
		});
		this.orthographic = true;

		// this.countryBoard.show = false;
		CONFIGURATION.year = '2010';
		this._gui = new GUI(this, dat, this._merger);
	}

	/**
	 * Getter : Get scale parameter of the countries parameter
	 *
	 * @type {number}
	 * @memberof BigBoard
	 */
	// get scaleCountries(): number {
	// 	return this.countryBoard.scale;
	// }

	/**
	 * Setter : Update the value of scale parameter
	 * @param {number} value
	 * @memberof BigBoard
	 */
	// set scaleCountries(value: number) {
	// 	this.countryBoard.scale = value;
	// }

	/**
	 * Getter : Get scale parameter of the cones parameter
	 * @type {number}
	 * @memberof BigBoard
	 */
	// get scaleCones(): number {
	// 	return this.coneAndCurveBoard.scale;
	// }

	/**
	 * Setter : Update the value of scale parameter
	 * @param {number} value
	 * @memberof BigBoard
	 */
	// set scaleCones(value: number) {
	// 	this.coneAndCurveBoard.scale = value;
	// }

	/**
	 * Getter: Get show parameter of countries paramter
	 * @type {boolean}
	 * @memberof BigBoard
	 */
	// get showCountries(): boolean {
	// 	return this.countryBoard.show;
	// }

	/**
	 * Setter : Update the value of show parameter of countries parameter
	 * @memberof BigBoard
	 */
	// set showCountries(value: boolean) {
	// 	this.countryBoard.show = value;
	// }

	/**
	 * Getter: Get show parameter of cone parameter
	 * @type {boolean}
	 * @memberof BigBoard
	 */
	// get showCones(): boolean {
	// 	return this.coneAndCurveBoard.show;
	// }

	/**
	 * Setter : Update the value of show parameter of cones parameter
	 * @param {boolean} value
	 * @memberof BigBoard
	 */
	// set showCones(value: boolean) {
	// 	this.coneAndCurveBoard.show = value;
	// }

	/**
	 * Getter : Get if the boundaries of the cones is limited by the countries
	 * @type {boolean}
	 * @memberof BigBoard
	 */
	// get withLimits(): boolean {
	// 	return this.coneAndCurveBoard.withLimits;
	// }

	/**
	 * Setter : update the withLimits parameter of the cones parameters
	 * if true the boundaries of cones will be limited by the boundaries of countries
	 * @memberof BigBoard
	 */
	// set withLimits(value: boolean) {
	// 	this.coneAndCurveBoard.withLimits = value;
	// }

	/**
	 * Getter : Get the current state of the merger
	 * @returns missing || ready || complete || pending
	 * @readonly
	 * @type {IMergerState}
	 * @memberof BigBoard
	 */
	get state(): IMergerState {
		return this._merger.state;
	}

	/**
	 * @see countryBoard  : cleanCountries method
	 * @memberof BigBoard
	 */
	// public cleanCountries(): void {
	// 	this.countryBoard.clean();
	// }

	// public addCountries(geoJson: GeoJSON.FeatureCollection): void {
	// 	void this.countryBoard.add(geoJson);
	// }

	/**
	 * @see coneBoard :  cleanCones method
	 * @memberof BigBoard
	 */
	// public cleanConesAndCurves(): void {
	// 	this.coneAndCurveBoard.clean();
	// }

	public cleanAllAndReload(list: IListFile[]): void {
		// this.cleanConesAndCurves();
		// this.cleanCountries();
		filesToInsert(list);
	}

	public unzip(zip: Uint8Array): void {
		unzip(zip);
		// this.cleanAllAndReload(unzipped);
	}

	/**
	 * Add cone to the coneMeshCollection
	 * @todo unused and irrelevant @see coneBoard.add
	 * @param {ILookupCurvesAndCityGraph} lookup
	 * @memberof BigBoard
	 */
	// public addCones(lookup: ILookupCurvesAndCityGraph): void {
	// 	this.coneAndCurveBoard.addConesAndCurves(lookup);
	// }

	/**
	 * Get the country through the position of the mouse
	 * @todo unused and irrelevant @see coneBoard.getMeshByMouse
	 * @param {MouseEvent} event
	 * @param {boolean} [highLight=false]
	 * @returns {CountryMeshShader}
	 * @memberof BigBoard
	 */
	// public getCountryByMouse(event: MouseEvent, highLight = false): CountryMeshShader {
	// 	return this.countryBoard.getMeshByMouse(event, highLight);
	// }

	/**
	 * Get the cone through the position of the mouse
	 * @todo unused and irrelevant @see countryBoard.getMeshByMouse
	 * @param {MouseEvent} event
	 * @param {boolean} [highLight=false]
	 * @returns {PseudoCone}
	 * @memberof BigBoard
	 */
	// public getConeByMouse(event: MouseEvent, highLight = false): PseudoCone {
	// 	return this.coneAndCurveBoard.getMeshByMouse(event, highLight);
	// }

	/**
	 * Initializing the scene
	 * @private
	 * @memberof BigBoard
	 */
	private _init(element: HTMLElement) {
		const canvas = document.createElement('canvas');
		canvas.style.width = '100%';
		canvas.style.height = '100%';
		document.body.appendChild(canvas);

		// initialize babylon scene and engine
		this._engine = new Engine(canvas, true);
		this._scene = new Scene(this._engine);
		this._scene.ambientColor = new Color3(1, 1, 1);
		this._scene.clearColor = new Color4(1, 1, 1, 1);

		this._camera = new ArcRotateCamera('Camera', Math.PI / 2, Math.PI / 2, 2, Vector3.Zero(), this._scene);
		this._camera.attachControl(canvas, true);
		this._camera.mode = ArcRotateCamera.ORTHOGRAPHIC_CAMERA; //ArcRotateCamera.PERSPECTIVE_CAMERA
		this._camera.zoomToMouseLocation = true;
		// fog
		// geometry text
		this.ambient = new HemisphericLight('ambient', new Vector3(1, 1, 1), this._scene);
		// initWriter(this._scene, this._merger);

		this._engine.runRenderLoop(() => {
			this._scene.render();
			CONFIGURATION.tick();
		});
		window.addEventListener('keydown', (ev) => {
			// Shift+Ctrl+Alt+I
			if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.keyCode === 73) {
				if (this._scene.debugLayer.isVisible()) {
					this._scene.debugLayer.hide();
				} else {
					this._scene.debugLayer.show();
				}
			}
			switch (ev.key) {
				case '+':
					this._camera.radius -= 0.1;
					break;
				case '-':
					this._camera.radius += 0.1;
					break;

				default:
					break;
			}
		});
	}

	public addLegend(): void {
		addLegend(this._merger.codeSpeedPerYear);
	}
}
