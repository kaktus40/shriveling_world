import {
	Color3,
	DynamicTexture,
	Mesh,
	MeshBuilder,
	Scene,
	StandardMaterial,
	Vector3,
	type AbstractMesh,
	type Nullable,
} from '@babylonjs/core';
import type { WorkspaceCitySummary } from '$lib/application/workspace';
import { APP_GLOBE_RADIUS } from './geometry';
import { projectAppGeographicPoint } from './projection';
import type { AppProjectionMode } from './page';

/** Babylon adapter responsible for city markers and first-level picking. */
export interface AppCityMarkerController {
	setCities(cities: readonly WorkspaceCitySummary[]): void;
	updateProjection(
		projectionStart: AppProjectionMode,
		projectionEnd: AppProjectionMode,
		projectionPercent: number,
	): void;
	updateSelection(
		activeCityIndex: number,
		hoveredCityIndex: number | null,
		queryMatchedCityIndexes: readonly number[],
	): void;
	setLabelVisibility(visible: boolean): void;
	resolveCityIndex(mesh: Nullable<AbstractMesh>): number | null;
	dispose(): void;
}

interface CityMarker {
	readonly city: WorkspaceCitySummary;
	readonly mesh: Mesh;
	readonly material: StandardMaterial;
	readonly labelMesh: Mesh;
	readonly labelMaterial: StandardMaterial;
	readonly labelTexture: DynamicTexture;
}

interface ProjectionState {
	readonly start: AppProjectionMode;
	readonly end: AppProjectionMode;
	readonly percent: number;
}

const globeRadius = APP_GLOBE_RADIUS;
const markerBaseColor = new Color3(0.17, 0.58, 0.56);
const markerBaseEmissive = new Color3(0.04, 0.18, 0.18);
const markerFocusColor = new Color3(0.96, 0.77, 0.29);
const markerFocusEmissive = new Color3(0.28, 0.2, 0.05);
const markerQueryColor = new Color3(0.92, 0.58, 0.2);
const markerQueryEmissive = new Color3(0.23, 0.12, 0.04);
const markerHoverColor = new Color3(0.45, 0.88, 0.84);
const markerHoverEmissive = new Color3(0.13, 0.28, 0.28);

