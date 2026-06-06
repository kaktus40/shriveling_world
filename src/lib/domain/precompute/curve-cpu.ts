import { EARTH_RADIUS_METERS } from '../../shared/constants';
import { intermediateNVector, readMatrixColumn3, readNVectorFromNed2Ecef } from '../../shared/spherical';
import { scale3 } from '../../shared/vector3';
import {
	CITY_NED2ECEF_MATRIX_STRIDE,
	CURVE_CONTROL_POINT_STRIDE,
	CURVE_EDGE_PAIR_STRIDE,
	type CityInvariantBuffers,
	type CurveControlBuffers,
	type KnownCurveEdge,
} from './types';

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
 * `P` and `Q` reproduce the historical construction: midpoint `M` is the
 * normalized interpolation of `A` and `B`; `P` is the midpoint of `A` and
 * `M`; `Q` is the midpoint of `M` and `B`.
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

function writeAlignedPoint(target: Float32Array, offset: number, point: readonly [number, number, number]): void {
	target[offset] = point[0];
	target[offset + 1] = point[1];
	target[offset + 2] = point[2];
	target[offset + 3] = 1;
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
