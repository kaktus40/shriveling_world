import { expect, test } from 'vitest';

import { runWebGl2FinalConePass } from '$lib/compute/webgl2/passes/final-cones';
import type { ComputeResult } from '$lib/compute/core';
import type { WebGl2ComputeResources } from '$lib/compute/webgl2/types';

function createFakeGl(): WebGL2RenderingContext {
	const shader = {} as WebGLShader;
	const program = {} as WebGLProgram;
	const buffer = {} as WebGLBuffer;
	const vao = {} as WebGLVertexArrayObject;
	const transformFeedback = {} as WebGLTransformFeedback;
	const uniformLocation = {} as WebGLUniformLocation;
	return {
		VERTEX_SHADER: 0x8b31,
		FRAGMENT_SHADER: 0x8b30,
		COMPILE_STATUS: 0x8b81,
		LINK_STATUS: 0x8b82,
		ARRAY_BUFFER: 0x8892,
		TRANSFORM_FEEDBACK_BUFFER: 0x8c8e,
		STATIC_DRAW: 0x88e4,
		DYNAMIC_COPY: 0x88ea,
		POINTS: 0x0000,
		RASTERIZER_DISCARD: 0x8c89,
		TRANSFORM_FEEDBACK: 0x8e22,
		FLOAT: 0x1406,
		createShader: () => shader,
		shaderSource: () => {},
		compileShader: () => {},
		getShaderParameter: () => true,
		getShaderInfoLog: () => '',
		deleteShader: () => {},
		createProgram: () => program,
		attachShader: () => {},
		transformFeedbackVaryings: () => {},
		linkProgram: () => {},
		getProgramParameter: () => true,
		getProgramInfoLog: () => '',
		deleteProgram: () => {},
		getUniformLocation: () => uniformLocation,
		createBuffer: () => buffer,
		bindBuffer: () => {},
		bufferData: () => {},
		createVertexArray: () => vao,
		bindVertexArray: () => {},
		enableVertexAttribArray: () => {},
		vertexAttribPointer: () => {},
		vertexAttribDivisor: () => {},
		createTransformFeedback: () => transformFeedback,
		bindTransformFeedback: () => {},
		bindBufferBase: () => {},
		useProgram: () => {},
		uniform4f: () => {},
		enable: () => {},
		disable: () => {},
		beginTransformFeedback: () => {},
		drawArraysInstanced: () => {},
		endTransformFeedback: () => {},
		finish: () => {},
		getBufferSubData: (_target: number, _offset: number, output: ArrayBufferView) => {
			if (output instanceof Float32Array) {
				output.fill(1234.5);
			}
		},
	} as unknown as WebGL2RenderingContext;
}

test('final-cones readback comparison reports mismatches when the buffer diverges', async () => {
	const gl = createFakeGl();
	const resources = {
		pipeline: {} as WebGl2ComputeResources['pipeline'],
		programCache: new Map<string, WebGLProgram>([['final-cones', {} as WebGLProgram]]),
	} as unknown as WebGl2ComputeResources;

	const result = {
		staticTown: {
			cityCount: 1,
		},
		geojsonRuns: [
			{
				boundaryRaycast: {
					azimuthIntervalCount: 1,
					townBoundaryAngular: new Float32Array([0, 0, 0, 1]),
					townBoundaryEcef: new Float32Array([0, 0, 0, 1]),
				},
				finalCones: {
					cityCount: 1,
					azimuthSampleCount: 1,
					finalConeGeometryEcef: new Float32Array([1, 2, 3, 1]),
				},
			},
		],
	} as unknown as ComputeResult;

	const output = await runWebGl2FinalConePass({
		gl,
		result,
		geojsonRun: result.geojsonRuns[0],
		ciseledConeRimEcefBuffer: {} as WebGLBuffer,
		townBoundaryAngularBuffer: {} as WebGLBuffer,
		townBoundaryEcefBuffer: {} as WebGLBuffer,
		resources,
	});

	expect(output.diagnostics.some((diagnostic) => diagnostic.code === 'webgl2-final-cone-geometry-mismatch')).toBe(true);
});
