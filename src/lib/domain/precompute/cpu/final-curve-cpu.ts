import type { ProjectionTransition } from '$lib/shared/math';
import { projectEcefPoint } from '$lib/shared/math';
import type { CurveGeometryInput, CurveVertexBuffer } from '../types';
import { computeCurveVertexBufferCpu } from './curve-cpu';

/**
 * Finalizes curve geometry after yearly sampling and optional projection mix.
 *
 * The resulting vertices are ready to display, so the application shell can
 * consume them without reprojection.
 */
export function computeFinalCurveVertexBufferCpu(
	input: CurveGeometryInput,
	projection: ProjectionTransition = {
		start: 'none',
		end: 'none',
		percent: 0,
	},
): CurveVertexBuffer {
	const curveGeometry = computeCurveVertexBufferCpu(input);
	const positions = new Float32Array(curveGeometry.positions);
	for (let offset = 0; offset < positions.length; offset += 4) {
		const projected = projectEcefPoint(positions[offset], positions[offset + 1], positions[offset + 2], projection);
		positions[offset] = projected[0];
		positions[offset + 1] = projected[1];
		positions[offset + 2] = projected[2];
		positions[offset + 3] = 1;
	}
	return {
		...curveGeometry,
		positions,
	};
}
