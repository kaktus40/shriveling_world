import { EARTH_RADIUS_METERS } from '../../../shared/constants';
import { angularDistanceRadians, intermediateNVector, readMatrixColumn3, readNVectorFromNed2Ecef } from '../../../shared/spherical';
import { normalize3, scale3 } from '../../../shared/vector3';
import {
	CITY_NED2ECEF_MATRIX_STRIDE,
	CURVE_CONTROL_POINT_STRIDE,
	CURVE_EDGE_PAIR_STRIDE,
	CURVE_GEOMETRY_VERTEX_STRIDE,
	type CurveGeometryInput,
	type CurveGeometryOptions,
	type CurvePosition,
	type CurvePrecompute,
	type CityInvariantBuffers,
	type CurveControlBuffers,
	type KnownCurveEdge,
	type PreparedCurve,
	type StaticTownPrecompute,
	type CurveVertexBuffer,
} from '../types';
import type { DatasetDiagnostic, PreparedDataset } from '../../data';

/**
 * Compacts already selected curve edges into dense origin/destination pairs.
 *
 * Selection of which business edges become curves belongs to dataset
 * preparation. This function preserves input order and duplicates because
 * distinct transport modes or source edges may share the same geometry.
 */
export function buildCurveEdgePairsCpu(edges: readonly KnownCurveEdge[], cityCount: number): Uint32Array {
	assertCityCount(cityCount);
	const curveEdgePairs = new Uint32Array(edges.length * CURVE_EDGE_PAIR_STRIDE);
	edges.forEach((edge, edgeIndex) => {
		assertCityIndex(edge.originCityIndex, cityCount, 'originCityIndex');
		assertCityIndex(edge.destinationCityIndex, cityCount, 'destinationCityIndex');
		if (edge.originCityIndex === edge.destinationCityIndex) {
			throw new RangeError('curve edges must connect two distinct cities');
		}
		const offset = edgeIndex * CURVE_EDGE_PAIR_STRIDE;
		curveEdgePairs[offset] = edge.originCityIndex;
		curveEdgePairs[offset + 1] = edge.destinationCityIndex;
	});
	return curveEdgePairs;
}

/**
 * Computes `[A, P, Q, B]` ECEF control points for known curve edges.
 *
 * `P` and `Q` follow the midpoint construction used by the current model:
 * midpoint `M` is the normalized interpolation of `A` and `B`; `P` is the
 * midpoint of `A` and `M`; `Q` is the midpoint of `M` and `B`.
 */
export function computeCurveControlPointsCpu(
	cityInvariants: CityInvariantBuffers,
	curveEdgePairs: Uint32Array,
): CurveControlBuffers {
	validateCityInvariantBuffers(cityInvariants);
	if (curveEdgePairs.length % CURVE_EDGE_PAIR_STRIDE !== 0) {
		throw new RangeError(`curveEdgePairs length must be a multiple of ${CURVE_EDGE_PAIR_STRIDE}`);
	}

	const curveCount = curveEdgePairs.length / CURVE_EDGE_PAIR_STRIDE;
	const curveControlPointsEcef = new Float32Array(curveCount * CURVE_CONTROL_POINT_STRIDE);
	for (let curveIndex = 0; curveIndex < curveCount; curveIndex += 1) {
		const pairOffset = curveIndex * CURVE_EDGE_PAIR_STRIDE;
		const originCityIndex = curveEdgePairs[pairOffset];
		const destinationCityIndex = curveEdgePairs[pairOffset + 1];
		assertCityIndex(originCityIndex, cityInvariants.cityCount, 'originCityIndex');
		assertCityIndex(destinationCityIndex, cityInvariants.cityCount, 'destinationCityIndex');
		if (originCityIndex === destinationCityIndex) {
			throw new RangeError('curve edges must connect two distinct cities');
		}

		const originNVector = readNVectorFromNed2Ecef(cityInvariants.cityNed2EcefMatrices, originCityIndex);
		const destinationNVector = readNVectorFromNed2Ecef(cityInvariants.cityNed2EcefMatrices, destinationCityIndex);
		const midpointNVector = intermediateNVector(originNVector, destinationNVector, 0.5);
		const pointPNVector = intermediateNVector(originNVector, midpointNVector, 0.5);
		const pointQNVector = intermediateNVector(midpointNVector, destinationNVector, 0.5);
		const controlOffset = curveIndex * CURVE_CONTROL_POINT_STRIDE;

		writeAlignedPoint(
			curveControlPointsEcef,
			controlOffset,
			readMatrixColumn3(cityInvariants.cityNed2EcefMatrices, originCityIndex, 3),
		);
		writeAlignedPoint(curveControlPointsEcef, controlOffset + 4, scale3(pointPNVector, EARTH_RADIUS_METERS));
		writeAlignedPoint(curveControlPointsEcef, controlOffset + 8, scale3(pointQNVector, EARTH_RADIUS_METERS));
		writeAlignedPoint(
			curveControlPointsEcef,
			controlOffset + 12,
			readMatrixColumn3(cityInvariants.cityNed2EcefMatrices, destinationCityIndex, 3),
		);
	}

	return { curveEdgePairs, curveControlPointsEcef };
}

