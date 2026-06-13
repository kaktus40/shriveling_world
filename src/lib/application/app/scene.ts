import {
	ArcRotateCamera,
	Color3,
	Color4,
	Engine,
	HemisphericLight,
	KeyboardEventTypes,
	MeshBuilder,
	PointerEventTypes,
	Scene,
	StandardMaterial,
	Vector3,
} from '@babylonjs/core';
import type { WorkspaceComputeResult } from '$lib/application/workspace';
import { APP_GLOBE_RADIUS, projectCityToAppPoint } from './geometry';
import { createAppBusinessLayerController } from './business-layers';
import { createAppCityMarkerController } from './city-markers';
import { buildAppBusinessLayers } from './render';
import type { AppMeasurementSelection } from './measurement';
import type { AppCameraMode, AppPageState, AppRepresentationMode } from './page';

export interface AppSceneState {
	readonly appState: AppPageState | null;
	readonly workspaceCompute: WorkspaceComputeResult | null;
	readonly selectedYear: number;
	readonly selectedCityIndex: number;
	readonly queryMatchedCityIndexes: readonly number[];
	readonly cameraMode: AppCameraMode;
	readonly representationStart: AppRepresentationMode;
	readonly representationEnd: AppRepresentationMode;
	readonly representationPercent: number;
	readonly showCityLabels: boolean;
	readonly measurementSelection: AppMeasurementSelection;
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

const globeRadius = APP_GLOBE_RADIUS;
const orbitRadius = 28;
const inspectRadius = 16;
const freeRadius = 36;

/** Builds the Babylon scene used by the operational application surface. */
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

	const globe = MeshBuilder.CreateSphere('AppGlobe', { diameter: globeRadius * 2, segments: 48 }, scene);
	const globeMaterial = createColorMaterial(
		scene,
		'AppGlobeMaterial',
		new Color3(0.06, 0.17, 0.2),
		new Color3(0.03, 0.06, 0.08),
	);
	globe.material = globeMaterial;

	const atmosphere = MeshBuilder.CreateSphere(
		'AppAtmosphere',
		{ diameter: globeRadius * 2.08, segments: 48 },
		scene,
	);
	const atmosphereMaterial = createColorMaterial(
		scene,
		'AppAtmosphereMaterial',
		new Color3(0.11, 0.2, 0.23),
		new Color3(0.08, 0.12, 0.15),
		0.12,
	);
	atmosphere.material = atmosphereMaterial;
	atmosphere.isPickable = false;

	const cityMarkers = createAppCityMarkerController(scene);
	const businessLayers = createAppBusinessLayerController(scene);
	let hoveredCityIndex: number | null = null;
	let currentState: AppSceneState = initialState;
	let activeCityIndex = initialState.selectedCityIndex;

	scene.onPointerObservable.add((pointerInfo) => {
		const pickedMesh = pointerInfo.pickInfo?.pickedMesh ?? null;
		const cityIndex = cityMarkers.resolveCityIndex(pickedMesh);
		if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
			setHoveredCityIndex(cityIndex);
		}
		if (pointerInfo.type === PointerEventTypes.POINTERDOWN && cityIndex !== null) {
			activeCityIndex = cityIndex;
			cityMarkers.updateSelection(activeCityIndex, hoveredCityIndex, currentState.queryMatchedCityIndexes);
			cityMarkers.setLabelVisibility(currentState.showCityLabels);
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
		cityMarkers.updateSelection(activeCityIndex, hoveredCityIndex, currentState.queryMatchedCityIndexes);
		hooks.onCityPick?.(nextCity.cityIndex);
		hooks.onCameraModeChange?.('inspect');
		focusSelectedCity();
	}

	function setHoveredCityIndex(cityIndex: number | null): void {
		if (hoveredCityIndex === cityIndex) {
			return;
		}
		hoveredCityIndex = cityIndex;
		cityMarkers.updateSelection(activeCityIndex, hoveredCityIndex, currentState.queryMatchedCityIndexes);
	}

	function applyCameraMode(state: AppSceneState): void {
		const selectedCityIndex =
			state.measurementSelection.focusCityIndex ?? state.selectedCityIndex;
		const selectedCity = state.appState?.cities.find((city) => city.cityIndex === selectedCityIndex);
		switch (state.cameraMode) {
			case 'inspect':
				camera.radius = inspectRadius;
				camera.upperRadiusLimit = 40;
				camera.lowerRadiusLimit = 8;
				if (selectedCity) {
					camera.setTarget(
						new Vector3(
							...projectCityToAppPoint(selectedCity.longitudeRadians, selectedCity.latitudeRadians, globeRadius),
						),
					);
					camera.alpha = (state.measurementSelection.localRotationDegrees * Math.PI) / 180;
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
		const focusCityIndex = currentState.measurementSelection.focusCityIndex ?? activeCityIndex;
		const selectedCity = currentState.appState?.cities.find((city) => city.cityIndex === focusCityIndex);
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
		const previousCityCount = currentState.appState?.cities.length ?? 0;
		currentState = nextState;
		if (
			nextState.appState?.workspace.datasetName !== previousDatasetName ||
			(nextState.appState?.cities.length ?? 0) !== previousCityCount
		) {
			cityMarkers.setCities(nextState.appState?.cities ?? []);
		}
		activeCityIndex = nextState.selectedCityIndex;
		applyCameraMode(nextState);
		applyYearTone(nextState);
		cityMarkers.updateSelection(activeCityIndex, hoveredCityIndex, nextState.queryMatchedCityIndexes);
		cityMarkers.setLabelVisibility(nextState.showCityLabels);
		businessLayers.update(
			buildAppBusinessLayers(
				nextState.workspaceCompute?.result ?? null,
				nextState.representationPercent,
				nextState.selectedCityIndex,
			),
		);
	}

	cityMarkers.setCities(initialState.appState?.cities ?? []);
	cityMarkers.updateSelection(activeCityIndex, hoveredCityIndex, initialState.queryMatchedCityIndexes);
	cityMarkers.setLabelVisibility(initialState.showCityLabels);
	businessLayers.update(
		buildAppBusinessLayers(
			initialState.workspaceCompute?.result ?? null,
			initialState.representationPercent,
			initialState.selectedCityIndex,
		),
	);
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
			cityMarkers.dispose();
			businessLayers.dispose();
			scene.dispose();
			engine.dispose();
		},
	};
}

function createColorMaterial(
	scene: Scene,
	name: string,
	diffuseColor: Color3,
	emissiveColor: Color3,
	alpha = 1,
) {
	const material = new StandardMaterial(name, scene);
	material.diffuseColor = diffuseColor;
	material.emissiveColor = emissiveColor;
	material.alpha = alpha;
	return material;
}
