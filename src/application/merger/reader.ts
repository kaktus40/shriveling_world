import Papa from 'papaparse';
import { reviver } from '../common/utils';
import { prepareDynamicTownGeometry, prepareStaticTownGeometry } from './townHelper';
import type { ICity, IEdge, IMergerData, IMergerState, ITranspMode } from '.';
import { setSpeedDatas } from './speedHelper';

export let state: IMergerState = 'pending';
const datas: IMergerData = {};
let result: IMergerData = null;

/**
 * Realizes the merge of two tables base on an attribute. The key for the merge is renamed.
 * At the end of the process the recipient table is enriched.
 *
 * @param mother the recipient table
 * @param girl where additional data lies
 * @param motherProperty the mother attribute on which merge is realized
 * @param girlProperty   the girl   attribute on which merge is realized
 * @param newName name of the resulting attribute
 * @param forceArray forces attribute to being a table
 * @param girlPropertyToRemove
 * @param motherPropertyToRemove
 */
function merger<U, V>(
	mother: U[],
	girl: V[],
	motherProperty: string,
	girlProperty: string,
	newName: string,
	forceArray: boolean,
	girlPropertyToRemove: boolean,
	motherPropertyToRemove: boolean
): void {
	let subGirl: V;
	let subMother: U;
	let attribute: string;
	const lookupGirl: { [x: string]: V | V[] } = {};
	let lessThanOne = !forceArray;
	for (const element of girl) {
		subGirl = element;
		if (
			subGirl.hasOwnProperty(girlProperty) &&
			subGirl[girlProperty] !== undefined &&
			subGirl[girlProperty] !== null
		) {
			attribute = subGirl[girlProperty].toString();
			if (girlPropertyToRemove) {
				delete subGirl[girlProperty];
			}

			if (Array.isArray(lookupGirl[attribute])) {
				(<V[]>lookupGirl[attribute]).push(subGirl);
				lessThanOne = false;
			} else {
				lookupGirl[attribute] = [subGirl];
			}
		}
	}

	if (lessThanOne) {
		for (attribute in lookupGirl) {
			if (lookupGirl.hasOwnProperty(attribute)) {
				lookupGirl[attribute] = lookupGirl[attribute][0];
			}
		}
	}

	for (const element of mother) {
		subMother = element;
		subMother[newName] = [];
		attribute = subMother[motherProperty];
		if (attribute !== undefined && attribute !== null) {
			attribute = attribute.toString();
			if (lookupGirl.hasOwnProperty(attribute)) {
				subMother[newName] = lookupGirl[attribute];
			}
		}

		if (motherPropertyToRemove) {
			delete subMother[motherProperty];
		}
	}
}

/**
 * data files are identified by testing the
 * headings read in the file with these
 * 'hard coded' headings
 */
const hardCodedHeadings: Array<{ fileName: string; headings: string[] }> = [
	{ fileName: 'cities', headings: ['cityCode', 'latitude', 'longitude', 'radius'] },
	{ fileName: 'transportModeSpeeds', headings: ['transportModeCode', 'year', 'speedKPH'] },
	{ fileName: 'transportModes', headings: ['code', 'name', 'terrestrial'] },
	{ fileName: 'transportNetwork', headings: ['transportModeCode', 'cityCodeDes', 'cityCodeOri'] },
	{ fileName: 'populations', headings: ['cityCode'] },
];
const config: Papa.ParseConfig = {
	header: true,
	dynamicTyping: true,
	skipEmptyLines: true,
	fastMode: true,
};

/**
 * Gets the CSV file, parses it,
 * and returns a table
 *
 * @param  text
 * @param [isTransportModeCode=false]
 * @returns {*}
 */
function getCSV(text: string, isTransportModeCode = false): any {
	config.transform = undefined;
	if (isTransportModeCode) {
		config.transform = (value, field) => {
			if (field === 'terrestrial') {
				value = value === '1' ? 'true' : 'false';
			}

			return value;
		};
	}
	return Papa.parse(text, config).data;
}

