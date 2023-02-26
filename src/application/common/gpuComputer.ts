'use strict';
import {
	TextureOptions,
	BufferInfo,
	FramebufferInfo,
	ProgramInfo,
	addExtensionsToContext,
	createBufferInfoFromArrays,
	createTextures,
	setTextureFromArray,
	resizeFramebufferInfo,
	setAttribInfoBufferFromArray,
	bindFramebufferInfo,
	setBuffersAndAttributes,
	setUniforms,
	drawBufferInfo,
	createProgramInfo,
	createFramebufferInfo,
} from 'twgl.js';

declare class OffscreenCanvas extends HTMLCanvasElement {
	constructor(width: number, height: number);
}
export type internalFormatType =
	| 'R8'
	| 'R32F'
	| 'R16UI'
	| 'R16I'
	| 'R32UI'
	| 'R32I'
	| 'RG8'
	| 'RG32F'
	| 'RG16UI'
	| 'RG16I'
	| 'RG32UI'
	| 'RG32I'
	| 'RGB8'
	| 'RGB32F'
	| 'RGB16UI'
	| 'RGB16I'
	| 'RGB32UI'
	| 'RGB32I'
	| 'RGBA8'
	| 'RGBA32F'
	| 'RGBA16UI'
	| 'RGBA16I'
	| 'RGBA32UI'
	| 'RGBA32I';

const vertexCode =
	'#version 300 es\n' +
	'in vec2 position;\n' +
	'in vec2 texture;\n' +
	'out vec2 pos;\n' +
	'void main(void) {\n' +
	'  pos = texture;\n' +
	'  gl_Position = vec4(position.xy, 0.0, 1.0);\n' +
	'}\n';

const _gl = (
	typeof OffscreenCanvas === 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(256, 256)
).getContext('webgl2', { antialias: false });
addExtensionsToContext(<WebGLRenderingContext>_gl);
const _attributesInfo = createBufferInfoFromArrays(<WebGLRenderingContext>_gl, {
	position: { numComponents: 2, data: [-1, -1, 1, -1, 1, 1, -1, 1] },
	texture: { numComponents: 2, data: [0, 0, 1, 0, 1, 1, 0, 1] },
	indices: [0, 2, 1, 0, 2, 3],
});

function generateTextureOptions(
	gl: WebGL2RenderingContext,
	texturesType: { [x: string]: internalFormatType }
): { [x: string]: TextureOptions } {
	const resultat: { [x: string]: TextureOptions } = {};
	for (const name in texturesType) {
		if (texturesType.hasOwnProperty(name)) {
			const formatType = texturesType[name];
			let multiplier = 1;
			let src: ArrayBufferView;
			if (formatType.startsWith('RGBA')) {
				multiplier = 4;
			} else if (formatType.startsWith('RGB')) {
				multiplier = 3;
			} else if (formatType.startsWith('RG')) {
				multiplier = 2;
			}

			if (formatType.endsWith('8')) {
				src = new Uint8Array(multiplier);
			} else if (formatType.endsWith('32F')) {
				src = new Float32Array(multiplier);
			} else if (formatType.endsWith('16UI')) {
				src = new Uint16Array(multiplier);
			} else if (formatType.endsWith('16I')) {
				src = new Int16Array(multiplier);
			} else if (formatType.endsWith('32UI')) {
				src = new Uint32Array(multiplier);
			} else if (formatType.endsWith('32I')) {
				src = new Int32Array(multiplier);
			}

			resultat[name] = {
				src,
				internalFormat: gl[formatType],
				height: 1,
				width: 1,
				minMag: gl.NEAREST,
				wrap: gl.CLAMP_TO_EDGE,
			};
		}
	}

	return resultat;
}

export class GPUComputer {
	private readonly _fbi: FramebufferInfo = undefined;
	private readonly _attachments: TextureOptions[] = undefined;
	private readonly _programInfo: ProgramInfo = undefined;
	private readonly _texturesOptions: { [x: string]: TextureOptions } = {};
	private readonly _textures: { [x: string]: WebGLTexture } = {};
	private _uniforms: { [x: string]: number | ArrayBufferView } = {};
	private readonly _bufferAttachments: number[] = [];

