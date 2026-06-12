/** Shared WebGL2 texture packing helpers for pass-local resource builders. */
/** Creates a floating-point 2D texture with nearest filtering and clamp-to-edge wrap. */
export function createFloatTexture2D(
	gl: WebGL2RenderingContext,
	internalFormat: number,
	format: number,
	width: number,
	height: number,
	data: Float32Array,
): WebGLTexture {
	return createTexture2D(gl, internalFormat, width, height, format, gl.FLOAT, data);
}

/** Creates an integer 2D texture with nearest filtering and clamp-to-edge wrap. */
export function createIntTexture2D(
	gl: WebGL2RenderingContext,
	internalFormat: number,
	format: number,
	type: number,
	width: number,
	height: number,
	data: ArrayBufferView,
): WebGLTexture {
	return createTexture2D(gl, internalFormat, width, height, format, type, data);
}

/** Creates a 2D texture and uploads the provided packed data. */
export function createTexture2D(
	gl: WebGL2RenderingContext,
	internalFormat: number,
	width: number,
	height: number,
	format: number,
	type: number,
	data: ArrayBufferView,
): WebGLTexture {
	const texture = gl.createTexture();
	if (!texture) {
		throw new Error('WebGL2 texture creation failed');
	}
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, data);
	gl.bindTexture(gl.TEXTURE_2D, null);
	return texture;
}

/** Packs one scalar per pixel into an RGBA float texture payload. */
export function packScalarsAsRgba(values: Float32Array): Float32Array {
	const packed = new Float32Array(values.length * 4);
	for (let index = 0; index < values.length; index += 1) {
		packed[index * 4] = values[index];
	}
	return packed;
}

/** Packs one scalar per pixel into an RGBA unsigned integer texture payload. */
export function packScalarsAsUintRgba(values: Uint32Array): Uint32Array {
	const packed = new Uint32Array(values.length * 4);
	for (let index = 0; index < values.length; index += 1) {
		packed[index * 4] = values[index];
	}
	return packed;
}
