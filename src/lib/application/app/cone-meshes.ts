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
        update(cones: readonly AppConeMeshDescriptor[], globalBuffer: Float32Array): void;
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

        function createOrUpdateMesh(descriptor: AppConeMeshDescriptor, globalBuffer: Float32Array): void {
                const sampleCount = descriptor.sampleCount;
                if (sampleCount < 3) return;

                // Extract positions from global buffer using bufferOffset
                const positions = new Float32Array((sampleCount + 1) * 3);
                positions[0] = descriptor.apex[0];
                positions[1] = descriptor.apex[1];
                positions[2] = descriptor.apex[2];
                
                // Copy rim points from global buffer
                // Buffer is Vec4 ECEF [x, y, z, w]
                const offset = descriptor.bufferOffset / 4; 
                for (let i = 0; i < sampleCount; i++) {
                        positions[(i + 1) * 3] = globalBuffer[offset + i * 4];
                        positions[(i + 1) * 3 + 1] = globalBuffer[offset + i * 4 + 1];
                        positions[(i + 1) * 3 + 2] = globalBuffer[offset + i * 4 + 2];
                }

                const indices = createIndexBuffer(sampleCount);
                const normals = new Float32Array(positions.length);
                VertexData.ComputeNormals(positions, indices, normals);

                const existing = meshes.get(descriptor.name);
                if (existing && existing.sampleCount === sampleCount) {
                        existing.mesh.updateVerticesData(VertexBuffer.PositionKind, positions);
                        existing.mesh.updateVerticesData(VertexBuffer.NormalKind, normals);
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
                
                const material = new StandardMaterial(`ConeMaterial-${descriptor.name}`, scene);
                applyMaterial(material, descriptor.color, descriptor.opacity ?? 1);
                mesh.material = material;

                const vertexData = new VertexData();
                vertexData.positions = positions;
                vertexData.indices = indices;
                vertexData.normals = normals;
                vertexData.applyToMesh(mesh, true);
                mesh.visibility = descriptor.opacity ?? 1;
                meshes.set(descriptor.name, { mesh, material, sampleCount });
        }

        return {
                update(cones: readonly AppConeMeshDescriptor[], globalBuffer: Float32Array): void {
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
