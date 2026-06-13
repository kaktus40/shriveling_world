import { describe, expect, it } from 'vitest';
import {
	buildClusterSyntheticPreset,
	buildCorridorSyntheticPreset,
	buildRandomSyntheticPreset,
} from '$lib/application/workspace/synthetic-presets';

describe('workspace synthetic presets', () => {
	it('generates city and link rows for the random preset', () => {
		const preset = buildRandomSyntheticPreset(4, 3);
		expect(preset.cityCoordinatesText.split('\n')).toHaveLength(4);
		expect(preset.cityLinksText.split('\n')).toHaveLength(4);
	});

	it('generates structured shapes for corridor and cluster presets', () => {
		const corridor = buildCorridorSyntheticPreset(5, 2);
		const cluster = buildClusterSyntheticPreset(5, 2);

		expect(corridor.cityCoordinatesText.split('\n')).toHaveLength(5);
		expect(cluster.cityCoordinatesText.split('\n')).toHaveLength(5);
		expect(corridor.cityLinksText.split('\n')).toHaveLength(5);
		expect(cluster.cityLinksText.split('\n')).toHaveLength(5);
		expect(corridor.cityCoordinatesText).not.toBe(cluster.cityCoordinatesText);
	});
});
