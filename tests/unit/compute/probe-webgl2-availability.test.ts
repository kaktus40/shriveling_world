import { expect, test } from 'vitest';
import { probeWebGl2Availability } from '$lib/compute/webgl2/backend';

function createFailingGl(): WebGL2RenderingContext {
	const shader = {} as WebGLShader;
	const program = {} as WebGLProgram;
	return {
		VERTEX_SHADER: 0x8b31,
		FRAGMENT_SHADER: 0x8b30,
		COMPILE_STATUS: 0x8b81,
		LINK_STATUS: 0x8b82,
		INTERLEAVED_ATTRIBS: 0x8c8c,
		SEPARATE_ATTRIBS: 0x8c8d,
		createShader: () => shader,
		shaderSource: () => {},
		compileShader: () => {},
		getShaderParameter: () => false, // force compile failure
		getShaderInfoLog: () => 'compile failed',
		deleteShader: () => {},
		createProgram: () => program,
		attachShader: () => {},
		transformFeedbackVaryings: () => {},
		linkProgram: () => {},
		getProgramParameter: () => false, // force link failure
		getProgramInfoLog: () => 'link failed',
		deleteProgram: () => {},
		getUniformLocation: () => null,
		createBuffer: () => ({} as WebGLBuffer),
		bindBuffer: () => {},
		bufferData: () => {},
		createVertexArray: () => ({} as WebGLVertexArrayObject),
		bindVertexArray: () => {},
		enableVertexAttribArray: () => {},
		vertexAttribPointer: () => {},
		createTransformFeedback: () => ({} as WebGLTransformFeedback),
		bindTransformFeedback: () => {},
		bindBufferBase: () => {},
		createTexture: () => ({} as WebGLTexture),
		bindTexture: () => {},
		texParameteri: () => {},
		texImage2D: () => {},
		activeTexture: () => {},
		pixelStorei: () => {},
		uniform1i: () => {},
		uniform4f: () => {},
		useProgram: () => {},
		uniform1f: () => {},
		getBufferSubData: () => {},
		enable: () => {},
		disable: () => {},
		beginTransformFeedback: () => {},
		drawArrays: () => {},
		drawArraysInstanced: () => {},
		endTransformFeedback: () => {},
		finish: () => {},
	} as unknown as WebGL2RenderingContext;
}

function createCanvasWithGl(gl: WebGL2RenderingContext) {
	return {
		getContext: (kind: string) => (kind === 'webgl2' ? gl : null),
	} as unknown as HTMLCanvasElement;
}

test('probe returns false when shader compilation or linking fails', () => {
	const failingGl = createFailingGl();
	const canvas = createCanvasWithGl(failingGl);
	expect(probeWebGl2Availability(canvas)).toBe(false);
});

test('probe returns false when no canvas provided', () => {
	expect(probeWebGl2Availability(undefined)).toBe(false);
});