/**
 * Prepares static curve data shared by CPU and GPU geometry passes.
 *
 * The result keeps curve order stable and stores yearly speed ratios so the
 * geometry pass can remain a dense sampling stage.
 */
export function prepareCurvePrecompute(
	preparedDataset: PreparedDataset,
	staticTown: StaticTownPrecompute,
): CurvePrecompute {
	validateCurvePrecomputeInputs(preparedDataset, staticTown);

	const curveCount = preparedDataset.curveEdgePairs.length / CURVE_EDGE_PAIR_STRIDE;
	const curveThetaRadians = new Float32Array(curveCount);
	const curves: PreparedCurve[] = [];
	const diagnostics: DatasetDiagnostic[] = [];
	const speedRatioByCurveByYear: Record<string, Float32Array> = {};

	for (let curveIndex = 0; curveIndex < curveCount; curveIndex += 1) {
		const pairOffset = curveIndex * CURVE_EDGE_PAIR_STRIDE;
		const controlOffset = curveIndex * CURVE_CONTROL_POINT_STRIDE;
		const originCityIndex = preparedDataset.curveEdgePairs[pairOffset];
		const destinationCityIndex = preparedDataset.curveEdgePairs[pairOffset + 1];
		const modeIndex = preparedDataset.curveEdgeModeIndexes[curveIndex];
		const edgeId = preparedDataset.curveEdgeIds[curveIndex];
		const originPoint = readCurveControlPoint(staticTown.curveControlPointsEcef, controlOffset, 0);
		const destinationPoint = readCurveControlPoint(staticTown.curveControlPointsEcef, controlOffset, 12);
		const thetaRadians = angularDistanceRadians(originPoint, destinationPoint);
		curveThetaRadians[curveIndex] = thetaRadians;
		curves.push({
			edgeIndex: curveIndex,
			edgeId,
			originCityIndex,
			destinationCityIndex,
			modeIndex,
			thetaRadians,
		});
	}

	const beginYear = preparedDataset.speedTimeline.span.beginYear;
	const endYear = preparedDataset.speedTimeline.span.endYear;
	for (let year = beginYear; year <= endYear; year += 1) {
		const yearKey = String(year);
		const ratioBuffer = new Float32Array(curveCount);
		const maxSpeed = preparedDataset.speedTimeline.maxSpeedMetersPerSecondByYear[yearKey];
		for (let curveIndex = 0; curveIndex < curveCount; curveIndex += 1) {
			const modeIndex = preparedDataset.curveEdgeModeIndexes[curveIndex];
			const modeId = preparedDataset.modeIds[modeIndex];
			const modeSpeed = preparedDataset.speedTimeline.speedByModeByYear[String(modeId)]?.[yearKey];
			if (!modeSpeed || !Number.isFinite(modeSpeed.speedMetersPerSecond) || modeSpeed.speedMetersPerSecond <= 0) {
				ratioBuffer[curveIndex] = Number.NaN;
				diagnostics.push({
					severity: 'warning',
					code: 'curve-speed-missing',
					year,
					curveIndex,
					modeIndex,
					modeId,
				});
				continue;
			}
			ratioBuffer[curveIndex] = maxSpeed / modeSpeed.speedMetersPerSecond;
		}
		speedRatioByCurveByYear[yearKey] = ratioBuffer;
	}

	return {
		curves,
		curveEdgePairs: preparedDataset.curveEdgePairs,
		curveEdgeIds: preparedDataset.curveEdgeIds,
		curveEdgeModeIndexes: preparedDataset.curveEdgeModeIndexes,
		curveControlPointsEcef: staticTown.curveControlPointsEcef,
		curveThetaRadians,
		speedRatioByCurveByYear,
		diagnostics,
	};
}

