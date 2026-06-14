import { expect, test } from 'vitest';

import { probeBabylonContext } from '$lib/application/app/babylon';

test('babylon probe returns true when the probe canvas can create webgl2', () => {
	const fakeCanvas = {
		getContext: (kind: string) => (kind === 'webgl2' ? {} : null),
	};

	expect(probeBabylonContext(fakeCanvas as unknown as HTMLCanvasElement)).toBe(true);
});

test('babylon probe returns false when the probe canvas cannot create any webgl context', () => {
	const fakeCanvas = {
		getContext: () => null,
	};

	expect(probeBabylonContext(fakeCanvas as unknown as HTMLCanvasElement)).toBe(false);
});
