import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3, type Nullable, type AbstractMesh } from '@babylonjs/core';
import type { WorkspaceCitySummary } from '$lib/application/workspace';
import { APP_GLOBE_RADIUS, projectCityToAppPoint } from './geometry';

/** Babylon adapter responsible for city markers and first-level picking. */
export interface AppCityMarkerController {
	setCities(cities: readonly WorkspaceCitySummary[]): void;
	updateSelection(activeCityIndex: number, hoveredCityIndex: number | null): void;
	resolveCityIndex(mesh: Nullable<AbstractMesh>): number | null;
	dispose(): void;
}

interface CityMarker {
	readonly cityIndex: number;
	readonly mesh: Mesh;
	readonly material: StandardMaterial;
}

const globeRadius = APP_GLOBE_RADIUS;
const markerBaseColor = new Color3(0.17, 0.58, 0.56);
const markerBaseEmissive = new Color3(0.04, 0.18, 0.18);
const markerFocusColor = new Color3(0.96, 0.77, 0.29);
const markerFocusEmissive = new Color3(0.28, 0.2, 0.05);
const markerHoverColor = new Color3(0.45, 0.88, 0.84);
const markerHoverEmissive = new Color3(0.13, 0.28, 0.28);

/** Creates the dedicated Babylon controller for city markers. */
export function createAppCityMarkerController(scene: Scene): AppCityMarkerController {
	const markers: CityMarker[] = [];
	let hoveredCityIndex: number | null = null;
	let activeCityIndex: number | null = null;

	function disposeMarkers(): void {
		for (const marker of markers) {
			marker.mesh.dispose();
			marker.material.dispose();
		}
		markers.splice(0);
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

	return {
		setCities(cities: readonly WorkspaceCitySummary[]): void {
			disposeMarkers();
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
		},
		updateSelection(nextActiveCityIndex: number, nextHoveredCityIndex: number | null): void {
			activeCityIndex = nextActiveCityIndex;
			hoveredCityIndex = nextHoveredCityIndex;
			refreshMarkerMaterials();
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
