import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { composeWebGl2VertexShaderSource } from '$lib/compute/webgl2/programs';

const SHARED_MATH_DIR = resolve(process.cwd(), 'src/lib/compute/kernels/shared/math');
const KERNELS_DIR = resolve(process.cwd(), 'src/lib/compute/kernels');

function readShaderMathFile(fileName: string): string {
	return readFileSync(resolve(SHARED_MATH_DIR, fileName), 'utf8');
}

function readKernelFile(fileName: string): string {
	return readFileSync(resolve(KERNELS_DIR, fileName), 'utf8');
}

test('shared shader math mirrors the canonical helper set across WGSL and GLSL', () => {
	const wgsl = readShaderMathFile('webgpu.wgsl');
	const glsl = readShaderMathFile('webgl2.glsl');

	for (const helper of [
		'positive_angle',
		'positive_mod_i32',
		'signed_angle_delta',
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

test('pass shaders do not redefine the shared angular helpers locally', () => {
	const passShaders = [
		'boundary-algebre/webgl2.vert',
		'boundary-algebre/webgpu.wgsl',
		'city-ned2ecef/webgl2.vert',
		'city-ned2ecef/webgpu.wgsl',
		'ciseled-cones/webgl2.vert',
		'ciseled-cones/webgpu.wgsl',
		'curve-geometry/webgl2.vert',
		'curve-geometry/webgpu.wgsl',
		'final-cones/webgl2.vert',
		'final-cones/webgpu.wgsl',
		'raw-cone-alphas/webgl2.vert',
		'raw-cone-alphas/webgpu.wgsl',
	];
	const sharedHelpers = [
		'positive_angle',
		'positive_mod_i32',
		'signed_angle_delta',
		'shift_angle_near',
		'is_angle_inside_continuous_interval',
		'lonlat_from_nvector',
		'great_circle_from_bearing',
		'initial_bearing_radians',
		'angular_distance_radians',
	];

	for (const shaderFile of passShaders) {
		const source = readKernelFile(shaderFile);
		for (const helper of sharedHelpers) {
			expect(source).not.toMatch(new RegExp(`(?:fn|float|vec2|vec3|vec4)\\s+${helper}\\s*\\(`));
		}
	}
});

test('webgl2 vertex shader composition keeps version first and portable precision qualifiers', () => {
	const source = composeWebGl2VertexShaderSource(
		'#version 300 es\nvoid helper() {}',
		'void main() {}',
	);

	expect(source.startsWith('#version 300 es\n')).toBe(true);
	expect(source).toContain('precision highp float;');
	expect(source).toContain('precision highp int;');
	expect(source).toContain('precision highp sampler2D;');
	expect(source).toContain('precision highp isampler2D;');
	expect(source).toContain('precision highp usampler2D;');
	expect(source).not.toContain('precision highp uint;');
	expect(source.match(/#version 300 es/g)?.length).toBe(1);
});