/**
 * Packs one year-specific curve geometry input for a CPU or GPU sampler.
 *
 * Curves without a finite speed ratio for the requested year are skipped so
 * the output remains dense and branch-light.
 */
export function prepareCurveGeometryInput(
	curvePrecompute: CurvePrecompute,
	options: CurveGeometryOptions,
): CurveGeometryInput {
	validateCurveGeometryOptions(options);
	const ratioBuffer = curvePrecompute.speedRatioByCurveByYear[String(options.year)];
	if (!ratioBuffer) {
		throw new RangeError(`curve year ${options.year} is not available in the precompute`);
	}

	const visibleCurveIndexes: number[] = [];
	for (let curveIndex = 0; curveIndex < curvePrecompute.curves.length; curveIndex += 1) {
		const ratio = ratioBuffer[curveIndex];
		if (Number.isFinite(ratio) && ratio > 0) {
			visibleCurveIndexes.push(curveIndex);
		}
	}

	const curveCount = visibleCurveIndexes.length;
	const curveIds = new Uint32Array(curveCount);
	const curveControlPointsEcef = new Float32Array(curveCount * CURVE_CONTROL_POINT_STRIDE);
	const curveThetaRadians = new Float32Array(curveCount);
	const curveSpeedRatio = new Float32Array(curveCount);

	visibleCurveIndexes.forEach((curveIndex, packedIndex) => {
		curveIds[packedIndex] = curvePrecompute.curves[curveIndex].edgeId;
		curveThetaRadians[packedIndex] = curvePrecompute.curveThetaRadians[curveIndex];
		curveSpeedRatio[packedIndex] = ratioBuffer[curveIndex];
		const sourceOffset = curveIndex * CURVE_CONTROL_POINT_STRIDE;
		const targetOffset = packedIndex * CURVE_CONTROL_POINT_STRIDE;
		curveControlPointsEcef.set(
			curvePrecompute.curveControlPointsEcef.subarray(sourceOffset, sourceOffset + CURVE_CONTROL_POINT_STRIDE),
			targetOffset,
		);
	});

	return {
		year: options.year,
		pointsPerCurve: options.pointsPerCurve,
		curvePosition: options.curvePosition,
		coefficient: options.coefficient,
		curveCount,
		curveIds,
		curveControlPointsEcef,
		curveThetaRadians,
		curveSpeedRatio,
	};
}

