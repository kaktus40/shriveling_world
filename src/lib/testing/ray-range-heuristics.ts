import { intersectRayTriangleDoubleSided, type Vector3 } from '$lib/domain/precompute';
import { PI, TWO_PI } from '$lib/shared';

/** One fictional cone used to reason about face-range heuristics in Euclidean 3D. */
export interface FictionalConeProfile {
	/** Stable identifier used by the UI. */
	id: string;
	/** Cone apex position in meters. */
	apexMeters: Vector3;
	/** Global azimuth offset applied to sample directions, in radians. */
	azimuthOffsetRadians: number;
	/** Uniform slant length of the cone rays, in meters. */
	coneLengthMeters: number;
	/** Default road alpha used by every ray outside explicit fast sectors, in radians. */
	roadAlphaRadians: number;
	/** Number of azimuth samples forming the cone rim. */
	azimuthSampleCount: number;
	/** Optional fast sector center, in radians. */
	fastSectorCenterRadians?: number;
	/** Optional fast sector angular width, in radians. */
	fastSectorWidthRadians?: number;
	/** Optional fast alpha used inside the fast sector, in radians. */
	fastAlphaRadians?: number;
}

/** One ray emitted by a fictional cone sample. */
export interface FictionalConeRay {
	originMeters: Vector3;
	rimPointMeters: Vector3;
	direction: Vector3;
	azimuthRadians: number;
	lengthMeters: number;
	sampleIndex: number;
	alphaRadians: number;
}

/** One triangular face of a fictional cone. */
export interface FictionalConeFace {
	faceIndex: number;
	vertex0Meters: Vector3;
	vertex1Meters: Vector3;
	vertex2Meters: Vector3;
	fastFace: boolean;
	minAzimuthRadians: number;
	maxAzimuthRadians: number;
}

/** One actual ray intersection retained for inspection. */
export interface FictionalIntersectionHit {
	faceIndex: number;
	distanceMeters: number;
	pointMeters: Vector3;
}

/** Summary returned by the heuristic page for one source ray against one target cone. */
export interface RayRangeHeuristicAnalysis {
	sourceRay: FictionalConeRay;
	targetBearingRadians: number;
	symmetricAzimuthRadians: number;
	symmetricFaceIndex: number;
	priorityFaceIndexes: Uint32Array;
	fastFaceIndexes: Uint32Array;
	allHits: FictionalIntersectionHit[];
	closestHit: FictionalIntersectionHit | null;
}

/** Converts degrees to radians for the heuristic page controls. */
export function degreesToRadians(value: number): number {
	return (value * PI) / 180;
}

/** Converts radians to degrees for the heuristic page controls. */
export function radiansToDegrees(value: number): number {
	return (value * 180) / PI;
}

/** Normalizes one angle into `[0, 2 PI)`. */
export function wrapPositive(angleRadians: number): number {
	const remainder = angleRadians % TWO_PI;
	return remainder < 0 ? remainder + TWO_PI : remainder;
}

/** Returns one signed wrapped angular delta in `[-PI, PI[`. */
export function wrapSigned(angleRadians: number): number {
	const positive = wrapPositive(angleRadians);
	return positive >= PI ? positive - TWO_PI : positive;
}

/** Returns the closest azimuth sample center for one angle on a circular cone. */
export function azimuthToSampleIndex(azimuthRadians: number, azimuthSampleCount: number): number {
	validateSampleCount(azimuthSampleCount);
	const stepRadians = TWO_PI / azimuthSampleCount;
	return positiveModulo(Math.round(wrapPositive(azimuthRadians) / stepRadians), azimuthSampleCount);
}

/** Returns the global azimuth of one sample center, including the cone offset. */
export function sampleIndexToAzimuthRadians(profile: FictionalConeProfile, sampleIndex: number): number {
	validateSampleIndex(sampleIndex, profile.azimuthSampleCount);
	return wrapPositive(profile.azimuthOffsetRadians + (sampleIndex * TWO_PI) / profile.azimuthSampleCount);
}

