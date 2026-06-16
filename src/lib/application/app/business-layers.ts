import { Color3, Mesh, MeshBuilder, Scene, Vector3 } from '@babylonjs/core';
import type { AppBusinessLayerDescriptor } from './render';

/** Babylon adapter responsible for rendering the operational business layers. */
export interface AppBusinessLayerController {
        update(layers: readonly AppBusinessLayerDescriptor[], globalBuffer: Float32Array): void;
        dispose(): void;
}

interface LayerMeshGroup {
        readonly meshes: Mesh[];
}

/**
 * Creates and refreshes the meshes used to display computed business layers.
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
                update(layers: readonly AppBusinessLayerDescriptor[], globalBuffer: Float32Array): void {
                        disposeGroups();
                        groups = layers
                                .map((layer) => ({
                                        meshes: layer.polylines
                                                .filter((polyline) => polyline.pointCount > 1)
                                                .map((polyline, polylineIndex) => {
                                                        // Extract points from global buffer using bufferOffset
                                                        const points: Vector3[] = [];
                                                        const offset = polyline.bufferOffset / 4;
                                                        for (let i = 0; i < polyline.pointCount; i++) {
                                                                points.push(new Vector3(
                                                                        globalBuffer[offset + i * 4],
                                                                        globalBuffer[offset + i * 4 + 1],
                                                                        globalBuffer[offset + i * 4 + 2]
                                                                ));
                                                        }

                                                        const mesh = MeshBuilder.CreateLines(
                                                                `${layer.name}-${polylineIndex}`,
                                                                {
                                                                        points: points,
                                                                        updatable: false,
                                                                },
                                                                scene,
                                                        );
                                                        mesh.color = new Color3(layer.color[0], layer.color[1], layer.color[2]);
                                                        mesh.visibility = layer.opacity ?? 1;
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
