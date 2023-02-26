import { DynamicTexture, StandardMaterial } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { boundaries } from './configuration.json';

const semiHeight = 1024;
const longLat2XY = semiHeight / 90;

export async function generateBoundaryMaterial(scene: Scene): Promise<StandardMaterial> {
	const request = new Request(boundaries);
	const json: GeoJSON.FeatureCollection = await fetch(request).then(async (response) => response.json());
	const height = semiHeight * 2;
	const width = semiHeight * 4;
	const texture = new DynamicTexture('countryTextures', { height, width }, scene, false);
	const context = texture.getContext();
	context.fillStyle = '#EBDEDEAF';
	context.fillRect(0, 0, width, height);
	// Const strokeStyleDefault = 'rgba(0,0,255,0.5)';
	// const strokeStyleText = 'rgba(0,255,0,0.5)';
	context.lineWidth = 2;
	json.features.forEach((feature) => {
		const geometry = feature.geometry;
		const name: string = feature.properties.ADM0_A3;
		let coordinates: number[][][][];
		switch (geometry.type) {
			case 'Polygon':
				coordinates = [geometry.coordinates];
				break;
			case 'MultiPolygon':
				coordinates = geometry.coordinates;
				break;
			default:
				coordinates = [[[[]]]];
		}

		coordinates.forEach((polygons) => {
			let xMin = Infinity;
			let xMax = -Infinity;
			let yMin = Infinity;
			let yMax = -Infinity;
			const hue = Math.floor(Math.random() * 360 + 0.5);
			const saturation = Math.floor(Math.random() * 100 + 0.5);
			const lightness = Math.floor(Math.random() * 100 + 0.5);
			const contain = `hsl(${hue},${saturation}%,${lightness}%)`;
			context.strokeStyle = contain;
			polygons.forEach((polygon) => {
				const points = polygon.map((point) => {
					const [longitude, latitude] = point;
					const x = longitude * longLat2XY + 2 * semiHeight;
					const y = -latitude * longLat2XY + semiHeight;
					xMin = xMin > x ? x : xMin;
					xMax = xMax < x ? x : xMax;
					yMin = yMin > y ? y : yMin;
					yMax = yMax < y ? y : yMax;
					return { x, y };
				});
				context.beginPath();
				context.moveTo(points[0].x, points[0].y);
				let point: { x: number; y: number };
				for (let i = 1; i < points.length; i++) {
					point = points[i];
					context.lineTo(point.x, point.y);
				}

				context.closePath();
				context.stroke();
				context.fillStyle = contain;
				context.fill();
			});
			const deltaX = xMax - xMin;
			const deltaY = yMax - yMin;
			context.font = deltaX / 4 + 'px/' + deltaY / 2 + 'px serif';
			context.fillStyle = `hsl(${(hue + 180) % 360},${saturation}%,${lightness}%)`;
			if (deltaX > semiHeight / 100 && deltaY > semiHeight / 100) {
				context.fillText(name, xMin + deltaX / 4, yMax - deltaY / 2, deltaX / 2);
			}
		});
	});
	const countriesMaterial = new StandardMaterial('countryBoundaries', scene);
	countriesMaterial.diffuseTexture = texture;
	countriesMaterial.emissiveTexture = texture;
	countriesMaterial.alpha = 0.8;
	countriesMaterial.transparencyMode = 1;
	countriesMaterial.backFaceCulling = false;
	countriesMaterial.freeze();
	return countriesMaterial;
}
