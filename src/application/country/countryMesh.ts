import { Geometry, Mesh, Scene, VertexBuffer, VertexData } from '@babylonjs/core';
import { CONFIGURATION } from '../common/configuration';
import { GPUComputer } from '../common/gpuComputer';
import countryMeshShader from '../shaders/countryMeshShader.frag';
import { earthMaterial } from './earthMaterial';
import type { IMarkLimits, IPreGeometry } from './geojson2preVertex';

let _vertexArrayEntries = new Float32Array(0);
let _vertexArrayOutputs = new Float32Array(0);
export let countries: Country[] = [];
let _dirty = false;
let _tickCount = 0;
let _width: number;
let _height = 1;
let _scene: Scene;

export function init(scene: Scene) {
	_scene = scene;
}

const _gpgpu: { [x: string]: GPUComputer } = {};
GPUComputer.GPUComputerFactory(countryMeshShader, { u_Positions: 'RGB32F' }, ['RGBA32F']).then(
	(instance) => (_gpgpu.positions = instance)
);

function maxRectangle(n: number): [number, number] {
	const primes: number[] = [];
	let width = 1;
	let height = 1;
	let i = 0;
	if (n >= 2) {
		for (let i = 2; i <= n; i++) {
			while (n % i === 0) {
				primes.push(i);
				n /= i;
			}
		}
	} else {
		return [n, 1];
	}

	while (primes.length > 0 && width <= 8192) {
		width *= primes.shift();
		break;
	}

	for (i = 0; i < primes.length; i++) {
		if (primes[i] * width <= 8192) {
			width *= primes[i];
		} else {
			break;
		}
	}

	for (; i < primes.length; i++) {
		height *= primes[i];
	}

	return width === height && height === 1 ? [n, 1] : [width, height];
}

function fullCleanArrays(): void {
	_vertexArrayEntries = new Float32Array(0);
	countries.forEach((c) => c.dispose());
	countries = [];
}

fullCleanArrays();

function computation(): void {
	const uniforms: { [x: string]: number | ArrayBufferView } = {};
	uniforms.longueurMaxi = CONFIGURATION.extrudedHeight;
	uniforms.threeRadius = CONFIGURATION.THREE_EARTH_RADIUS;
	uniforms.earthRadius = CONFIGURATION.earthRadiusMeters;
	uniforms.referenceEquiRectangular = CONFIGURATION.referenceEquiRectangularArray;
	uniforms.projectionInit = CONFIGURATION.projectionInit;
	uniforms.projectionEnd = CONFIGURATION.projectionEnd;
	uniforms.percentProjection = CONFIGURATION.percentProjection;
	uniforms.conesShape = CONFIGURATION.conesShape;
	uniforms.standardParallel1 = CONFIGURATION.standardParallel1;
	uniforms.standardParallel2 = CONFIGURATION.standardParallel2;
	uniforms.zCoeff = CONFIGURATION.zCoeff;
	_gpgpu.positions.updateUniforms(uniforms);
	const options: { [x: string]: { src: ArrayBufferView; width: number; height: number; depth?: number } } = {
		u_Positions: { src: _vertexArrayEntries, width: _width, height: _height },
	};
	_gpgpu.positions.updateTextures(options);
	_vertexArrayOutputs = _gpgpu.positions.calculate(_width, _height)[0];
	countries.forEach((country) => country.update());
}

CONFIGURATION.addEventListener(
	'heightRatio intrudedHeightRatio referenceEquiRectangular THREE_EARTH_RADIUS ' +
		'projectionBegin projectionEnd projectionPercent tick zCoeff',
	(name: string) => {
		switch (name) {
			case 'tick':
				if (_dirty === true && _tickCount > 10) {
					const options = {
						u_Positions: {
							src: _vertexArrayEntries,
							width: _width,
							height: _height,
						},
					};
					_gpgpu.positions.updateTextures(options);
					computation();
					_tickCount = 0;
					_dirty = false;
				} else {
					_tickCount++;
				}
				break;
			default:
				computation();
		}
	}
);

export function generator(pregeometries: IPreGeometry[]) {
	fullCleanArrays();
	let indexCount = 0;
	let oldIndexCount = 0;
	const vertexArrayEntries: number[] = [];
	pregeometries.forEach((item, i) => {
		oldIndexCount = indexCount;
		indexCount += item.vertices.length / 3;
		vertexArrayEntries.push(...item.vertices);
		const extruded = item.extruded;
		extruded.begin += oldIndexCount * 3;
		extruded.end += oldIndexCount * 3;
		countries.push(new Country('country ' + i, item, { begin: oldIndexCount * 4, end: indexCount * 4 }));
	});

	[_width, _height] = maxRectangle(vertexArrayEntries.length / 3);
	_vertexArrayEntries = new Float32Array(vertexArrayEntries);
	computation();
}

export class Country extends Mesh {
	private readonly _extrudedLimits: IMarkLimits;
	private _extrudedPercent = 100;

	constructor(name: string, pregeom: IPreGeometry, private readonly _outputLimits: IMarkLimits) {
		super(name, _scene);
		this._extrudedLimits = pregeom.extruded;
		const geometry = new Geometry('geom ' + name, _scene, new VertexData(), true);
		geometry.setVerticesData(VertexBuffer.UVKind, pregeom.uvs, false, 2);
		geometry.setVerticesData(
			VertexBuffer.PositionKind,
			new Float32Array(_outputLimits.end - _outputLimits.begin),
			true,
			4
		);
		geometry.setIndices(pregeom.indexes, null, false);
		this.material = earthMaterial();
		geometry.applyToMesh(this);
	}

	update() {
		this.updateMeshPositions((data) => {
			(data as Float32Array).set(_vertexArrayOutputs.subarray(this._outputLimits.begin, this._outputLimits.end));
		}, true);
	}

	public get extruded(): number {
		return this._extrudedPercent;
	}

	public set extruded(value: number) {
		const abs = Math.abs(value);
		if (abs > 0.0001 && abs <= 100) {
			this._extrudedPercent = value;
			const outValue = (value * CONFIGURATION.extrudedHeight) / 100;
			const begin = this._extrudedLimits.begin;
			const end = this._extrudedLimits.end;
			for (let i = begin; i < end; i += 3) {
				_vertexArrayEntries[i + 2] = outValue;
			}
			_dirty = true;
		}
	}
}