	public static async GPUComputerFactory(
		fragmentCode: string,
		initTextures: { [x: string]: internalFormatType },
		outputFormats: internalFormatType[]
	): Promise<GPUComputer> {
		const texturesOptions = generateTextureOptions(_gl, initTextures);
		return new Promise((resolve, reject) => {
			createTextures(<WebGLRenderingContext>_gl, texturesOptions, (err, texs) => {
				if (err !== undefined) {
					reject(err);
				}

				for (const sub in texturesOptions) {
					if (texturesOptions.hasOwnProperty(sub)) {
						const option = texturesOptions[sub];
						delete option.src;
					}
				}

				resolve(new GPUComputer(fragmentCode, texturesOptions, texs, outputFormats));
			});
		});
	}

	private constructor(
		fragmentCode: string,
		texturesOptions: { [x: string]: TextureOptions },
		textures: { [x: string]: WebGLTexture },
		outputFormats: internalFormatType[]
	) {
		this._programInfo = createProgramInfo(<WebGLRenderingContext>_gl, [vertexCode, fragmentCode]);
		this._attachments = [];
		for (let i = 0; i < outputFormats.length; i++) {
			this._attachments.push({
				internalFormat: _gl[outputFormats[i]],
				minMag: _gl.NEAREST,
				wrap: _gl.CLAMP_TO_EDGE,
			});
			this._bufferAttachments.push(_gl.COLOR_ATTACHMENT0 + i);
		}

		this._fbi = createFramebufferInfo(<WebGLRenderingContext>_gl, this._attachments, 1, 1);
		this._texturesOptions = texturesOptions;
		this._textures = textures;
	}

	public updateUniforms(value: { [x: string]: number | ArrayBufferView }): void {
		for (const att in value) {
			if (value.hasOwnProperty(att)) {
				this._uniforms[att] = value[att];
			}
		}
	}

	public updateTextures(texs: {
		[x: string]: { src: ArrayBufferView; width: number; height: number; depth?: number };
	}): void {
		for (const att in texs) {
			if (this._texturesOptions.hasOwnProperty(att)) {
				const oldLookup = this._texturesOptions[att];
				const newLookup = texs[att];
				oldLookup.width = newLookup.width;
				oldLookup.height = newLookup.height;
				oldLookup.depth = newLookup.depth;
				setTextureFromArray(<WebGLRenderingContext>_gl, this._textures[att], newLookup.src, oldLookup);
			}
		}
	}

	public calculate(width: number, height: number): Float32Array[] {
		const uniforms = Object.assign({}, this._textures, this._uniforms);

		const end: Float32Array[] = [];
		setAttribInfoBufferFromArray(<WebGLRenderingContext>_gl, _attributesInfo.attribs.texture, [
			0,
			0,
			width,
			0,
			width,
			height,
			0,
			height,
		]);
		_gl.useProgram(this._programInfo.program);
		resizeFramebufferInfo(<WebGLRenderingContext>_gl, this._fbi, this._attachments, width, height);
		bindFramebufferInfo(<WebGLRenderingContext>_gl, this._fbi);
		_gl.viewport(0, 0, width, height);
		_gl.clearColor(0, 0, 0, 0);
		_gl.clearDepth(1);
		_gl.clear(_gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT);

		setBuffersAndAttributes(<WebGLRenderingContext>_gl, this._programInfo, _attributesInfo);
		setUniforms(this._programInfo, uniforms);
		_gl.drawBuffers(this._bufferAttachments);
		drawBufferInfo(<WebGLRenderingContext>_gl, _attributesInfo);
		for (let i = 0; i < this._fbi.attachments.length; i++) {
			const temp = new Float32Array(width * height * 4);
			_gl.readBuffer(_gl.COLOR_ATTACHMENT0 + i);
			_gl.readPixels(0, 0, width, height, _gl.RGBA, _gl.FLOAT, temp);
			end.push(temp);
		}

		bindFramebufferInfo(<WebGLRenderingContext>_gl);
		return end;
	}
}
