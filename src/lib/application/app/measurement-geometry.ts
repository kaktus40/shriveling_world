/** Immutable 3D vector used by the application measurement helpers. */
export type AppMeasurementVector3 = readonly [number, number, number];

/** Immutable 2D vector used by the application measurement viewport. */
export type AppMeasurementVector2 = readonly [number, number];

/** Point projected into the measurement viewport plane. */
export interface AppMeasurementPlanePoint {
	readonly label: string;
	readonly cityIndex: number | null;
	readonly kind: 'origin' | 'city';
	readonly position: AppMeasurementVector2;
}

/** Plane frame used by the measurement viewport. */
export interface AppMeasurementPlaneFrame {
	readonly points: readonly AppMeasurementPlanePoint[];
}

/** Input point used to build the measurement plane frame. */
export interface AppMeasurementPlaneInput {
	readonly label: string;
	readonly cityIndex: number | null;
	readonly point: AppMeasurementVector3;
}

const epsilon = 1e-9;

/** Returns the component-wise difference `left - right`. */
export function subtract3(
	left: AppMeasurementVector3,
	right: AppMeasurementVector3,
): AppMeasurementVector3 {
	return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

/** Returns the scalar product of two 3D vectors. */
export function dot3(left: AppMeasurementVector3, right: AppMeasurementVector3): number {
	return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

/** Returns the Euclidean norm of one 3D vector. */
export function norm3(vector: AppMeasurementVector3): number {
	return Math.sqrt(dot3(vector, vector));
}

/** Returns the normalized vector or `null` for a null-length input. */
export function normalize3(vector: AppMeasurementVector3): AppMeasurementVector3 | null {
	const length = norm3(vector);
	if (length <= epsilon) {
		return null;
	}
	return [vector[0] / length, vector[1] / length, vector[2] / length];
}

/** Returns the angle between two 3D vectors in radians. */
export function angleBetween3(left: AppMeasurementVector3, right: AppMeasurementVector3): number | null {
	const leftNormalized = normalize3(left);
	const rightNormalized = normalize3(right);
	if (!leftNormalized || !rightNormalized) {
		return null;
	}
	const cosine = Math.max(-1, Math.min(1, dot3(leftNormalized, rightNormalized)));
	return Math.acos(cosine);
}

/** Returns the angle A-B-C in radians. */
export function angleAtVertex3(
	pointA: AppMeasurementVector3,
	pointB: AppMeasurementVector3,
	pointC: AppMeasurementVector3,
): number | null {
	const vectorBA = subtract3(pointA, pointB);
	const vectorBC = subtract3(pointC, pointB);
	return angleBetween3(vectorBA, vectorBC);
}

/** Projects one 3D vector onto an orthonormal plane basis. */
export function projectPointToPlane(
	point: AppMeasurementVector3,
	axisX: AppMeasurementVector3,
	axisY: AppMeasurementVector3,
): AppMeasurementVector2 {
	return [dot3(point, axisX), dot3(point, axisY)];
}

/**
 * Builds a plane frame using the city A / city B / Earth center convention.
 *
 * The basis uses city A as the primary axis and city B as the secondary axis
 * projected orthogonally to the first one. This keeps the viewer stable and
 * readable for local angular measurements.
 */
export function buildEarthCenterPlaneFrame(
	inputPoints: readonly AppMeasurementPlaneInput[],
): AppMeasurementPlaneFrame | null {
	const pointA = inputPoints[0]?.point;
	const pointB = inputPoints[1]?.point;
	if (!pointA || !pointB) {
		return null;
	}

	const axisX = normalize3(pointA);
	if (!axisX) {
		return null;
	}

	const projectedB = subtract3(pointB, scale3(axisX, dot3(pointB, axisX)));
	const axisY = normalize3(projectedB);
	if (!axisY) {
		return null;
	}

	const points: AppMeasurementPlanePoint[] = [
		{ label: 'O', cityIndex: null, kind: 'origin', position: [0, 0] },
		{
			label: inputPoints[0]?.label ?? 'A',
			cityIndex: inputPoints[0]?.cityIndex ?? null,
			kind: 'city',
			position: projectPointToPlane(pointA, axisX, axisY),
		},
		{
			label: inputPoints[1]?.label ?? 'B',
			cityIndex: inputPoints[1]?.cityIndex ?? null,
			kind: 'city',
			position: projectPointToPlane(pointB, axisX, axisY),
		},
	];

	for (const inputPoint of inputPoints.slice(2)) {
		points.push({
			label: inputPoint.label,
			cityIndex: inputPoint.cityIndex,
			kind: 'city',
			position: projectPointToPlane(inputPoint.point, axisX, axisY),
		});
	}

	return { points };
}

function scale3(vector: AppMeasurementVector3, factor: number): AppMeasurementVector3 {
	return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
}
