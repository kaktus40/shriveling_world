import { describe, expect, it } from 'vitest';
import { benchmarkSyntheticAlphaAwareHeuristic } from '$lib/application/workspace/synthetic';

describe('workspace synthetic heuristic', () => {
	it('compares alpha-aware order and block pruning on synthetic inputs', () => {
		const report = benchmarkSyntheticAlphaAwareHeuristic({
			cityCoordinatesText: `0 0
0.1 0.05
0.2 -0.05`,
			cityLinksText: `0:0.4; 1.0:0.5
1:0.2; 2.1:0.45
2:0.3; 3.0:0.55`,
			roadAlphaRadians: 0.35,
			azimuthSampleCount: 8,
			coneLengthMeters: 900,
			attenuationRadians: 0.25,
			sectorCount: 8,
			neighborLimit: 2,
			sweepWidths: [1, 2],
		});

		expect(report.staticTown.cityCount).toBe(3);
		expect(report.dynamicTown.cityLinkCounts.reduce((sum, count) => sum + count, 0)).toBe(6);
		expect(report.cases).toHaveLength(2);
		for (const sweepCase of report.cases) {
			expect(sweepCase.blockPruned.testedFaceCount).toBeLessThanOrEqual(sweepCase.order.testedFaceCount);
		}
		expect(report.roadAlphaRadians).toBeCloseTo(0.35);
		expect(report.alphaEpsilonRadians).toBeCloseTo(0.25);
	});
});
