import { expect, test } from 'vitest';

import { isAngleInsideContinuousInterval, positiveAngle, positiveModulo, signedAngleDelta } from '$lib/shared/math';

test('shared angle helpers normalize and compare radians consistently', () => {
	expect(positiveModulo(-1, 8)).toBe(7);
	expect(positiveAngle(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2);
	expect(signedAngleDelta((3 * Math.PI) / 2)).toBeCloseTo(-Math.PI / 2);
	expect(signedAngleDelta(Math.PI / 2)).toBeCloseTo(Math.PI / 2);
	expect(isAngleInsideContinuousInterval(Math.PI, Math.PI / 2, (3 * Math.PI) / 2)).toBe(true);
	expect(isAngleInsideContinuousInterval(0, Math.PI / 2, (3 * Math.PI) / 2)).toBe(false);
});