/** Creates the dedicated Babylon controller for city markers. */
export function createAppCityMarkerController(scene: Scene): AppCityMarkerController {
	const markers: CityMarker[] = [];
	let hoveredCityIndex: number | null = null;
	let activeCityIndex: number | null = null;
	let queryMatchedCityIndexes: readonly number[] = [];
	let projectionState: ProjectionState = {
		start: 'none',
		end: 'equirectangular',
		percent: 50,
	};

	function disposeMarkers(): void {
		for (const marker of markers) {
			marker.mesh.dispose();
			marker.labelMesh.dispose();
			marker.material.dispose();
			marker.labelMaterial.dispose();
			marker.labelTexture.dispose();
		}
		markers.splice(0);
	}

	function refreshMarkerMaterials(): void {
		const queryMatchedSet = new Set(queryMatchedCityIndexes);
		for (const marker of markers) {
			if (marker.city.cityIndex === hoveredCityIndex) {
				marker.material.diffuseColor.copyFrom(markerHoverColor);
				marker.material.emissiveColor.copyFrom(markerHoverEmissive);
				marker.mesh.scaling.setAll(1.18);
				marker.labelMaterial.alpha = 1;
			} else if (marker.city.cityIndex === activeCityIndex) {
				marker.material.diffuseColor.copyFrom(markerFocusColor);
				marker.material.emissiveColor.copyFrom(markerFocusEmissive);
				marker.mesh.scaling.setAll(1.35);
				marker.labelMaterial.alpha = 1;
			} else if (queryMatchedSet.has(marker.city.cityIndex)) {
				marker.material.diffuseColor.copyFrom(markerQueryColor);
				marker.material.emissiveColor.copyFrom(markerQueryEmissive);
				marker.mesh.scaling.setAll(1.18);
				marker.labelMaterial.alpha = 0.95;
			} else {
				marker.material.diffuseColor.copyFrom(markerBaseColor);
				marker.material.emissiveColor.copyFrom(markerBaseEmissive);
				marker.mesh.scaling.setAll(1);
				marker.labelMaterial.alpha = 0.8;
			}
		}
	}

	function refreshMarkerPositions(): void {
		for (const marker of markers) {
			const projectedPoint = projectAppGeographicPoint(
				marker.city.longitudeRadians,
				marker.city.latitudeRadians,
				0,
				projectionState.start,
				projectionState.end,
				projectionState.percent,
			);
			marker.mesh.position.copyFrom(new Vector3(...projectedPoint));
			const labelPoint = projectAppGeographicPoint(
				marker.city.longitudeRadians,
				marker.city.latitudeRadians,
				0.35,
				projectionState.start,
				projectionState.end,
				projectionState.percent,
			);
			marker.labelMesh.position.copyFrom(new Vector3(...labelPoint));
		}
	}

	function refreshMarkers(): void {
		refreshMarkerPositions();
		refreshMarkerMaterials();
	}

	return {
		setCities(cities: readonly WorkspaceCitySummary[]): void {
			disposeMarkers();
			for (const city of cities) {
				const mesh = MeshBuilder.CreateSphere(`CityMarker-${city.cityIndex}`, { diameter: 0.46 }, scene);
				mesh.isPickable = true;
				mesh.metadata = { cityIndex: city.cityIndex, cityCode: city.cityCode };
				const material = new StandardMaterial(`AppMarkerMaterial-${city.cityIndex}`, scene);
				material.diffuseColor = markerBaseColor.clone();
				material.emissiveColor = markerBaseEmissive.clone();
				material.specularColor = new Color3(0.85, 0.9, 0.9);
				mesh.material = material;

				const labelMesh = MeshBuilder.CreatePlane(`CityLabel-${city.cityIndex}`, { width: 2.2, height: 0.45 }, scene);
				labelMesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
				labelMesh.isPickable = false;
				const labelMaterial = new StandardMaterial(`AppMarkerLabelMaterial-${city.cityIndex}`, scene);
				labelMaterial.disableLighting = true;
				labelMaterial.backFaceCulling = false;
				labelMaterial.diffuseColor = Color3.Black();
				labelMaterial.emissiveColor = new Color3(0.92, 0.96, 0.96);
				labelMaterial.specularColor = Color3.Black();
				labelMaterial.alpha = 0.8;
				const labelTexture = new DynamicTexture(
					`AppMarkerLabelTexture-${city.cityIndex}`,
					{ width: 512, height: 128 },
					scene,
					false,
				);
				labelTexture.hasAlpha = true;
				labelTexture.drawText(
					city.cityLabel,
					24,
					82,
					'bold 56px "Trebuchet MS", "Segoe UI", sans-serif',
					'#eff7f7',
					'transparent',
					true,
				);
				labelMaterial.diffuseTexture = labelTexture;
				labelMesh.material = labelMaterial;
				markers.push({ city, mesh, material, labelMesh, labelMaterial, labelTexture });
			}
			refreshMarkers();
		},
		updateProjection(
			projectionStart: AppProjectionMode,
			projectionEnd: AppProjectionMode,
			projectionPercent: number,
		): void {
			projectionState = {
				start: projectionStart,
				end: projectionEnd,
				percent: projectionPercent,
			};
			refreshMarkerPositions();
		},
		updateSelection(
			nextActiveCityIndex: number,
			nextHoveredCityIndex: number | null,
			nextQueryMatchedCityIndexes: readonly number[],
		): void {
			activeCityIndex = nextActiveCityIndex;
			hoveredCityIndex = nextHoveredCityIndex;
			queryMatchedCityIndexes = nextQueryMatchedCityIndexes;
			refreshMarkerMaterials();
		},
		setLabelVisibility(visible: boolean): void {
			for (const marker of markers) {
				marker.labelMesh.setEnabled(visible);
			}
		},
		resolveCityIndex(mesh: Nullable<AbstractMesh>): number | null {
			const cityIndex = mesh?.metadata ? Number((mesh.metadata as { cityIndex?: number }).cityIndex) : NaN;
			return Number.isFinite(cityIndex) ? cityIndex : null;
		},
		dispose(): void {
			disposeMarkers();
		},
	};
}
