export { compareFloat32Buffers } from '../shared/validation';

/** Reads back a float buffer from WebGL2 when the API is available. */
export function readBackFloat32Buffer(
	gl: WebGL2RenderingContext,
	target: number,
	buffer: WebGLBuffer,
	length: number,
): Float32Array | null {
	if (typeof gl.getBufferSubData !== 'function') {
		return null;
	}
	const output = new Float32Array(length);
	gl.bindBuffer(target, buffer);
	gl.getBufferSubData(target, 0, output);
	gl.bindBuffer(target, null);
	return output;
}
