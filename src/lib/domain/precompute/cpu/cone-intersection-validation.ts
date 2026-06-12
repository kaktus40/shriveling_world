import { validateRoadAlphaRadians } from './cone-intersection-constants';

/** Validates the shared parameters used by alpha-aware cone traversals. */
export function validateAlphaAwareValues(
	faceCount: number,
	roadAlphaRadians: number,
	bilateralNeighborhoodFaceCount: number,
	alphaEpsilonRadians: number,
): void {
	if (!Number.isSafeInteger(faceCount) || faceCount < 3) {
		throw new RangeError('alpha-aware traversal requires at least three azimuth samples');
	}
	validateRoadAlphaRadians(roadAlphaRadians);
	if (!Number.isSafeInteger(bilateralNeighborhoodFaceCount) || bilateralNeighborhoodFaceCount < 0) {
		throw new RangeError('bilateralNeighborhoodFaceCount must be a non-negative safe integer');
	}
	if (!Number.isFinite(alphaEpsilonRadians) || alphaEpsilonRadians < 0) {
		throw new RangeError('alphaEpsilonRadians must be finite and non-negative');
	}
}
