'use strict';
import { CONFIGURATION } from './configuration';
import type { NEDLocal, Coordinate } from './referential';
import type { ILonLatH, IOrderAscendant, IBBox, IListFile } from '../definitions/project';

export class LonLatH implements ILonLatH {
	public latitude: number;
	public longitude: number;
	public height: number;

	public static exactDistance(pos1: LonLatH, pos2: LonLatH): number {
		return exactDistance([pos1.longitude, pos1.latitude], [pos2.longitude, pos2.latitude], true);
	}

	public static isInside(position: LonLatH, boundary: LonLatH[]): boolean {
		let cn = 0; // The  crossing number counter
		let iPlus: number;
		const n = boundary.length;
		// Loop through all edges of the polygon
		for (let i = 0; i < n; i++) {
			// Edge from V[i]  to V[i+1]
			iPlus = i === n - 1 ? 0 : i + 1;
			if (
				(boundary[i].latitude <= position.latitude && boundary[iPlus].latitude > position.latitude) ||
				(boundary[i].latitude > position.latitude && boundary[iPlus].latitude <= position.latitude)
			) {
				const vt =
					(position.latitude - boundary[i].latitude) / (boundary[iPlus].latitude - boundary[i].latitude);
				if (
					position.longitude <
					boundary[i].longitude + vt * (boundary[iPlus].longitude - boundary[i].longitude)
				) {
					cn++;
				}
			}
		}

		return cn % 2 === 1; // 0 if even (out), and 1 if  odd (in)
	}

	public static lerp(pos1: LonLatH, pos2: LonLatH, fractions: number[] = []): LonLatH[] {
		const { generator } = lerp([pos1.longitude, pos1.latitude], [pos2.longitude, pos2.latitude], true);
		const deltaHeight = pos2.height - pos1.height;
		return fractions.map((f) => {
			const res = generator(f);
			return new LonLatH(res[0], res[1], pos1.height + f * deltaHeight, true);
		});
	}

	public static direction(pos1: LonLatH, pos2: LonLatH): number {
		return Math.atan2(pos2.latitude - pos1.latitude, pos2.longitude - pos1.longitude);
	}

	constructor(longitude = 0, latitude = 0, height = 0, isRadians = true) {
		if (!isRadians) {
			latitude *= CONFIGURATION.deg2rad;
			longitude *= CONFIGURATION.deg2rad;
		}

		this.latitude = latitude;
		this.longitude = longitude;
		this.height = height;
	}

	public clone(): LonLatH {
		return new LonLatH(this.longitude, this.latitude, this.height);
	}

	public exactDistance(pos2: LonLatH): number {
		return LonLatH.exactDistance(this, pos2);
	}

	public lerp(pos2: LonLatH, fractions: number[] = []): LonLatH[] {
		return LonLatH.lerp(this, pos2, fractions);
	}

	public direction(pos: LonLatH): number {
		return LonLatH.direction(this, pos);
	}

	public toGLSL(): number[] {
		return [this.longitude, this.latitude, this.height];
	}
}

export const ZERO_LATLONH = new LonLatH();

Object.freeze(ZERO_LATLONH);

/**
 *
 * @param pos1 longitude and latitude of point 1 in array of numbers
 * @param pos2 longitude and latitude of point 2 in array of numbers
 * @param isRadians coordinates in radians?
 * @returns distance in radians between 2 points
 */