/** Returns the directional alpha used by one sample of a fictional cone. */
export function sampleAlphaRadians(profile: FictionalConeProfile, sampleIndex: number): number {
	const azimuthRadians = sampleIndexToAzimuthRadians(profile, sampleIndex);
	if (
		profile.fastSectorCenterRadians === undefined ||
		profile.fastSectorWidthRadians === undefined ||
		profile.fastAlphaRadians === undefined
	) {
		return profile.roadAlphaRadians;
	}

	const deltaRadians = Math.abs(wrapSigned(azimuthRadians - wrapPositive(profile.fastSectorCenterRadians)));
	return deltaRadians <= profile.fastSectorWidthRadians / 2 ? profile.fastAlphaRadians : profile.roadAlphaRadians;
}

/** Classifies every face touching at least one fast sample. */
export function classifyFastFaces(profile: FictionalConeProfile): Uint8Array {
	const fastFaces = new Uint8Array(profile.azimuthSampleCount);
	for (let faceIndex = 0; faceIndex < profile.azimuthSampleCount; faceIndex += 1) {
		const nextFaceIndex = (faceIndex + 1) % profile.azimuthSampleCount;
		if (sampleAlphaRadians(profile, faceIndex) < profile.roadAlphaRadians || sampleAlphaRadians(profile, nextFaceIndex) < profile.roadAlphaRadians) {
			fastFaces[faceIndex] = 1;
		}
	}
	return fastFaces;
}

/** Builds all rim points of a fictional cone, in dense sample order. */
export function buildConeRimPoints(profile: FictionalConeProfile): Vector3[] {
	validateProfile(profile);
	return Array.from({ length: profile.azimuthSampleCount }, (_, sampleIndex) => {
		const azimuthRadians = sampleIndexToAzimuthRadians(profile, sampleIndex);
		const alphaRadians = sampleAlphaRadians(profile, sampleIndex);
		const horizontalMeters = profile.coneLengthMeters * Math.cos(alphaRadians);
		const verticalMeters = profile.coneLengthMeters * Math.sin(alphaRadians);
		return [
			profile.apexMeters[0] + horizontalMeters * Math.cos(azimuthRadians),
			profile.apexMeters[1] + verticalMeters,
			profile.apexMeters[2] + horizontalMeters * Math.sin(azimuthRadians),
		];
	});
}

/** Builds all triangular faces of a fictional cone. */
export function buildConeFaces(profile: FictionalConeProfile): FictionalConeFace[] {
	const rimPoints = buildConeRimPoints(profile);
	const fastFaces = classifyFastFaces(profile);
	return Array.from({ length: profile.azimuthSampleCount }, (_, faceIndex) => {
		const nextFaceIndex = (faceIndex + 1) % profile.azimuthSampleCount;
		return {
			faceIndex,
			vertex0Meters: profile.apexMeters,
			vertex1Meters: rimPoints[faceIndex],
			vertex2Meters: rimPoints[nextFaceIndex],
			fastFace: fastFaces[faceIndex] === 1,
			minAzimuthRadians: sampleIndexToAzimuthRadians(profile, faceIndex),
			maxAzimuthRadians: sampleIndexToAzimuthRadians(profile, nextFaceIndex),
		};
	});
}

/** Builds one explicit ray from a fictional cone sample. */
export function buildConeRay(profile: FictionalConeProfile, sampleIndex: number): FictionalConeRay {
	const rimPointMeters = buildConeRimPoints(profile)[sampleIndex];
	const deltaX = rimPointMeters[0] - profile.apexMeters[0];
	const deltaY = rimPointMeters[1] - profile.apexMeters[1];
	const deltaZ = rimPointMeters[2] - profile.apexMeters[2];
	const lengthMeters = Math.hypot(deltaX, deltaY, deltaZ);
	if (!(lengthMeters > 0)) {
		throw new RangeError('fictional cone rays must have a strictly positive length');
	}
	return {
		originMeters: profile.apexMeters,
		rimPointMeters,
		direction: [deltaX / lengthMeters, deltaY / lengthMeters, deltaZ / lengthMeters],
		azimuthRadians: sampleIndexToAzimuthRadians(profile, sampleIndex),
		lengthMeters,
		sampleIndex,
		alphaRadians: sampleAlphaRadians(profile, sampleIndex),
	};
}

