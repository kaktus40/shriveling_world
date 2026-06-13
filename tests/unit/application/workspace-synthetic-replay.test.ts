import { describe, expect, it } from 'vitest';
import {
	parseWorkspaceSyntheticHeuristicReplay,
	serializeWorkspaceSyntheticHeuristicReplay,
} from '$lib/application/workspace/synthetic-replay';

describe('workspace synthetic replay', () => {
	it('round-trips the replay payload', () => {
		const text = serializeWorkspaceSyntheticHeuristicReplay({
			cityCoordinatesText: '0 0\n1 1',
			cityLinksText: '0:0.4\n1:0.2',
			roadAlphaRadians: 0.35,
			azimuthSampleCount: 8,
			coneLengthMeters: 900,
			attenuationRadians: 0.25,
			sectorCount: 8,
			neighborLimit: 2,
			sweepWidths: [1, 2, 4],
		});

		expect(text).toContain('"version": 1');
		expect(parseWorkspaceSyntheticHeuristicReplay(text)).toEqual({
			cityCoordinatesText: '0 0\n1 1',
			cityLinksText: '0:0.4\n1:0.2',
			roadAlphaRadians: 0.35,
			azimuthSampleCount: 8,
			coneLengthMeters: 900,
			attenuationRadians: 0.25,
			sectorCount: 8,
			neighborLimit: 2,
			sweepWidths: [1, 2, 4],
		});
	});

	it('rejects invalid replay payloads', () => {
		expect(() => parseWorkspaceSyntheticHeuristicReplay('{"version":2}')).toThrow();
		expect(() => parseWorkspaceSyntheticHeuristicReplay('{"version":1,"input":{}}')).toThrow();
	});
});