export function exactDistance(pos1: number[], pos2: number[], isRadians = true): number {
	let lambda1 = pos1[0];
	let phi1 = pos1[1];

	let lambda2 = pos2[0];
	let phi2 = pos2[1];

	if (!isRadians) {
		lambda1 *= CONFIGURATION.deg2rad;
		phi1 *= CONFIGURATION.deg2rad;
		lambda2 *= CONFIGURATION.deg2rad;
		phi2 *= CONFIGURATION.deg2rad;
	}

	const semiDLat = (phi2 - phi1) / 2;
	const semiDLon = (lambda2 - lambda1) / 2;
	const a = Math.sin(semiDLat) ** 2 + Math.sin(semiDLon) ** 2 * Math.cos(phi1) * Math.cos(phi2);
	return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
/**
 *
 * @param pos1 longitude and latitude of point 1 in array of numbers
 * @param pos2 longitude and latitude of point 2 in array of numbers
 * @param isRadians coordinates in radians?
 * @returns define a function that takes a fraction number and returns an interdediate point between 2 positions given in parameters ponderate by the fraction
 */
export function lerp(pos1: number[], pos2: number[], isRadians = true) {
	if (!isRadians) {
		pos1 = pos1.map((n) => n * CONFIGURATION.deg2rad);
		pos2 = pos2.map((n) => n * CONFIGURATION.deg2rad);
	}
	const distance = exactDistance(pos1, pos2, true);
	const cPhi1 = Math.cos(pos1[1]);
	const sPhi1 = Math.sin(pos1[1]);
	const cPhi2 = Math.cos(pos2[1]);
	const sPhi2 = Math.sin(pos2[1]);

	const cLambda1 = Math.cos(pos1[0]);
	const cLambda2 = Math.cos(pos2[0]);
	const sLambda2 = Math.sin(pos2[0]);

	return {
		generator: (f: number): [number, number] => {
			const A = Math.sin((1 - f) * distance) / Math.sin(distance);
			const B = Math.sin(f * distance) / Math.sin(distance);

			const x = A * cPhi1 * cLambda1 + B * cPhi2 * cLambda2;
			const y = A * cPhi1 * cLambda1 + B * cPhi2 * sLambda2;
			const z = A * sPhi1 + B * sPhi2;
			return [Math.atan2(y, x), Math.atan2(z, Math.sqrt(x * x + y * y))];
		},
		distance: isRadians ? distance : distance * CONFIGURATION.rad2deg,
	};
}

/**
 *
 * @param dim number of item to make a tuple
 * @param tab flatten tuple of numbers [x0,y0,x1,y1,...] if dim =2;[x0,y0,z0,x1,y1,z1,...] if dim=3
 * @returns return minimum for each coordinate of tuples given in parameter
 */
export function minArray(dim: number, ...tab: number[]): number[] {
	const resultat: number[] = [];
	dim = Math.ceil(dim);
	if (dim <= 0) throw new Error('dim must be strictly positif');

	for (let i = 0; i < dim; i++) {
		resultat.push(Infinity);
	}
	for (let i = 0; i < tab.length; i += dim) {
		for (let j = 0; j < dim; j++) {
			resultat[j] = Math.min(resultat[j], tab[i + j]);
		}
	}
	return resultat;
}

/**
 *
 * @param dim number of item to make a tuple
 * @param tab flatten tuple of numbers [x0,y0,x1,y1,...] if dim =2;[x0,y0,z0,x1,y1,z1,...] if dim=3
 * @returns return maximum for each coordinate of tuples given in parameter
 */
export function maxArray(dim: number, ...tab: number[]): number[] {
	const resultat: number[] = [];
	dim = Math.ceil(dim);
	if (dim <= 0) throw new Error('dim must be strictly positif');

	for (let i = 0; i < dim; i++) {
		resultat.push(-Infinity);
	}
	for (let i = 0; i < tab.length; i += dim) {
		for (let j = 0; j < dim; j++) {
			resultat[j] = Math.max(resultat[j], tab[i + j]);
		}
	}
	return resultat;
}

/**
 *
 * @param dim number of item to make a tuple
 * @param tab flatten tuple of numbers [x0,y0,x1,y1,...] if dim =2;[x0,y0,z0,x1,y1,z1,...] if dim=3
 * @returns return mean for each coordinate of tuples given in parameter
 */
export function meanArray(dim: number, ...tab: number[]): number[] {
	const resultat: number[] = [];
	dim = Math.ceil(dim);
	if (dim <= 0) throw new Error('dim must be strictly positif');

	for (let i = 0; i < dim; i++) {
		resultat.push(0);
	}
	for (let i = 0; i < tab.length; i += dim) {
		for (let j = 0; j < dim; j++) {
			resultat[j] += tab[i + j];
		}
	}
	const nbElement = Math.floor(tab.length / dim);
	if (nbElement === 0) return [];
	return resultat.map((r) => r / nbElement);
}

/**
 *
 * @param dim number of item to make a tuple
 * @param tab flatten tuple of numbers [x0,y0,x1,y1,...] if dim =2;[x0,y0,z0,x1,y1,z1,...] if dim=3
 * @returns return min-max for each coordinate of tuples given in parameter [xmin,xmax,ymin,ymax,zmin,zmax] for dim=3
 */
export function boundingBoxArray(dim: number, ...tab: number[]): number[] {
	const resultat: number[] = [];
	dim = Math.ceil(dim);
	if (dim <= 0) throw new Error('dim must be strictly positif');

	for (let i = 0; i < dim; i++) {
		resultat.push(Infinity, -Infinity);
	}
	for (let i = 0; i < tab.length; i += dim) {
		for (let j = 0; j < dim; j++) {
			resultat[2 * j] = Math.min(resultat[2 * j], tab[i + j]);
			resultat[2 * j + 1] = Math.max(resultat[2 * j + 1], tab[i + j]);
		}
	}
	return resultat;
}

export function DragNDrop(id: string | HTMLElement, callback: (list: IListFile[]) => void, scope: unknown): void {
	const container = typeof id === 'string' ? document.querySelector('#' + id) : id;
	if (container === null) {
		throw new Error('not an HTML Element');
	} else {
		function handleDragOver(evt: DragEvent): void {
			evt.stopPropagation();
			evt.preventDefault();
			evt.dataTransfer.dropEffect = 'copy';
		}

		function dropFiles(evt: DragEvent): void {
			evt.stopPropagation();
			evt.preventDefault();
			const files = evt.dataTransfer.files;
			void Promise.all(
				Array.from(files, async (file) => {
					return new Promise((resolve) => {
						const reader = new FileReader();
						reader.addEventListener('load', () => {
							resolve({ name: file.name, text: reader.result });
						});

						reader.readAsText(file);
					});
				})
			).then((tab) => callback.call(scope, tab));
		}

		container.addEventListener('dragover', handleDragOver, false);
		container.addEventListener('drop', dropFiles, false);
	}
}

/**
 * Function to interpolate numerical values from a given table
 * @param  normalizedBase input table containing a numeric attribute
 * in x and a numeric attribute in y. The table must be ordered
 * according to x
 * @param  xProperty
 * @param  yProperty
 * @param  strongLimit allow to extrapolate values beyond the limits
 * of the input table
 * @return  an interpolated function
 */
export function interpolator<U>(
	normalizedBase: U[],
	xProperty: string,
	yProperty: string,
	strongLimit = false
): (x: number) => number {
	const length = normalizedBase.length;
	let result: (x?: number) => number = () => 0;
	if (length === 0) {
		result = () => null;
	} else if (length === 1) {
		result = () => normalizedBase[0][yProperty];
	} else {
		result = (x: number) => {
			let indMin = 0;
			let indMax = length - 1;
			let index = Math.floor(length / 2);
			let found = false;
			let out = 0;
			if (x < normalizedBase[0][xProperty]) {
				index = strongLimit ? -1 : 0;
				found = true;
			}

			if (x > normalizedBase[length - 1][xProperty]) {
				index = indMax;
				indMin = indMax - 1;
				found = false;
				if (strongLimit) {
					found = true;
					index = -1;
				}
			}

			while (indMax !== indMin + 1 && !found) {
				if (normalizedBase[index][xProperty] === x) {
					indMin = index;
					indMax = index;
					found = true;
				} else if (normalizedBase[index][xProperty] < x) {
					indMin = index;
				} else if (normalizedBase[index][xProperty] > x) {
					indMax = index;
				}

				index = Math.floor((indMin + indMax) / 2);
			}

			if (found) {
				out = index < 0 ? 0 : normalizedBase[index][yProperty];
			} else {
				// computing ratio
				out =
					((normalizedBase[indMax][yProperty] - normalizedBase[indMin][yProperty]) *
						(x - normalizedBase[indMin][xProperty])) /
						(normalizedBase[indMax][xProperty] - normalizedBase[indMin][xProperty]) +
					normalizedBase[indMin][yProperty];
			}

			return out;
		};
	}

	return result;
}

const iso8601RegExp =
	/(\d{4}-[01]\d-[0-3]\dT[0-2](?:\d:[0-5]){2}\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2](?:\d:[0-5]){2}\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/;

// To use for JSON.parse
export const reviver: any = <U>(_key: string, value: any): U | any => {
	const result: any | U = value;

	if (typeof value === 'string') {
		const temporary = value.replace(' ', '');
		if (iso8601RegExp.exec(temporary)) {
			value = new Date(temporary);
		}
	}

	return result;
};

export function matchingBBox(pos: LonLatH, bBoxes: IBBox[]): LonLatH[][] {
	return bBoxes
		.filter(
			(bBox) =>
				pos.latitude >= bBox.minLat &&
				pos.latitude <= bBox.maxLat &&
				pos.longitude >= bBox.minLong &&
				pos.longitude <= bBox.maxLong &&
				LonLatH.isInside(pos, bBox.boundary)
		)
		.map((bBox) => bBox.boundary);
}

export function getLocalLimits(
	boundaries: LonLatH[][],
	referential: NEDLocal
): Array<{ clock: number; distance: number }> {
	const allPoints: Coordinate[] = [];
	boundaries.forEach((boundary) => {
		boundary.forEach((position) => {
			allPoints.push(referential.lonLatH2NED(position));
		});
	});
	const clockDistance = allPoints
		.map((pos) => {
			return {
				clock: Math.atan2(pos.y, pos.x),
				distance: Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z),
			};
		})
		.reduce((result, current) => {
			const clockClass = Math.floor(current.clock / CONFIGURATION.coneStep) * CONFIGURATION.coneStep;
			result[clockClass] =
				result[clockClass] === undefined ? current.distance : Math.min(result[clockClass], current.distance);
			return result;
		}, {});
	const result: Array<{ clock: number; distance: number }> = [];
	for (const clockString in clockDistance) {
		if (clockDistance.hasOwnProperty(clockString)) {
			result.push({ clock: Number.parseFloat(clockString), distance: clockDistance[clockString] });
		}
	}

	const length = result.length;
	let temporary;
	for (let i = 0; i < length; i++) {
		temporary = result[i];
		result.push(
			{ clock: temporary.clock - CONFIGURATION.TWO_PI, distance: temporary.distance },
			{ clock: temporary.clock + CONFIGURATION.TWO_PI, distance: temporary.distance }
		);
	}

	return result.sort((a, b) => a.clock - b.clock);
}
const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
let rnd = 0;
let r: number;

export function generateUUID(): string {
	let uuid = '';
	for (let i = 0; i < 36; i++) {
		if (i === 8 || i === 13 || i === 18 || i === 23) {
			uuid += '-';
		} else if (i === 14) {
			uuid += '4';
		} else {
			if (rnd <= 0x02) {
				rnd = (0x2000000 + Math.random() * 0x1000000) | 0;
			}

			r = rnd & 0xf;
			rnd >>= 4;
			uuid += chars[i === 19 ? (r & 0x3) | 0x8 : r];
		}
	}

	return uuid;
}
