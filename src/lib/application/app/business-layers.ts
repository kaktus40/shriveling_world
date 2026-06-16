import { Color3, Mesh, MeshBuilder, Scene, Vector3, VertexBuffer } from '@babylonjs/core';
import type { AppBusinessLayerDescriptor } from './render';

/** Babylon adapter responsible for rendering the operational business layers (Curves and Country borders). */
export interface AppBusinessLayerController {
        update(layers: readonly AppBusinessLayerDescriptor[], globalBuffer: GPUBuffer): void;
        dispose(): void;
}

interface LayerMeshGroup {
        readonly meshes: Mesh[];
}

/**
 * Creates and refreshes the meshes used to display computed business layers directly from GPU buffers.
 */
export function createAppBusinessLayerController(scene: Scene): AppBusinessLayerController {
        const engine = scene.getEngine();
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
                update(layers: readonly AppBusinessLayerDescriptor[], globalBuffer: GPUBuffer): void {
                        disposeGroups();
                        groups = layers
                                .map((layer) => ({
                                        meshes: layer.polylines
                                                .filter((polyline) => polyline.pointCount > 1)
                                                .map((polyline, polylineIndex) => {
                                                        const mesh = new Mesh(`${layer.name}-${polylineIndex}`, scene);
                                                        
                                                        // Bind GPU buffer directly
                                                        const positionBuffer = new VertexBuffer(
                                                            engine, 
                                                            globalBuffer, 
                                                            VertexBuffer.PositionKind, 
                                                            false, // updatable
                                                            false, 
                                                            16, // stride
                                                            false,
                                                            polyline.bufferOffset,
                                                            polyline.pointCount * 16
                                                        );
                                                        mesh.setVerticesBuffer(positionBuffer);
                                                        
                                                        // Note: MeshBuilder.CreateLines doesn't support direct buffer binding easily,
                                                        // so we use a custom Mesh approach for line primitives.
                                                        
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
