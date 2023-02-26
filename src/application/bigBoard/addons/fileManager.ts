import type { Merger } from '../merger';
import { fromGeojson, IPreGeometry, townLimits } from '../../country/geojson2preVertex';
import { inflate } from 'pako';
import { generator } from '../../country/countryMesh';
import reader, { state } from '../../merger/reader';
import { prepareStaticTownGeometry } from '../../merger/townHelper';

export interface IListFile {
	name: string;
	text: string;
}

export function unzip(zip: Uint8Array) {
	const unzipped = JSON.parse(new TextDecoder('utf-8').decode(inflate(zip))) as IListFile[];
	return filesToInsert(unzipped);
}

export function filesToInsert(list: IListFile[], toClean = true) {
	if (toClean) {
		reader.clear();
	}
	let preGeometries: IPreGeometry[] = [];
	list.forEach((file) => {
		const fileName = file.name.toLowerCase();
		if (fileName.endsWith('.geojson')) {
			const geoJson = JSON.parse(file.text) as GeoJSON.FeatureCollection;
			preGeometries = fromGeojson(geoJson, 7);
			console.log('geojson', file, preGeometries);
			generator(preGeometries);
		} else if (fileName.endsWith('.csv')) {
			reader.addFile(file.text);
			if (state === 'ready') {
				// This is when all processes are launched

				console.log(reader.dataMerger());
				// console.log(dataMerger());
			}
		}
	});
	//TODO suite
	// if (preGeometries.length > 0 && merger.state === 'complete') {
	// 	console.log(townLimits(merger.Cities));
	// }
}
