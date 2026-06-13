import { Color3, Mesh, MeshBuilder, Scene, Vector3 } from '@babylonjs/core';
import type { AppBusinessLayerDescriptor } from './render';

/** Babylon adapter responsible for rendering the operational business layers. */
export interface AppBusinessLayerController {
	update(layers: readonly AppBusinessLayerDescriptor[]): void;
	dispose(): void;
}

interface LayerMeshGroup {
	readonly meshes: Mesh[];
}

/**
 * Creates and refreshes the meshes used to display computed business layers.
 *
 * The controller keeps one Babylon lines mesh per polyline so the scene can
 * remain explicit and easy to debug.
 */
export function createAppBusinessLayerController(scene: Scene): AppBusinessLayerController {
	let groups: LayerMeshGroup[] = [];

	function disposeGroups(): void {
		for (const group of groups) {
			for (const mesh of group.meshes) {
				mesh.dispose();
			}
		}
		groups = [];
	}

	return {
		update(layers: readonly AppBusinessLayerDescriptor[]): void {
			disposeGroups();
			groups = layers
				.map((layer) => ({
					meshes: layer.polylines
						.filter((polyline) => polyline.points.length > 1)
						.map((polyline, polylineIndex) => {
							const mesh = MeshBuilder.CreateLines(
								`${layer.name}-${polylineIndex}`,
								{
									points: polyline.points.map(toVector3),
									updatable: false,
								},
								scene,
							);
							mesh.color = new Color3(layer.color[0], layer.color[1], layer.color[2]);
							mesh.isPickable = false;
							mesh.metadata = { layerName: layer.name, polylineIndex };
							return mesh;
						}),
				}))
				.filter((group) => group.meshes.length > 0);
		},
		dispose(): void {
			disposeGroups();
		},
	};
}

function toVector3(point: readonly [number, number, number]): Vector3 {
	return new Vector3(point[0], point[1], point[2]);
}
