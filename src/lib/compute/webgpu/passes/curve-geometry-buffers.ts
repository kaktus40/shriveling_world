import type { CurveGeometryDispatchInput, CurveGeometryDispatchResources, GpuBufferUsageFlags } from '../buffers';

/** Creates the GPU allocations required by the curve-geometry WGSL pass. */
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
	const uniformBuffer = device.createBuffer({
		size: 16,
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
	device.queue.writeBuffer(
		uniformBuffer,
		0,
		new Float32Array([
			input.earthRadiusMeters,
			input.pointsPerCurve,
			curvePositionToCode(input.curvePosition),
			input.coefficient ?? 1,
		]),
	);

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
				strideBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
				count: 1,
				linearUnit: 'meters',
				angularUnit: 'radians',
				notes: ['[earthRadiusMeters, pointsPerCurve, curvePositionCode, coefficient]'],
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
				notes: ['Render-ready curve vertices in ECEF meters'],
			},
		},
	};
}

function curvePositionToCode(position: CurveGeometryDispatchInput['curvePosition']): number {
	switch (position) {
		case 'above':
			return 0;
		case 'below':
			return 1;
		case 'below-when-possible':
			return 2;
		case 'stick-to-cone':
			return 3;
	}
}
