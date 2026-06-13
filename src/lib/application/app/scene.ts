import {
	AbstractMesh,
	ArcRotateCamera,
	Color3,
	Color4,
	Engine,
	HemisphericLight,
	KeyboardEventTypes,
	Mesh,
	MeshBuilder,
	PointerEventTypes,
	Scene,
	StandardMaterial,
	Vector3,
	type Nullable,
} from '@babylonjs/core';
import type { AppCameraMode, AppPageState } from './page';
import type { WorkspaceCitySummary } from '$lib/application/workspace';
import { projectCityToAppPoint } from './geometry';

export interface AppSceneState {
	readonly appState: AppPageState | null;
	readonly selectedYear: number;
	readonly selectedCityIndex: number;
	readonly cameraMode: AppCameraMode;
}

export interface AppSceneHooks {
	readonly onCityPick?: (cityIndex: number) => void;
	readonly onYearStep?: (step: -1 | 1) => void;
	readonly onCameraModeChange?: (cameraMode: AppCameraMode) => void;
}

export interface AppSceneController {
	update(state: AppSceneState): void;
	dispose(): void;
}

interface CityMarker {
	readonly cityIndex: number;
	readonly mesh: Mesh;
	readonly material: StandardMaterial;
}

const globeRadius = 12;
const orbitRadius = 28;
const inspectRadius = 16;
const freeRadius = 36;

