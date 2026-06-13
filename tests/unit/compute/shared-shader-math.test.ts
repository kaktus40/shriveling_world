import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

const SHARED_MATH_DIR = resolve(process.cwd(), 'src/lib/compute/kernels/shared/math');

function readShaderMathFile(fileName: string): string {
	return readFileSync(resolve(SHARED_MATH_DIR, fileName), 'utf8');
}

test('shared shader math mirrors the canonical helper set across WGSL and GLSL', () => {
	const wgsl = readShaderMathFile('webgpu.wgsl');
	const glsl = readShaderMathFile('webgl2.glsl');

	for (const helper of [
		'positive_angle',
		'shift_angle_near',
		'is_angle_inside_continuous_interval',
		'lonlat_from_nvector',
		'great_circle_from_bearing',
		'initial_bearing_radians',
		'angular_distance_radians',
	]) {
		expect(wgsl).toContain(helper);
		expect(glsl).toContain(helper);
	}

	for (const constant of ['PI', 'TWO_PI', 'ANGULAR_EPSILON']) {
		expect(wgsl).toContain(constant);
		expect(glsl).toContain(constant);
	}
});
