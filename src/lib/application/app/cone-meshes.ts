import {
        Color3,
        Mesh,
        Scene,
        StandardMaterial,
        VertexBuffer,
        VertexData,
} from '@babylonjs/core';
import type { AppColor3, AppConeMeshDescriptor } from './render';

/** Babylon adapter responsible for the cone meshes used by the operational app. */
export interface AppConeMeshController {
        update(cones: readonly AppConeMeshDescriptor[], globalBuffer: GPUBuffer): void;
        dispose(): void;
}

interface ConeMeshState {
        readonly mesh: Mesh;
        readonly material: StandardMaterial;
        sampleCount: number;
}

const coneIndicesCache = new Map<number, Uint32Array>();

/** Creates and refreshes the Babylon cone meshes from final cone geometry. */
export function createAppConeMeshController(scene: Scene): AppConeMeshController {
        const meshes = new Map<string, ConeMeshState>();
        const engine = scene.getEngine();

        function disposeMeshes(): void {
                for (const state of meshes.values()) {
                        state.mesh.dispose();
                        state.material.dispose();
                }
                meshes.clear();
        }

        function createIndexBuffer(sampleCount: number): Uint32Array {
                const cached = coneIndicesCache.get(sampleCount);
                if (cached) {
                        return cached;
                }
                const indices = new Uint32Array(sampleCount * 3);
                for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
                        const offset = sampleIndex * 3;
                        indices[offset] = 0;
                        indices[offset + 1] = sampleIndex + 1;
                        indices[offset + 2] = ((sampleIndex + 1) % sampleCount) + 1;
                }
                coneIndicesCache.set(sampleCount, indices);
                return indices;
        }

        function createOrUpdateMesh(descriptor: AppConeMeshDescriptor, globalBuffer: GPUBuffer): void {
                const sampleCount = descriptor.sampleCount;
                if (sampleCount < 3) return;

                const existing = meshes.get(descriptor.name);
                
                // For simplicity, we keep CPU normal calculation but link the Position buffer directly
                // Note: For fully optimized WebGPU, we would also move normal calculation to a shader
                const indices = createIndexBuffer(sampleCount);

                if (existing && existing.sampleCount === sampleCount) {
                        applyMaterial(existing.material, descriptor.color, descriptor.opacity ?? 1);
                        existing.mesh.visibility = descriptor.opacity ?? 1;
                        existing.mesh.refreshBoundingInfo();
                        return;
                }

                if (existing) {
                        existing.mesh.dispose();
                        existing.material.dispose();
                        meshes.delete(descriptor.name);
                }

                const mesh = new Mesh(descriptor.name, scene);
                mesh.isPickable = false;
                
                // Link buffer directly to Babylon mesh
                // VertexBuffer(engine, buffer, kind, updatable, postponeInternalCreation, stride, instanced, offset, size)
                const positionBuffer = new VertexBuffer(
                    engine, 
                    globalBuffer, 
                    VertexBuffer.PositionKind, 
                    false, // updatable
                    false, 
                    16, // stride: 4 * f32 (Vec4)
                    false,
                    descriptor.bufferOffset,
                    sampleCount * 16 // size
                );
                mesh.setVerticesBuffer(positionBuffer);
                mesh.setIndices(indices);

                const material = new StandardMaterial(`ConeMaterial-${descriptor.name}`, scene);
                applyMaterial(material, descriptor.color, descriptor.opacity ?? 1);
                mesh.material = material;

                mesh.visibility = descriptor.opacity ?? 1;
                meshes.set(descriptor.name, { mesh, material, sampleCount });
        }

        return {
                update(cones: readonly AppConeMeshDescriptor[], globalBuffer: GPUBuffer): void {
                        const nextNames = new Set(cones.map((cone) => cone.name));
                        for (const [name, state] of meshes.entries()) {
                                if (!nextNames.has(name)) {
                                        state.mesh.dispose();
                                        state.material.dispose();
                                        meshes.delete(name);
                                }
                        }
                        for (const cone of cones) {
                                createOrUpdateMesh(cone, globalBuffer);
                        }
                },
                dispose(): void {
                        disposeMeshes();
                },
        };
}

function applyMaterial(material: StandardMaterial, color: AppColor3, opacity: number): void {
        material.diffuseColor.copyFromFloats(color[0], color[1], color[2]);
        material.emissiveColor.copyFromFloats(color[0] * 0.35, color[1] * 0.35, color[2] * 0.35);
        material.specularColor = Color3.Black();
        material.alpha = opacity;
}