function checkState(): void {
	if (state !== 'pending') {
		state = 'missing';
		if (result) {
			state = 'complete';
		} else if (
			datas.cities?.length > 0 &&
			datas.populations?.length > 0 &&
			datas.transportModeSpeeds?.length > 0 &&
			datas.transportModes?.length > 0 &&
			datas.transportNetwork?.length > 0
		) {
			state = 'ready';
		}
	}
}
/**
 * The function [[cleanUpNetwork]] will
 * remove unconnected [[edges]], id est remove
 * * [[edges]] with zero extremities in [[cities]] list
 * * [[edges]] with one  extremity   in [[cities]] list
 * @param transportNetwork
 * @param cities
 */
function cleanUpNetwork(transportNetwork: IEdge[], cities: ICity[]) {
	for (let i = 0; i < transportNetwork.length; i++) {
		if (
			cities.findIndex((c) => c.cityCode === transportNetwork[i].cityCodeOri) === -1 ||
			cities.findIndex((c) => c.cityCode === transportNetwork[i].cityCodeDes) === -1
		) {
			transportNetwork.splice(i--, 1);
		}
	}
}

function addFile(readString: string): void {
	const readRows = readString.split(/\r\n|\r|\n/);
	const readHeadings = readRows[0];
	let dataFileType: string;
	let codedHeadings: string[];
	let found: boolean;
	for (let i = 0; i < hardCodedHeadings.length && dataFileType === undefined; i++) {
		codedHeadings = hardCodedHeadings[i].headings;
		found = true;
		for (let j = 0; j < codedHeadings.length && found; j++) {
			if (!readHeadings.includes(codedHeadings[j])) {
				found = false;
			}
		}
		if (found) {
			dataFileType = hardCodedHeadings[i].fileName;
		}
	}
	if (dataFileType === undefined) {
		throw new Error('data file scheme unknown');
	} else {
		datas[dataFileType] = [];
		datas[dataFileType].push(...getCSV(readString, dataFileType === 'transportMode'));
		if (dataFileType === 'transportMode' || dataFileType === 'transportNetwork') {
			(datas[dataFileType] as IEdge[]).forEach((item) => {
				if (item.eYearEnd === undefined || item.eYearEnd === null || item.eYearEnd.toString() === '') {
					delete item.eYearEnd;
				}
			});
		}
		checkState();
	}
}

function clear(): void {
	datas.cities = [];
	datas.populations = [];
	datas.transportModeSpeeds = [];
	datas.transportModes = [];
	datas.transportNetwork = [];
	datas.roadCode = -1;
	state = 'missing';
	result = null;
}

function dataMerger() {
	if (result === null && (state === 'ready' || state === 'complete')) {
		state = 'pending';
		result = JSON.parse(JSON.stringify(datas), reviver);
		const cities = result.cities;
		const population = result.populations;
		const transportModes = result.transportModes;
		const transportModeSpeeds = result.transportModeSpeeds;
		const transportNetwork = result.transportNetwork;

		// Linking tables to each other
		// merger(mother,     girl,               motherProp., girlProp.,      newName, forceArray, removeMotherProp., removeGirlProp.)
		merger(transportModes, transportModeSpeeds, 'code', 'transportModeCode', 'speedTab', true, true, false);
		// identifying Road in the dataset
		merger(cities, population, 'cityCode', 'cityCode', 'populations', false, true, false);

		// Attach city information to starting and ending city edge
		merger(transportNetwork, cities, 'cityCodeOri', 'cityCode', 'origCityInfo', false, false, false);
		merger(transportNetwork, cities, 'cityCodeDes', 'cityCode', 'destCityInfo', false, false, false);
		// cleaning up transportNetwork = remove edges with one or zero extremities in the 'cities' list
		cleanUpNetwork(transportNetwork, cities);
		// Generates subgraph from city considered as origin and as destination
		merger(cities, transportNetwork, 'cityCode', 'cityCodeOri', 'outEdges', true, false, false);
		merger(cities, transportNetwork, 'cityCode', 'cityCodeDes', 'inEdges', true, false, false);

		// cleaning datas and add some basic metadata!
		// merging in and out into edges, remove in and out
		cities.forEach((city) => {
			city.edges = [...city.inEdges, ...city.outEdges];
			delete city.inEdges;
			delete city.outEdges;
		});
		console.group('prepare merge datas');
		console.time('define road code');
		result.roadCode = identifyingRoadMode(transportModes);
		console.timeEnd('define road code');
		console.time('define time span');
		historicalTimeSpan(result);
		console.timeEnd('define time span');
		console.time('define speed datas');
		setSpeedDatas(result);
		console.timeEnd('define speed datas');
		console.time('prepare town static geometries');
		prepareStaticTownGeometry(result, 30);
		console.timeEnd('prepare town static geometries');
		console.time('prepare town dynamic geometries');
		prepareDynamicTownGeometry(result);
		console.timeEnd('prepare town dynamic geometries');
		console.groupEnd();
	}
	return result;
}

