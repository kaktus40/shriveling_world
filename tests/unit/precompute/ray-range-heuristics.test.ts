import { describe, expect, it } from 'vitest';

import {
	analyzeRayRangeHeuristic,
	buildPriorityFaceIndexes,
	degreesToRadians,
	radiansToDegrees,
	type FictionalConeProfile,
	wrapPositive,
	wrapSigned
} from '$lib/testing/ray-range-heuristics';

function createProfile(overrides: Partial<FictionalConeProfile> = {}): FictionalConeProfile {
	return {
		id: 'profile',
		apexMeters: [0, 0, 0],
		azimuthOffsetRadians: 0,
		coneLengthMeters: 10,
		roadAlphaRadians: degreesToRadians(30),
		azimuthSampleCount: 8,
		...overrides
	};
}

describe('ray-range heuristics helper', () => {
	it('converts angles and wraps them consistently', () => {
		expect(degreesToRadians(180)).toBeCloseTo(Math.PI);
		expect(radiansToDegrees(Math.PI / 2)).toBeCloseTo(90);
		expect(wrapPositive(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2);
		expect(wrapSigned((3 * Math.PI) / 2)).toBeCloseTo(-Math.PI / 2);
	});

	it('prioritizes the symmetric face then bilateral neighbors and fast faces', () => {
		const profile = createProfile({
			fastSectorCenterRadians: 0,
			fastSectorWidthRadians: degreesToRadians(90),
			fastAlphaRadians: degreesToRadians(10)
		});

		expect(Array.from(buildPriorityFaceIndexes(profile, 0, 1))).toEqual([0, 1, 7, 6]);
	});

	it('finds and orders intersections for a simple opposing-cone setup', () => {
		const source = createProfile();
		const target = createProfile({
			id: 'target',
			apexMeters: [8, 0, 0]
		});

		const analysis = analyzeRayRangeHeuristic(source, target, 0, 1);

		expect(Array.from(analysis.priorityFaceIndexes)).toEqual([0, 1, 7]);
		expect(analysis.allHits).toHaveLength(1);
		expect(analysis.closestHit?.faceIndex).toBe(4);
		expect(analysis.closestHit?.distanceMeters).toBeGreaterThan(0);
		expect(analysis.closestHit?.pointMeters[0]).toBeCloseTo(4);
		expect(analysis.closestHit?.pointMeters[1]).toBeGreaterThan(0);
	});
});
