import type { LonLatDegrees } from './types';

const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;

/** Converts degrees to radians. */
export function degreesToRadians(value: number): number {
	return (value * Math.PI) / 180;
}

/** Returns a copy of a ring without a duplicated closing point. */
export function openRing(ring: LonLatDegrees[]): LonLatDegrees[] {
	if (ring.length < 2) {
		return [...ring];
	}
	const first = ring[0];
	const last = ring[ring.length - 1];
	if (first[0] === last[0] && first[1] === last[1]) {
		return ring.slice(0, -1);
	}
	return [...ring];
}

/** Computes a planar bounding box `[lonMin, lonMax, latMin, latMax]` for degree coordinates. */
export function boundingBox(points: LonLatDegrees[]): [number, number, number, number] {
	let lonMin = Infinity;
	let lonMax = -Infinity;
	let latMin = Infinity;
	let latMax = -Infinity;

	points.forEach(([longitude, latitude]) => {
		lonMin = Math.min(lonMin, longitude);
		lonMax = Math.max(lonMax, longitude);
		latMin = Math.min(latMin, latitude);
		latMax = Math.max(latMax, latitude);
	});

	return [lonMin, lonMax, latMin, latMax];
}

/** Returns true when a point belongs to a polygon ring using the crossing-number rule. */
export function pointInRing(point: LonLatDegrees, ring: LonLatDegrees[]): boolean {
	let inside = false;
	const [pointLon, pointLat] = point;
	const openedRing = openRing(ring);
	const length = openedRing.length;

	for (let index = 0; index < length; index++) {
		const [lonA, latA] = openedRing[index];
		const [lonB, latB] = openedRing[(index + 1) % length];
		const crossesLatitude = (latA > pointLat) !== (latB > pointLat);
		if (crossesLatitude) {
			const lonAtLatitude = ((lonB - lonA) * (pointLat - latA)) / (latB - latA) + lonA;
			if (pointLon < lonAtLatitude) {
				inside = !inside;
			}
		}
	}

	return inside;
}

/** Interpolates one contour so no segment exceeds the requested planar degree length. */
export function densifyRing(ring: LonLatDegrees[], maxSegmentDegrees: number): LonLatDegrees[] {
	const openedRing = openRing(ring);
	if (openedRing.length < 2 || maxSegmentDegrees <= 0) {
		return openedRing;
	}

	const result: LonLatDegrees[] = [];
	for (let index = 0; index < openedRing.length; index++) {
		const current = openedRing[index];
		const next = openedRing[(index + 1) % openedRing.length];
		result.push(current);

		const deltaLon = next[0] - current[0];
		const deltaLat = next[1] - current[1];
		const distance = Math.sqrt(deltaLon * deltaLon + deltaLat * deltaLat);
		const insertedCount = Math.max(0, Math.ceil(distance / maxSegmentDegrees) - 1);
		for (let inserted = 1; inserted <= insertedCount; inserted++) {
			const ratio = inserted / (insertedCount + 1);
			result.push([current[0] + deltaLon * ratio, current[1] + deltaLat * ratio]);
		}
	}

	return result;
}

/** Generates candidate interior points using the Fibonacci-lattice strategy from the historical code. */
export function fibonacciLattice(
	spacingDegrees: number,
	[lonMin, lonMax, latMin, latMax]: [number, number, number, number]
): LonLatDegrees[] {
	if (spacingDegrees <= 0) {
		return [];
	}

	const pointCount = Math.max(1, Math.round((360 / spacingDegrees) ** 2 / Math.PI));
	const longitudeAt = (index: number) => (((index / GOLDEN_RATIO) * 360) % 360) - 180;
	const latitudeAt = (index: number) => Math.acos((2 * index) / pointCount - 1) * (180 / Math.PI) - 90;
	const indexAtLatitude = (latitude: number) => (pointCount * (Math.cos((latitude + 90) * (Math.PI / 180)) + 1)) / 2;

	const firstIndex = Math.max(0, Math.ceil(indexAtLatitude(latMax)));
	const lastIndex = Math.min(pointCount - 1, Math.floor(indexAtLatitude(latMin)));
	const points: LonLatDegrees[] = [];

	for (let index = firstIndex; index <= lastIndex; index++) {
		const longitude = longitudeAt(index);
		if (longitude >= lonMin && longitude <= lonMax) {
			points.push([longitude, latitudeAt(index)]);
		}
	}

	return points;
}

/** Generates interior points that belong to the provided ring. */
export function generateInteriorPoints(ring: LonLatDegrees[], spacingDegrees: number): LonLatDegrees[] {
	const box = boundingBox(ring);
	return fibonacciLattice(spacingDegrees, box).filter((point) => pointInRing(point, ring));
}

/** Returns the centroid of one triangle represented by three point indexes. */
export function triangleCentroid(points: LonLatDegrees[], indexA: number, indexB: number, indexC: number): LonLatDegrees {
	const pointA = points[indexA];
	const pointB = points[indexB];
	const pointC = points[indexC];
	return [(pointA[0] + pointB[0] + pointC[0]) / 3, (pointA[1] + pointB[1] + pointC[1]) / 3];
}

