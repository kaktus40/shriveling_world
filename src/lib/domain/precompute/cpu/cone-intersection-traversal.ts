import { TWO_PI } from '../../../shared';
import { ALPHA_SUPPORT_EPSILON_RADIANS } from './cone-intersection-constants';
import { positiveAngle, positiveModulo, signedAngleDelta } from './cone-intersection-angular';
import { validateAlphaAwareValues } from './cone-intersection-validation';

/** Characterization of one exhaustive alpha-aware face traversal. */
export interface AlphaAwareFaceTraversal {
	/** Every face exactly once, with priority-window faces first. */
	faceIndexes: Uint32Array;
	/** Number of leading entries belonging to the priority window. */
	priorityFaceCount: number;
	/** Number of priority faces touching at least one fast alpha sample. */
	priorityFastFaceCount: number;
}

/**
 * Returns every face index once, ordered from the symmetric ray toward B->A.
 */
export function buildSymmetricFaceTraversal(
	phiB0Radians: number,
	gammaBARadians: number,
	azimuthSampleCount: number,
): Uint32Array {
	if (
		!Number.isFinite(phiB0Radians) ||
		!Number.isFinite(gammaBARadians) ||
		!Number.isSafeInteger(azimuthSampleCount) ||
		azimuthSampleCount < 3
	) {
		throw new RangeError('symmetric traversal requires finite angles and at least three azimuth samples');
	}
	const sampleStepRadians = TWO_PI / azimuthSampleCount;
	const normalizedPhiB0 = positiveAngle(phiB0Radians);
	const startFaceIndex = Math.min(Math.floor(normalizedPhiB0 / sampleStepRadians), azimuthSampleCount - 1);
	const direction = signedAngleDelta(gammaBARadians - normalizedPhiB0) < 0 ? -1 : 1;
	const traversal = new Uint32Array(azimuthSampleCount);
	for (let visitIndex = 0; visitIndex < azimuthSampleCount; visitIndex += 1) {
		traversal[visitIndex] = positiveModulo(startFaceIndex + direction * visitIndex, azimuthSampleCount);
	}
	return traversal;
}

/**
 * Returns every face index once, alternating around the symmetric ray.
 */
export function buildAlternatingFaceTraversal(
	phiB0Radians: number,
	gammaBARadians: number,
	azimuthSampleCount: number,
): Uint32Array {
	if (
		!Number.isFinite(phiB0Radians) ||
		!Number.isFinite(gammaBARadians) ||
		!Number.isSafeInteger(azimuthSampleCount) ||
		azimuthSampleCount < 3
	) {
		throw new RangeError('alternating traversal requires finite angles and at least three azimuth samples');
	}
	const sampleStepRadians = TWO_PI / azimuthSampleCount;
	const normalizedPhiB0 = positiveAngle(phiB0Radians);
	const startFaceIndex = Math.min(Math.floor(normalizedPhiB0 / sampleStepRadians), azimuthSampleCount - 1);
	const direction = signedAngleDelta(gammaBARadians - normalizedPhiB0) < 0 ? -1 : 1;
	const traversal = new Uint32Array(azimuthSampleCount);
	let outputIndex = 0;
	traversal[outputIndex] = startFaceIndex;
	outputIndex += 1;
	for (let offset = 1; outputIndex < azimuthSampleCount; offset += 1) {
		const forwardFaceIndex = positiveModulo(startFaceIndex + direction * offset, azimuthSampleCount);
		if (forwardFaceIndex !== startFaceIndex) {
			traversal[outputIndex] = forwardFaceIndex;
			outputIndex += 1;
		}
		if (outputIndex >= azimuthSampleCount) {
			break;
		}
		const backwardFaceIndex = positiveModulo(startFaceIndex - direction * offset, azimuthSampleCount);
		if (backwardFaceIndex !== startFaceIndex && backwardFaceIndex !== forwardFaceIndex) {
			traversal[outputIndex] = backwardFaceIndex;
			outputIndex += 1;
		}
	}
	return traversal;
}

/** Classifies faces touching an alpha sample strictly faster than Road. */
export function classifyFastConeFaces(
	coneAlphaRadians: ArrayLike<number>,
	roadAlphaRadians: number,
	alphaEpsilonRadians = ALPHA_SUPPORT_EPSILON_RADIANS,
): Uint8Array {
	validateAlphaAwareValues(coneAlphaRadians.length, roadAlphaRadians, 0, alphaEpsilonRadians);
	const fastFaces = new Uint8Array(coneAlphaRadians.length);
	for (let faceIndex = 0; faceIndex < coneAlphaRadians.length; faceIndex += 1) {
		const nextFaceIndex = (faceIndex + 1) % coneAlphaRadians.length;
		if (!Number.isFinite(coneAlphaRadians[faceIndex])) {
			throw new RangeError('cone alpha samples must be finite');
		}
		if (
			coneAlphaRadians[faceIndex] < roadAlphaRadians - alphaEpsilonRadians ||
			coneAlphaRadians[nextFaceIndex] < roadAlphaRadians - alphaEpsilonRadians
		) {
			fastFaces[faceIndex] = 1;
		}
	}
	return fastFaces;
}