/** Computes render-ready curve vertices on the CPU reference profile. */
export function computeCurveVertexBufferCpu(input: CurveGeometryInput): CurveVertexBuffer {
	validateCurveGeometryInput(input);
	const vertexCount = input.curveCount * (input.pointsPerCurve + 1);
	const positions = new Float32Array(vertexCount * CURVE_GEOMETRY_VERTEX_STRIDE);
	const pointsPerCurve = input.pointsPerCurve;
	const coefficient = input.coefficient ?? 1;

	for (let packedCurveIndex = 0; packedCurveIndex < input.curveCount; packedCurveIndex += 1) {
		const controlOffset = packedCurveIndex * CURVE_CONTROL_POINT_STRIDE;
		const thetaRadians = input.curveThetaRadians[packedCurveIndex];
		const speedRatio = input.curveSpeedRatio[packedCurveIndex];
		const curveHeightMeters = computeCurveHeightMeters(
			speedRatio,
			thetaRadians,
			input.curvePosition,
			coefficient,
		);
		const pointA = readCurveControlPoint(input.curveControlPointsEcef, controlOffset, 0);
		const pointP = liftCurveControlPoint(readCurveControlPoint(input.curveControlPointsEcef, controlOffset, 4), curveHeightMeters);
		const pointQ = liftCurveControlPoint(readCurveControlPoint(input.curveControlPointsEcef, controlOffset, 8), curveHeightMeters);
		const pointB = readCurveControlPoint(input.curveControlPointsEcef, controlOffset, 12);

		for (let sampleIndex = 0; sampleIndex <= pointsPerCurve; sampleIndex += 1) {
			const t = pointsPerCurve === 0 ? 0 : sampleIndex / pointsPerCurve;
			const position = sampleCubicBezier(pointA, pointP, pointQ, pointB, t);
			const outputOffset = (packedCurveIndex * (pointsPerCurve + 1) + sampleIndex) * CURVE_GEOMETRY_VERTEX_STRIDE;
			positions[outputOffset] = position[0];
			positions[outputOffset + 1] = position[1];
			positions[outputOffset + 2] = position[2];
			positions[outputOffset + 3] = 1;
		}
	}

	return {
		curveCount: input.curveCount,
		pointsPerCurve,
		positions,
	};
}

function writeAlignedPoint(target: Float32Array, offset: number, point: readonly [number, number, number]): void {
	target[offset] = point[0];
	target[offset + 1] = point[1];
	target[offset + 2] = point[2];
	target[offset + 3] = 1;
}

function readCurveControlPoint(buffer: Float32Array, curveOffset: number, pointOffset: number): [number, number, number] {
	return [buffer[curveOffset + pointOffset], buffer[curveOffset + pointOffset + 1], buffer[curveOffset + pointOffset + 2]];
}

function liftCurveControlPoint(point: readonly [number, number, number], curveHeightMeters: number): readonly [number, number, number] {
	const direction = normalize3(point);
	return scale3(direction, EARTH_RADIUS_METERS + curveHeightMeters);
}

function sampleCubicBezier(
	p0: readonly [number, number, number],
	p1: readonly [number, number, number],
	p2: readonly [number, number, number],
	p3: readonly [number, number, number],
	t: number,
): [number, number, number] {
	const minusT = 1 - t;
	const minusTSquared = minusT * minusT;
	const tSquared = t * t;
	return [
		minusT * minusTSquared * p0[0] + 3 * minusTSquared * t * p1[0] + 3 * minusT * tSquared * p2[0] + t * tSquared * p3[0],
		minusT * minusTSquared * p0[1] + 3 * minusTSquared * t * p1[1] + 3 * minusT * tSquared * p2[1] + t * tSquared * p3[1],
		minusT * minusTSquared * p0[2] + 3 * minusTSquared * t * p1[2] + 3 * minusT * tSquared * p2[2] + t * tSquared * p3[2],
	];
}

function computeCurveHeightMeters(
	speedRatio: number,
	thetaRadians: number,
	curvePosition: CurvePosition,
	coefficient: number,
): number {
	if (!Number.isFinite(speedRatio) || speedRatio <= 0) {
		throw new RangeError('curve speedRatio must be finite and strictly positive');
	}
	if (!Number.isFinite(thetaRadians) || thetaRadians <= 0) {
		throw new RangeError('curve theta must be finite and strictly positive');
	}
	if (!Number.isFinite(coefficient) || coefficient <= 0) {
		throw new RangeError('curve coefficient must be finite and strictly positive');
	}

	const semiTheta = thetaRadians / 2;
	const sinSemiTheta = Math.sin(semiTheta);
	const cosSemiTheta = Math.cos(semiTheta);
	const ratio = (speedRatio * thetaRadians) / 2;
	const squared = ratio * ratio - sinSemiTheta * sinSemiTheta;
	const secondTerm = Math.sqrt(Math.max(0, squared));
	const omPrime = (cosSemiTheta + secondTerm) * EARTH_RADIUS_METERS * coefficient;
	const height = omPrime - EARTH_RADIUS_METERS;
	return curvePosition === 'above' ? height : -height;
}