export function createAppScene(
	canvas: HTMLCanvasElement,
	initialState: AppSceneState,
	hooks: AppSceneHooks = {},
): AppSceneController {
	const engine = new Engine(canvas, true, {
		stencil: true,
		preserveDrawingBuffer: true,
	});
	const scene = new Scene(engine);
	scene.clearColor = new Color4(0.035, 0.05, 0.07, 1);

	const camera = new ArcRotateCamera(
		'AppCamera',
		-Math.PI / 2,
		Math.PI / 2.35,
		orbitRadius,
		Vector3.Zero(),
		scene,
	);
	camera.attachControl(canvas, true);
	camera.zoomToMouseLocation = true;
	camera.lowerRadiusLimit = 10;
	camera.upperRadiusLimit = 80;
	camera.wheelPrecision = 50;

	new HemisphericLight('AppLight', new Vector3(0.3, 1, 0.2), scene).intensity = 1.2;

	const globeMaterial = new StandardMaterial('AppGlobeMaterial', scene);
	globeMaterial.diffuseColor = new Color3(0.06, 0.17, 0.2);
	globeMaterial.emissiveColor = new Color3(0.03, 0.06, 0.08);
	globeMaterial.specularColor = new Color3(0.45, 0.55, 0.58);

	const atmosphereMaterial = new StandardMaterial('AppAtmosphereMaterial', scene);
	atmosphereMaterial.diffuseColor = new Color3(0.11, 0.2, 0.23);
	atmosphereMaterial.emissiveColor = new Color3(0.08, 0.12, 0.15);
	atmosphereMaterial.alpha = 0.12;
	atmosphereMaterial.specularColor = new Color3(0.7, 0.85, 0.9);

	const markerBaseColor = new Color3(0.17, 0.58, 0.56);
	const markerBaseEmissive = new Color3(0.04, 0.18, 0.18);
	const markerFocusColor = new Color3(0.96, 0.77, 0.29);
	const markerFocusEmissive = new Color3(0.28, 0.2, 0.05);
	const markerHoverColor = new Color3(0.45, 0.88, 0.84);
	const markerHoverEmissive = new Color3(0.13, 0.28, 0.28);

	const globe = MeshBuilder.CreateSphere('AppGlobe', { diameter: globeRadius * 2, segments: 48 }, scene);
	globe.material = globeMaterial;

	const atmosphere = MeshBuilder.CreateSphere(
		'AppAtmosphere',
		{ diameter: globeRadius * 2.08, segments: 48 },
		scene,
	);
	atmosphere.material = atmosphereMaterial;
	atmosphere.isPickable = false;

	const markers: CityMarker[] = [];
	let hoveredCityIndex: number | null = null;
	let currentState: AppSceneState = initialState;
	let activeCityIndex = initialState.selectedCityIndex;

	scene.onPointerObservable.add((pointerInfo) => {
		const pickedMesh = pointerInfo.pickInfo?.pickedMesh ?? null;
		const cityIndex = resolveCityIndex(pickedMesh);
		if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
			setHoveredCityIndex(cityIndex);
		}
		if (pointerInfo.type === PointerEventTypes.POINTERDOWN && cityIndex !== null) {
			activeCityIndex = cityIndex;
			hooks.onCityPick?.(cityIndex);
			hooks.onCameraModeChange?.('inspect');
			focusSelectedCity();
		}
	});

	scene.onKeyboardObservable.add((keyboardInfo) => {
		if (keyboardInfo.type !== KeyboardEventTypes.KEYDOWN) {
			return;
		}

		const key = keyboardInfo.event.key;
		if (key === '+' || key === '=') {
			camera.radius = Math.max(camera.lowerRadiusLimit ?? 10, camera.radius - 1.5);
		}
		if (key === '-' || key === '_') {
			camera.radius = Math.min(camera.upperRadiusLimit ?? 80, camera.radius + 1.5);
		}
		if (key === 'ArrowLeft') {
			shiftSelection(-1);
		}
		if (key === 'ArrowRight') {
			shiftSelection(1);
		}
		if (key === '[') {
			hooks.onYearStep?.(-1);
		}
		if (key === ']') {
			hooks.onYearStep?.(1);
		}
		if (key === '1') {
			hooks.onCameraModeChange?.('orbit');
		}
		if (key === '2') {
			hooks.onCameraModeChange?.('inspect');
		}
		if (key === '3') {
			hooks.onCameraModeChange?.('free');
		}
	});

	function shiftSelection(step: -1 | 1): void {
		const cities = currentState.appState?.cities ?? [];
		if (cities.length === 0) {
			return;
		}
		const currentIndex = cities.findIndex((city) => city.cityIndex === activeCityIndex);
		const nextIndex = currentIndex < 0 ? 0 : (currentIndex + step + cities.length) % cities.length;
		const nextCity = cities[nextIndex];
		activeCityIndex = nextCity.cityIndex;
		hooks.onCityPick?.(nextCity.cityIndex);
		hooks.onCameraModeChange?.('inspect');
		focusSelectedCity();
	}

	function resolveCityIndex(mesh: Nullable<AbstractMesh>): number | null {
		const cityIndex = mesh?.metadata ? Number((mesh.metadata as { cityIndex?: number }).cityIndex) : NaN;
		return Number.isFinite(cityIndex) ? cityIndex : null;
	}

	function setHoveredCityIndex(cityIndex: number | null): void {
		if (hoveredCityIndex === cityIndex) {
			return;
		}
		hoveredCityIndex = cityIndex;
		refreshMarkerMaterials();
	}

	function createMarkers(state: AppSceneState): void {
		markers.splice(0).forEach(({ mesh, material }) => {
			mesh.dispose();
			material.dispose();
		});
		const cities = state.appState?.cities ?? [];
		for (const city of cities) {
			const mesh = MeshBuilder.CreateSphere(`CityMarker-${city.cityIndex}`, { diameter: 0.46 }, scene);
			mesh.position = new Vector3(...projectCityToAppPoint(city.longitudeRadians, city.latitudeRadians, globeRadius + 0.1));
			mesh.isPickable = true;
			mesh.metadata = { cityIndex: city.cityIndex, cityCode: city.cityCode };
			const material = new StandardMaterial(`AppMarkerMaterial-${city.cityIndex}`, scene);
			material.diffuseColor = markerBaseColor.clone();
			material.emissiveColor = markerBaseEmissive.clone();
			material.specularColor = new Color3(0.85, 0.9, 0.9);
			mesh.material = material;
			markers.push({ cityIndex: city.cityIndex, mesh, material });
		}
		refreshMarkerMaterials();
	}

	function refreshMarkerMaterials(): void {
		for (const marker of markers) {
			if (marker.cityIndex === hoveredCityIndex) {
				marker.material.diffuseColor.copyFrom(markerHoverColor);
				marker.material.emissiveColor.copyFrom(markerHoverEmissive);
				marker.mesh.scaling.setAll(1.18);
			} else if (marker.cityIndex === activeCityIndex) {
				marker.material.diffuseColor.copyFrom(markerFocusColor);
				marker.material.emissiveColor.copyFrom(markerFocusEmissive);
				marker.mesh.scaling.setAll(1.35);
			} else {
				marker.material.diffuseColor.copyFrom(markerBaseColor);
				marker.material.emissiveColor.copyFrom(markerBaseEmissive);
				marker.mesh.scaling.setAll(1);
			}
		}
	}

	function applyCameraMode(state: AppSceneState): void {
		const selectedCity = state.appState?.cities.find((city) => city.cityIndex === state.selectedCityIndex);
		switch (state.cameraMode) {
			case 'inspect':
				camera.radius = inspectRadius;
				camera.upperRadiusLimit = 40;
				camera.lowerRadiusLimit = 8;
				if (selectedCity) {
					camera.setTarget(new Vector3(...projectCityToAppPoint(
						selectedCity.longitudeRadians,
						selectedCity.latitudeRadians,
						globeRadius,
					)));
				}
				break;
			case 'free':
				camera.radius = freeRadius;
				camera.upperRadiusLimit = 120;
				camera.lowerRadiusLimit = 8;
				camera.setTarget(Vector3.Zero());
				break;
			case 'orbit':
			default:
				camera.radius = orbitRadius;
				camera.upperRadiusLimit = 80;
				camera.lowerRadiusLimit = 10;
				camera.setTarget(Vector3.Zero());
				break;
		}
	}

	function applyYearTone(state: AppSceneState): void {
		const years = state.appState?.yearOptions ?? [];
		if (years.length === 0) {
			return;
		}
		const minYear = years[0] ?? state.selectedYear;
		const maxYear = years[years.length - 1] ?? state.selectedYear;
		const span = Math.max(1, maxYear - minYear);
		const ratio = Math.min(1, Math.max(0, (state.selectedYear - minYear) / span));
		globeMaterial.emissiveColor = new Color3(0.03 + ratio * 0.05, 0.06 + ratio * 0.04, 0.08 + ratio * 0.03);
		atmosphereMaterial.emissiveColor = new Color3(0.08 + ratio * 0.04, 0.12 + ratio * 0.03, 0.15 + ratio * 0.02);
	}

	function focusSelectedCity(): void {
		const selectedCity = currentState.appState?.cities.find((city) => city.cityIndex === activeCityIndex);
		if (!selectedCity) {
			return;
		}
		camera.setTarget(
			new Vector3(
				...projectCityToAppPoint(selectedCity.longitudeRadians, selectedCity.latitudeRadians, globeRadius),
			),
		);
	}

	function syncState(nextState: AppSceneState): void {
		const previousDatasetName = currentState.appState?.workspace.datasetName;
		currentState = nextState;
		if (
			nextState.appState?.workspace.datasetName !== previousDatasetName ||
			nextState.appState?.cities.length !== markers.length
		) {
			createMarkers(nextState);
		}
		activeCityIndex = nextState.selectedCityIndex;
		applyCameraMode(nextState);
		applyYearTone(nextState);
		refreshMarkerMaterials();
	}

	createMarkers(initialState);
	applyCameraMode(initialState);
	applyYearTone(initialState);
	hooks.onCityPick?.(activeCityIndex);
	hooks.onCameraModeChange?.(initialState.cameraMode);
	engine.runRenderLoop(() => {
		scene.render();
	});

	const resizeObserver = new ResizeObserver(() => engine.resize());
	resizeObserver.observe(canvas);

	return {
		update(state: AppSceneState) {
			syncState(state);
		},
		dispose() {
			resizeObserver.disconnect();
			scene.dispose();
			engine.dispose();
		},
	};
}
