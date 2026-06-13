import type { BoundaryRaycastResult } from '../../geojson';
import type { ConeIntersectionOraclePrecompute, FinalConePrecompute } from '../types';
import { projectEcefPoint, type ProjectionTransition } from '$lib/shared/math';

/** Finalizes cone geometry after cone/cone clipping and optional boundary clipping. */
export function computeFinalConePrecomputeCpu(
	coneIntersections: ConeIntersectionOraclePrecompute,
	boundaryRaycast: BoundaryRaycastResult,
	earthRadiusMeters: number,
	projection: ProjectionTransition = {
		start: 'none',
		end: 'none',
		percent: 0,
	},
): FinalConePrecompute {
	const cityCount = coneIntersections.cityCount;
	const azimuthSampleCount = coneIntersections.azimuthSampleCount;
	const rayCount = cityCount * azimuthSampleCount;
	const finalConeGeometryEcef = new Float32Array(coneIntersections.ciseledConeRimEcef);

	for (let rayIndex = 0; rayIndex < rayCount; rayIndex += 1) {
		const angularOffset = rayIndex * 4;
		if (boundaryRaycast.townBoundaryAngular[angularOffset + 3] <= 0) {
			continue;
		}

		const boundaryDistanceMeters = boundaryRaycast.townBoundaryAngular[angularOffset + 2] * earthRadiusMeters;
		const ciseledDistanceMeters = Math.hypot(
			finalConeGeometryEcef[angularOffset],
			finalConeGeometryEcef[angularOffset + 1],
			finalConeGeometryEcef[angularOffset + 2],
		);
		if (boundaryDistanceMeters > 0 && boundaryDistanceMeters < ciseledDistanceMeters) {
			finalConeGeometryEcef[angularOffset] = boundaryRaycast.townBoundaryEcef[angularOffset];
			finalConeGeometryEcef[angularOffset + 1] = boundaryRaycast.townBoundaryEcef[angularOffset + 1];
			finalConeGeometryEcef[angularOffset + 2] = boundaryRaycast.townBoundaryEcef[angularOffset + 2];
			finalConeGeometryEcef[angularOffset + 3] = 1;
		}

		const projected = projectEcefPoint(
			finalConeGeometryEcef[angularOffset],
			finalConeGeometryEcef[angularOffset + 1],
			finalConeGeometryEcef[angularOffset + 2],
			projection,
		);
		finalConeGeometryEcef[angularOffset] = projected[0];
		finalConeGeometryEcef[angularOffset + 1] = projected[1];
		finalConeGeometryEcef[angularOffset + 2] = projected[2];
		finalConeGeometryEcef[angularOffset + 3] = 1;
	}

	return {
		cityCount,
		azimuthSampleCount,
		finalConeGeometryEcef,
	};
}
