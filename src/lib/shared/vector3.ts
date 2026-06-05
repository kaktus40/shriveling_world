/** A generic 3D vector. */
export type Vec3 = readonly [x: number, y: number, z: number];

/** Adds two 3D vectors. */
export function add3(a: Vec3, b: Vec3): Vec3 {
	return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/** Subtracts the second 3D vector from the first one. */
export function subtract3(a: Vec3, b: Vec3): Vec3 {
	return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** Multiplies a 3D vector by a scalar. */
export function scale3(vector: Vec3, scalar: number): Vec3 {
	return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

/** Computes the dot product of two 3D vectors. */
export function dot3(a: Vec3, b: Vec3): number {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Computes the cross product of two 3D vectors. */
export function cross3(a: Vec3, b: Vec3): Vec3 {
	return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** Returns the Euclidean norm of a 3D vector. */
export function norm3(vector: Vec3): number {
	return Math.sqrt(dot3(vector, vector));
}

/** Normalizes a 3D vector. A zero vector is preserved to avoid producing NaN buffers. */
export function normalize3(vector: Vec3): Vec3 {
	const norm = norm3(vector);
	if (norm === 0) {
		return [0, 0, 0];
	}
	return scale3(vector, 1 / norm);
}

/** Clamps a number between two inclusive bounds. */
export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}