/**
 * The function determines the [[historicalTimeSpan]]
 * based on data found in the input files:
 * * [[transportMode]]
 * * [[transpNetwork]]
 * @param transportModes
 * @param transpNetwork
 */
function historicalTimeSpan(tmpResult: IMergerData) {
	const transportModes = tmpResult.transportModes;
	const transpNetwork = tmpResult.transportNetwork;
	const roadCode = tmpResult.roadCode;
	transportModes.forEach((transpMode) => {
		// initializing the variables
		let oneUndefinedEYearBegin = false;
		let oneUndefinedEYearEnd = false;
		// first retrieve dates indicated in the speeds file
		const tmpTabYear = transpMode.speedTab.map((t) => t.year);
		transpMode.minSYear = Math.min(...tmpTabYear);
		transpMode.maxSYear = Math.max(...tmpTabYear);
		// second retrieve dates indicated in the network file
		transpMode.minEYear = null;
		transpMode.maxEYear = null;
		transpNetwork.forEach((edge) => {
			if (edge.transportModeCode === transpMode.code) {
				if (edge.eYearBegin !== undefined) {
					if (transpMode.minEYear === null) {
						transpMode.minEYear = edge.eYearBegin;
					} else {
						if (transpMode.minEYear > edge.eYearBegin) {
							transpMode.minEYear = edge.eYearBegin;
						}
					}
				} else {
					oneUndefinedEYearBegin = true;
				}
				if (edge.eYearEnd !== undefined) {
					if (transpMode.maxEYear === null) {
						transpMode.maxEYear = edge.eYearEnd;
					} else {
						if (transpMode.maxEYear < edge.eYearEnd) {
							transpMode.maxEYear = edge.eYearEnd;
						}
					}
				} else {
					oneUndefinedEYearEnd = true;
				}
			}
		});
		if (oneUndefinedEYearBegin) {
			transpMode.minEYear = null;
		}
		if (oneUndefinedEYearEnd) {
			transpMode.maxEYear = null;
		}
	});

	// computing the valid time span of transport modes considering:
	// range of operation AND available speed data
	transportModes.forEach((transpMode) => {
		transpMode.yearBegin = Math.max(
			transpMode.minSYear === null ? -Infinity : transpMode.minSYear,
			transpMode.minEYear === null ? -Infinity : transpMode.minEYear
		);
		transpMode.yearEnd = Math.min(
			transpMode.maxSYear === null ? Infinity : transpMode.maxSYear,
			transpMode.maxEYear === null ? Infinity : transpMode.maxEYear
		);
	});

	// computing the historical time span of the model
	// at this step time span = span of non Road modes
	let begin = Infinity;
	let end = -Infinity;
	transportModes.forEach((transpMode) => {
		if (transpMode.code !== roadCode) {
			if (transpMode.yearBegin < begin) begin = transpMode.yearBegin;
			if (transpMode.yearEnd > end) end = transpMode.yearEnd;
		}
	});

	// unlikely case when road times are not consistent
	transportModes.forEach((transpMode) => {
		if (transpMode.code === roadCode) {
			if (transpMode.yearBegin > begin) begin = transpMode.yearBegin;
			if (transpMode.yearEnd < end) end = transpMode.yearEnd;
		}
	});
	// console.log('Dataset time span: ', firstYear, lastYear, transportModes);
	tmpResult.span = { begin, end };
}
/**
 * Scanning the table of [[transportMode]]s to identify
 * the road mode, reference of the model
 * @param transportMode
 */
function identifyingRoadMode(transportMode: ITranspMode[]): number {
	let roadModeCode: number = undefined;
	transportMode.forEach((transpMode) => {
		const transportCode = transpMode.code;
		const modeName = transpMode.name;
		if (modeName === 'Road') {
			roadModeCode = transportCode;
		}
	});
	return roadModeCode;
}

export default { addFile, clear, dataMerger };
