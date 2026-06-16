import type { CurveGeometryDispatchInput, CurveGeometryDispatchResources, GpuBufferUsageFlags } from '../../buffers';

/** Creates the GPU allocations required by the final curve WGSL pass. */
export function createCurveGeometryDispatchResources(
        device: GPUDevice,
        usage: GpuBufferUsageFlags,
        input: CurveGeometryDispatchInput,
): CurveGeometryDispatchResources {
        const controlPointsBuffer = device.createBuffer({
                size: input.curveControlPointsEcef.byteLength,
                usage: usage.STORAGE | usage.COPY_DST,
        });
        const thetaBuffer = device.createBuffer({
                size: input.curveThetaRadians.byteLength,
                usage: usage.STORAGE | usage.COPY_DST,
        });
        const speedRatioBuffer = device.createBuffer({
                size: input.curveSpeedRatio.byteLength,
                usage: usage.STORAGE | usage.COPY_DST,
        });
        const curveIdsBuffer = device.createBuffer({
                size: input.curveIds.byteLength,
                usage: usage.STORAGE | usage.COPY_DST,
        });
        
        // Single Uniform Buffer matching CurveGeometryUniforms WGSL struct
        const uniformBuffer = device.createBuffer({
                size: 64, // 4 * vec4<f32> = 64 bytes
                usage: usage.UNIFORM | usage.COPY_DST,
        });
        
        const outputBuffer = device.createBuffer({
                size: Math.max(input.curveCount * (input.pointsPerCurve + 1), 1) * 4 * Float32Array.BYTES_PER_ELEMENT,
                usage: usage.STORAGE | usage.COPY_SRC,
        });

        device.queue.writeBuffer(controlPointsBuffer, 0, input.curveControlPointsEcef);
        device.queue.writeBuffer(thetaBuffer, 0, input.curveThetaRadians);
        device.queue.writeBuffer(speedRatioBuffer, 0, input.curveSpeedRatio);
        device.queue.writeBuffer(curveIdsBuffer, 0, input.curveIds);
        
        // Fill uniform buffer
        const uniformData = new Float32Array([
            input.earthRadiusMeters, input.pointsPerCurve, curvePositionToCode(input.curvePosition), input.coefficient ?? 1,
            input.projectionInit, input.projectionEnd, input.projectionPercent, input.globeRadius,
            input.projectionReferenceLongitudeRadians, input.projectionReferenceLatitudeRadians, input.projectionReferenceHeightMeters, input.projectionZCoefficient,
            input.projectionStandardParallel1Radians, input.projectionStandardParallel2Radians, 0, 0
        ]);
        device.queue.writeBuffer(uniformBuffer, 0, uniformData);

        return {
                curveControlPointsEcef: {
                        buffer: controlPointsBuffer,
                        contract: {
                                name: 'curveControlPointsEcef',
                                elementType: 'float32',
                                strideBytes: 16 * Float32Array.BYTES_PER_ELEMENT,
                                count: input.curveCount,
                                linearUnit: 'meters',
                                coordinateOrder: 'ecef',
                                notes: ['Packed [A, P, Q, B] control points per curve'],
                        },
                },
                curveThetaRadians: {
                        buffer: thetaBuffer,
                        contract: {
                                name: 'curveThetaRadians',
                                elementType: 'float32',
                                strideBytes: Float32Array.BYTES_PER_ELEMENT,
                                count: input.curveCount,
                                angularUnit: 'radians',
                                notes: ['Great-circle angular distance per curve'],
                        },
                },
                curveSpeedRatio: {
                        buffer: speedRatioBuffer,
                        contract: {
                                name: 'curveSpeedRatio',
                                elementType: 'float32',
                                strideBytes: Float32Array.BYTES_PER_ELEMENT,
                                count: input.curveCount,
                                notes: ['Yearly ratio maxSpeed / curveSpeed per curve'],
                        },
                },
                curveIds: {
                        buffer: curveIdsBuffer,
                        contract: {
                                name: 'curveIds',
                                elementType: 'uint32',
                                strideBytes: Uint32Array.BYTES_PER_ELEMENT,
                                count: input.curveCount,
                                notes: ['Stable curve ids for traceability'],
                        },
                },
                uniform: {
                        buffer: uniformBuffer,
                        contract: {
                                name: 'curveGeometryUniforms',
                                elementType: 'float32',
                                strideBytes: 16 * Float32Array.BYTES_PER_ELEMENT,
                                count: 4,
                                notes: ['[values: 4f32], [projection: 4f32], [proj_settings_a: 4f32], [proj_settings_b: 4f32]'],
                        },
                },
                curveVertexPositions: {
                        buffer: outputBuffer,
                        contract: {
                                name: 'curveVertexPositions',
                                elementType: 'float32',
                                strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
                                count: input.curveCount * (input.pointsPerCurve + 1),
                                linearUnit: 'meters',
                                coordinateOrder: 'ecef',
                                notes: ['Final curve geometry in display projection space'],
                        },
                },
        };
}

function curvePositionToCode(position: CurveGeometryDispatchInput['curvePosition']): number {
        switch (position) {
                case 'above': return 0;
                case 'below': return 1;
                case 'below-when-possible': return 2;
                case 'stick-to-cone': return 3;
        }
}
