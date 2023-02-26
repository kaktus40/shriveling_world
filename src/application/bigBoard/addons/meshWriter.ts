import {
	Vector2,
	Vector3,
	Path2,
	Curve3,
	Color3,
	SolidParticleSystem,
	PolygonMeshBuilder,
	CSG,
	StandardMaterial,
	Mesh,
} from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';

import MeshWriter from 'meshwriter';

type fontType = 'gentilis-regular' | 'HirukoPro' | 'Jura' | 'Comic' | 'Helvetica';

const babylonMethods = {
	Vector2,
	Vector3,
	Path2,
	Curve3,
	Color3,
	SolidParticleSystem,
	PolygonMeshBuilder,
	CSG,
	StandardMaterial,
	Mesh,
};

export interface IWriter {
	getSPS: () => SolidParticleSystem;
	getMesh: () => Mesh;
	color: string;
	alpha: number;
	setColor: (v: string) => void;
	setAlpha: (v: number) => void;
	dispose: () => void;
}

export function Writer(
	scene: Scene,
	defaultFont: fontType = 'gentilis-regular',
	scale = 1,
	letterOrigin = 'letter-center'
): (text: string) => IWriter {
	return MeshWriter(scene, {
		scale,
		'default-font': defaultFont,
		'letter-origin': letterOrigin,
		methods: babylonMethods,
	});
}
