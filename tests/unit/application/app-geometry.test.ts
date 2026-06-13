import { describe, expect, it } from 'vitest';
import { projectCityToAppPoint } from '$lib/application/app/geometry';

describe('projectCityToAppPoint', () => {
	it('maps the zero meridian on the positive x axis', () => {
		expect(projectCityToAppPoint(0, 0, 10)).toEqual([10, -0, 0]);
	});

	it('keeps latitude as the vertical component', () => {
		const [x, y, z] = projectCityToAppPoint(Math.PI / 2, Math.PI / 6, 8);
		expect(x).toBeCloseTo(0);
		expect(y).toBeCloseTo(-6.928203230275509);
		expect(z).toBeCloseTo(4);
	});
});
