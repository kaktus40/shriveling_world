import { saveAs } from 'file-saver';
import jszip from 'jszip/dist/jszip';
import { OBJExport } from '@babylonjs/serializers/OBJ';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CONFIGURATION } from '../../common/configuration';

export function initSaver(element: HTMLElement): HTMLButtonElement {
	const saveButton = document.createElement('button');
	saveButton.innerHTML = 'Save scene';
	const style = saveButton.style;
	style.zIndex = '1000';
	style.position = 'fixed';
	style.bottom = '0px';
	style.left = '0px';
	style.backgroundColor = 'red';
	element.append(saveButton);
	return saveButton;
	saveButton.addEventListener('click', () => this.exporterOBJ());
}

/**
 * Export the scene in Wavefront OBJ format.
 * Exported files can be imported in Blender.
 *
 * Three files are generated:
 * * sceneCones.obj
 * * sceneCurvesLongHaul.obj for short distance flights above the geodesic
 * * sceneCurvesShortHaul.obj for long distance geodesic flights
 */
export function exporterOBJ(cones: Mesh[] = [], countries: Mesh[] = [], curves: Mesh[] = []): void {
	const CurveShortHaul: Mesh[] = [];
	const CurvesLongHaul: Mesh[] = [];
	const thetaLimit = 2000 / (CONFIGURATION.earthRadiusMeters / 1000);
	curves.forEach((curve: any) => {
		// TODO à faire évoluer avec curve implémentation
		if (curve.theta < thetaLimit) {
			CurveShortHaul.push(curve);
		} else {
			CurvesLongHaul.push(curve);
		}
	});
	const groupCone = OBJExport.OBJ(cones, true);
	const groupCountry = OBJExport.OBJ(countries, true);
	const groupCurveShortHaul = OBJExport.OBJ(CurveShortHaul, true);
	const groupCurvesLongHaul = OBJExport.OBJ(CurvesLongHaul, true);
	const blobCone = new Blob([groupCone], {
		type: 'text/plain;charset=utf-8',
	});
	const blobCurveShort = new Blob([groupCurveShortHaul], {
		type: 'text/plain;charset=utf-8',
	});
	const blobCurveLong = new Blob([groupCurvesLongHaul], {
		type: 'text/plain;charset=utf-8',
	});
	const blobCountry = new Blob([groupCountry], {
		type: 'text/plain;charset=utf-8',
	});
	const zip = new jszip();
	zip.file('sceneCones.obj', blobCone);
	zip.file('sceneCurvesShortHaul.obj', blobCurveShort);
	zip.file('sceneCurvesLongHaul.obj', blobCurveLong);
	zip.file('country.obj', blobCountry);
	zip.generateAsync({ type: 'blob' }).then(function (content) {
		saveAs(content, 'scene.zip');
	});
	console.log('Saving scene complete');
}