/** Computes the top-view bearing from one apex to another in the XZ plane. */
export function bearingBetweenApexesRadians(fromMeters: Vector3, toMeters: Vector3): number {
	return wrapPositive(Math.atan2(toMeters[2] - fromMeters[2], toMeters[0] - fromMeters[0]));
}

/** Mirrors one azimuth around a top-view axis, keeping a circular `[0, 2 PI)` result. */
export function mirrorAzimuthAroundAxis(azimuthRadians: number, axisRadians: number): number {
	return wrapPositive(2 * wrapPositive(axisRadians) - wrapPositive(azimuthRadians));
}

/**
 * Builds a priority face window around the symmetric face and nearby fast faces.
 *
 * The returned order starts from the symmetric face, expands bilaterally, then
 * injects fast faces not already present, sorted by circular distance.
 */
export function buildPriorityFaceIndexes(
	profile: FictionalConeProfile,
	symmetricAzimuthRadians: number,
	bilateralNeighborhoodFaceCount: number,
): Uint32Array {
	if (!Number.isSafeInteger(bilateralNeighborhoodFaceCount) || bilateralNeighborhoodFaceCount < 0) {
		throw new RangeError('bilateralNeighborhoodFaceCount must be a non-negative safe integer');
	}
	const symmetricFaceIndex = azimuthToSampleIndex(symmetricAzimuthRadians, profile.azimuthSampleCount);
	const priorityIndexes: number[] = [symmetricFaceIndex];
	for (let offset = 1; offset <= bilateralNeighborhoodFaceCount; offset += 1) {
		priorityIndexes.push(
			positiveModulo(symmetricFaceIndex + offset, profile.azimuthSampleCount),
			positiveModulo(symmetricFaceIndex - offset, profile.azimuthSampleCount),
		);
	}

	const fastFaces = classifyFastFaces(profile);
	const fastIndexes = Array.from(fastFaces.entries())
		.filter(([, fast]) => fast === 1)
		.map(([faceIndex]) => faceIndex)
		.sort(
			(left, right) =>
				circularFaceDistance(left, symmetricFaceIndex, profile.azimuthSampleCount) -
					circularFaceDistance(right, symmetricFaceIndex, profile.azimuthSampleCount) ||
				left - right,
		);

	const unique = new Set<number>();
	const ordered: number[] = [];
	for (const faceIndex of [...priorityIndexes, ...fastIndexes]) {
		if (!unique.has(faceIndex)) {
			unique.add(faceIndex);
			ordered.push(faceIndex);
		}
	}
	return Uint32Array.from(ordered);
}

/** Intersects one source ray with every face of a target fictional cone. */
export function intersectRayWithConeFaces(
	sourceRay: FictionalConeRay,
	targetProfile: FictionalConeProfile,
): FictionalIntersectionHit[] {
	const hits: FictionalIntersectionHit[] = [];
	for (const face of buildConeFaces(targetProfile)) {
		const distanceMeters = intersectRayTriangleDoubleSided(
			sourceRay.originMeters,
			sourceRay.direction,
			face.vertex0Meters,
			face.vertex1Meters,
			face.vertex2Meters,
			sourceRay.lengthMeters,
		);
		if (distanceMeters === undefined) {
			continue;
		}
		hits.push({
			faceIndex: face.faceIndex,
			distanceMeters,
			pointMeters: [
				sourceRay.originMeters[0] + sourceRay.direction[0] * distanceMeters,
				sourceRay.originMeters[1] + sourceRay.direction[1] * distanceMeters,
				sourceRay.originMeters[2] + sourceRay.direction[2] * distanceMeters,
			],
		});
	}

	return hits.sort((left, right) => left.distanceMeters - right.distanceMeters || left.faceIndex - right.faceIndex);
}

