import { PI } from '../../../shared';

/** Default algebraic tolerance used to reject parallel or degenerate faces. */
export const RAY_TRIANGLE_DETERMINANT_EPSILON = 1e-7;

/** Default minimum accepted distance in front of a ray origin, in meters. */
export const RAY_ORIGIN_EPSILON_METERS = 1e-5;

/** Default tolerance used to distinguish fast alpha samples from Road alpha. */
export const ALPHA_SUPPORT_EPSILON_RADIANS = 1e-6;

export function validateRoadAlphaRadians(roadAlphaRadians: number): void {
	if (!Number.isFinite(roadAlphaRadians) || roadAlphaRadians < 0 || roadAlphaRadians > PI / 2) {
		throw new RangeError('roadAlphaRadians must be finite and within [0, PI / 2]');
	}
}