function validateCurvePrecomputeInputs(
	preparedDataset: PreparedDataset,
	staticTown: StaticTownPrecompute,
): void {
	if (preparedDataset.curveEdgePairs.length % CURVE_EDGE_PAIR_STRIDE !== 0) {
		throw new RangeError(`curveEdgePairs length must be a multiple of ${CURVE_EDGE_PAIR_STRIDE}`);
	}
	if (preparedDataset.curveEdgeIds.length !== preparedDataset.curveEdgePairs.length / CURVE_EDGE_PAIR_STRIDE) {
		throw new RangeError('curveEdgeIds length must match curveEdgePairs');
	}
	if (preparedDataset.curveEdgeModeIndexes.length !== preparedDataset.curveEdgePairs.length / CURVE_EDGE_PAIR_STRIDE) {
		throw new RangeError('curveEdgeModeIndexes length must match curveEdgePairs');
	}
	if (staticTown.curveControlPointsEcef.length !== preparedDataset.curveEdgePairs.length / CURVE_EDGE_PAIR_STRIDE * CURVE_CONTROL_POINT_STRIDE) {
		throw new RangeError('curveControlPointsEcef length must match curveEdgePairs');
	}
}

function validateCurveGeometryOptions(options: CurveGeometryOptions): void {
	if (!Number.isSafeInteger(options.pointsPerCurve) || options.pointsPerCurve < 1) {
		throw new RangeError('pointsPerCurve must be a safe integer greater than or equal to 1');
	}
	if (!Number.isFinite(options.year)) {
		throw new RangeError('year must be finite');
	}
	if (!['above', 'below', 'below-when-possible', 'stick-to-cone'].includes(options.curvePosition)) {
		throw new RangeError('curvePosition must be a supported curve placement');
	}
	if (options.coefficient !== undefined && (!Number.isFinite(options.coefficient) || options.coefficient <= 0)) {
		throw new RangeError('curve coefficient must be finite and strictly positive when provided');
	}
}

function validateCurveGeometryInput(input: CurveGeometryInput): void {
	validateCurveGeometryOptions(input);
	if (!Number.isSafeInteger(input.curveCount) || input.curveCount < 0) {
		throw new RangeError('curveCount must be a non-negative safe integer');
	}
	const expectedControlsLength = input.curveCount * CURVE_CONTROL_POINT_STRIDE;
	if (input.curveControlPointsEcef.length !== expectedControlsLength) {
		throw new RangeError('curveControlPointsEcef length must match curveCount');
	}
	if (input.curveThetaRadians.length !== input.curveCount) {
		throw new RangeError('curveThetaRadians length must match curveCount');
	}
	if (input.curveSpeedRatio.length !== input.curveCount) {
		throw new RangeError('curveSpeedRatio length must match curveCount');
	}
	if (input.curveIds.length !== input.curveCount) {
		throw new RangeError('curveIds length must match curveCount');
	}
}

function validateCityInvariantBuffers(cityInvariants: CityInvariantBuffers): void {
	assertCityCount(cityInvariants.cityCount);
	if (cityInvariants.cityNed2EcefMatrices.length !== cityInvariants.cityCount * CITY_NED2ECEF_MATRIX_STRIDE) {
		throw new RangeError('cityNed2EcefMatrices length does not match cityCount');
	}
}

function assertCityCount(cityCount: number): void {
	if (!Number.isSafeInteger(cityCount) || cityCount < 0) {
		throw new RangeError('cityCount must be a non-negative safe integer');
	}
}

function assertCityIndex(cityIndex: number, cityCount: number, name: string): void {
	if (!Number.isSafeInteger(cityIndex) || cityIndex < 0 || cityIndex >= cityCount) {
		throw new RangeError(`${name} must be a valid city index`);
	}
}
