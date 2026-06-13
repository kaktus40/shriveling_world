import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, test } from 'vitest';

function loadText(path: string): string {
	return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('shared projection kernel snippets', () => {
	test('webgpu and webgl2 snippets contain the canonical projection helpers', () => {
		const webgpu = loadText('../../../src/lib/compute/kernels/shared/projection/webgpu.wgsl');
		const webgl2 = loadText('../../../src/lib/compute/kernels/shared/projection/webgl2.glsl');
		for (const snippet of [webgpu, webgl2]) {
			assert.ok(snippet.includes('project_globe'));
			assert.ok(snippet.includes('project_equirectangular'));
			assert.ok(snippet.includes('project_mercator'));
			assert.ok(snippet.includes('project_winkel_tripel'));
			assert.ok(snippet.includes('project_eckert_vi'));
			assert.ok(snippet.includes('project_van_der_grinten_i'));
			assert.ok(snippet.includes('project_conic_equidistant'));
			assert.ok(snippet.includes('project_display'));
		}
	});
});