/** Builds the exhaustive alpha-aware order for one ray of A against cone B. */
export function buildAlphaAwareFaceTraversal(
	phiB0Radians: number,
	gammaBARadians: number,
	coneAlphaRadians: ArrayLike<number>,
	options: {
		readonly roadAlphaRadians: number;
		readonly bilateralNeighborhoodFaceCount: number;
		readonly alphaEpsilonRadians?: number;
	},
): AlphaAwareFaceTraversal {
	const alphaEpsilonRadians = options.alphaEpsilonRadians ?? ALPHA_SUPPORT_EPSILON_RADIANS;
	validateAlphaAwareValues(
		coneAlphaRadians.length,
		options.roadAlphaRadians,
		options.bilateralNeighborhoodFaceCount,
		alphaEpsilonRadians,
	);
	if (!Number.isFinite(phiB0Radians) || !Number.isFinite(gammaBARadians)) {
		throw new RangeError('alpha-aware traversal requires finite phiB0 and gammaBA angles');
	}

	return buildAlphaAwareFaceTraversalFromFastFaces(
		phiB0Radians,
		gammaBARadians,
		classifyFastConeFaces(coneAlphaRadians, options.roadAlphaRadians, alphaEpsilonRadians),
		options.bilateralNeighborhoodFaceCount,
	);
}

/**
 * Builds the exhaustive alpha-aware order from an already classified fast-face mask.
 */
export function buildAlphaAwareFaceTraversalFromFastFaces(
	phiB0Radians: number,
	gammaBARadians: number,
	fastFaces: Uint8Array,
	bilateralNeighborhoodFaceCount: number,
): AlphaAwareFaceTraversal {
	const faceCount = fastFaces.length;
	const sampleStepRadians = TWO_PI / faceCount;
	const normalizedPhiB0 = positiveAngle(phiB0Radians);
	const startFaceIndex = Math.min(Math.floor(normalizedPhiB0 / sampleStepRadians), faceCount - 1);
	const endFaceIndex = Math.min(Math.floor(positiveAngle(gammaBARadians) / sampleStepRadians), faceCount - 1);
	const direction = signedAngleDelta(gammaBARadians - normalizedPhiB0) < 0 ? -1 : 1;
	const selected = new Uint8Array(faceCount);
	const priority: number[] = [];
	const appendPriority = (faceIndex: number): void => {
		const normalized = positiveModulo(faceIndex, faceCount);
		if (selected[normalized] === 0) {
			selected[normalized] = 1;
			priority.push(normalized);
		}
	};

	let corridorFaceIndex = startFaceIndex;
	for (let visited = 0; visited < faceCount; visited += 1) {
		appendPriority(corridorFaceIndex);
		if (corridorFaceIndex === endFaceIndex) {
			break;
		}
		corridorFaceIndex = positiveModulo(corridorFaceIndex + direction, faceCount);
	}
	appendPriority(startFaceIndex - direction);
	appendPriority(endFaceIndex + direction);

	for (let distance = 0; distance <= bilateralNeighborhoodFaceCount; distance += 1) {
		const lowerFaceIndex = positiveModulo(startFaceIndex - distance, faceCount);
		const upperFaceIndex = positiveModulo(startFaceIndex + distance, faceCount);
		if (fastFaces[lowerFaceIndex] === 1) {
			appendPriority(lowerFaceIndex);
		}
		if (fastFaces[upperFaceIndex] === 1) {
			appendPriority(upperFaceIndex);
		}
	}

	const traversal = new Uint32Array(faceCount);
	traversal.set(priority);
	let outputIndex = priority.length;
	for (const faceIndex of buildAlternatingFaceTraversal(phiB0Radians, gammaBARadians, faceCount)) {
		if (selected[faceIndex] === 0) {
			traversal[outputIndex] = faceIndex;
			outputIndex += 1;
		}
	}

	return {
		faceIndexes: traversal,
		priorityFaceCount: priority.length,
		priorityFastFaceCount: priority.reduce((count, faceIndex) => count + fastFaces[faceIndex], 0),
	};
}