/** Computes the full heuristic summary for one selected source ray and one target cone. */
export function analyzeRayRangeHeuristic(
	sourceProfile: FictionalConeProfile,
	targetProfile: FictionalConeProfile,
	sourceSampleIndex: number,
	bilateralNeighborhoodFaceCount: number,
): RayRangeHeuristicAnalysis {
	const sourceRay = buildConeRay(sourceProfile, sourceSampleIndex);
	const targetBearingRadians = bearingBetweenApexesRadians(targetProfile.apexMeters, sourceProfile.apexMeters);
	const symmetricAzimuthRadians = mirrorAzimuthAroundAxis(sourceRay.azimuthRadians, targetBearingRadians);
	const symmetricFaceIndex = azimuthToSampleIndex(symmetricAzimuthRadians, targetProfile.azimuthSampleCount);
	const priorityFaceIndexes = buildPriorityFaceIndexes(
		targetProfile,
		symmetricAzimuthRadians,
		bilateralNeighborhoodFaceCount,
	);
	const fastFaceIndexes = Uint32Array.from(
		Array.from(classifyFastFaces(targetProfile).entries())
			.filter(([, fast]) => fast === 1)
			.map(([faceIndex]) => faceIndex),
	);
	const allHits = intersectRayWithConeFaces(sourceRay, targetProfile);
	return {
		sourceRay,
		targetBearingRadians,
		symmetricAzimuthRadians,
		symmetricFaceIndex,
		priorityFaceIndexes,
		fastFaceIndexes,
		allHits,
		closestHit: allHits[0] ?? null,
	};
}

function validateProfile(profile: FictionalConeProfile): void {
	validateSampleCount(profile.azimuthSampleCount);
	if (!Number.isFinite(profile.roadAlphaRadians) || profile.roadAlphaRadians < 0 || profile.roadAlphaRadians >= PI / 2) {
		throw new RangeError('roadAlphaRadians must belong to [0, PI / 2[');
	}
	if (!Number.isFinite(profile.coneLengthMeters) || profile.coneLengthMeters <= 0) {
		throw new RangeError('coneLengthMeters must be finite and strictly positive');
	}
	if (
		profile.fastSectorWidthRadians !== undefined &&
		(!Number.isFinite(profile.fastSectorWidthRadians) || profile.fastSectorWidthRadians < 0 || profile.fastSectorWidthRadians > TWO_PI)
	) {
		throw new RangeError('fastSectorWidthRadians must belong to [0, 2 PI]');
	}
	if (
		profile.fastAlphaRadians !== undefined &&
		(!Number.isFinite(profile.fastAlphaRadians) || profile.fastAlphaRadians < 0 || profile.fastAlphaRadians >= PI / 2)
	) {
		throw new RangeError('fastAlphaRadians must belong to [0, PI / 2[');
	}
}

function validateSampleCount(azimuthSampleCount: number): void {
	if (!Number.isSafeInteger(azimuthSampleCount) || azimuthSampleCount < 3) {
		throw new RangeError('azimuthSampleCount must be a safe integer greater than or equal to 3');
	}
}

function validateSampleIndex(sampleIndex: number, azimuthSampleCount: number): void {
	validateSampleCount(azimuthSampleCount);
	if (!Number.isSafeInteger(sampleIndex) || sampleIndex < 0 || sampleIndex >= azimuthSampleCount) {
		throw new RangeError('sampleIndex must be a valid sample index');
	}
}

function positiveModulo(value: number, modulus: number): number {
	const remainder = value % modulus;
	return remainder < 0 ? remainder + modulus : remainder;
}

function circularFaceDistance(faceIndex: number, centerIndex: number, azimuthSampleCount: number): number {
	const delta = Math.abs(faceIndex - centerIndex);
	return Math.min(delta, azimuthSampleCount - delta);
}
