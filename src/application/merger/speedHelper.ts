import { CONFIGURATION } from '../common/configuration';
import { interpolator } from '../common/utils';
import type {
	IMaxSpeedPerYear,
	IMergerData,
	ISpeedAlpha,
	ISpeedPerTranspModePerYear,
	ItransportDict,
	ITerrestrialMinAlphaPerYear,
} from '.';

/**
 * "thetaThreshold" = threshold angle of the modelled air services speed.
 * The threshold length is fixed at 2000 km for the current (2010) air system
 * * beyond "thetaThreshold" speed has the constant value "speed"
 * * below "thetaThreshold" speed decreases from value "speed" to zero depending on the value of "theta"
 */
const distCrowThreshold = 2000;
const thetaThreshold = distCrowThreshold / (CONFIGURATION.earthRadiusMeters / 1000);
/**
 * [[getModelledSpeed]] computes a new speed for aerial ([[terrestrial]] = false)
 * links having a length less than distCrowThreshold, implying
 * a [[theta]] < [[thetaThreshold]]
 * this modelled speed will be lower than the considered mode speed
 *
 * [[theta]] is the angle between the two cities
 * in the un-projected situation
 *
 * In the case of air links, two equations are used to determine
 * the [height of aerial links above the geodesic](http://bit.ly/2H4FOKw):
 * * below the threshold limit:![below](http://bit.ly/2Xu3kGF)
 * * beyond the threshold limit: ![beyond](http://bit.ly/2EejFpW)
 * * the figure: ![2](http://bit.ly/2H4FOKw)
 * The threshold is taken at 2000 km, based on ![an analysis of
 * current (2010) OD pairs of flight ](http://bit.ly/2OiEFC4)
 *
 * [More detailed explanations here](https://timespace.hypotheses.org/121)
 *
 * @param theta
 * @param speedMax
 * @param transpModeSpeed
 * @param terrestrial
 */
export function getModelledSpeed(theta: number, transpModeSpeed: number, terrestrial: boolean): number {
	return terrestrial
		? // Usual terrestrial mode situation
		  transpModeSpeed
		: // Aerial case ([[terrestrial]] = false)
		theta < thetaThreshold //case [[theta]] < [[thetaThreshold]]
		? // In the general case  750 kph / 2000 km (factor 0.375)
		  ((CONFIGURATION.earthRadiusMeters / 1000) * theta * transpModeSpeed) / distCrowThreshold
		: transpModeSpeed; // case [[theta]] > [[thetaThreshold]]
}

/**
 * For each transport mode:
 * * we identify the 'Road' mode
 * * we determine if it is terrestrial (cones) or not (curve)
 * * the temporal scope of the transport mode
 * * the table of speed of the considered transport modes.
 * the interpolation function used to populate the table returns
 * for each year in the temporal scope an interpolated speed between
 * the two dates when the speed is known
 *
 * Attention: dataset MUST contain a mode named 'Road' that will define the slope of cones
 * cones is the geographic surface and the 'Road' speed is attached to this surface
 *
 * At the end of this loop [[speedPerTransportPerYear]] and [[maximumSpeed]] are populated
 */
export function setSpeedDatas(datas: IMergerData) {
	const transportTypes: ItransportDict = { curves: [], cones: [] };
	const speedPerTranspModePerYear: ISpeedPerTranspModePerYear = {};
	const maxSpeedPerYear: IMaxSpeedPerYear = {};
	const terrestrialMinAlphaPerYear: ITerrestrialMinAlphaPerYear = {};
	datas.transportModes.forEach((transpMode) => {
		const transportCode = transpMode.code;
		const modeName = transpMode.name;

		transportTypes[transpMode.terrestrial ? 'cones' : 'curves'].push(modeName);
		const minYearTransport = transpMode.yearBegin;
		const maxYearTransport = transpMode.yearEnd;
		const tabSpeedPerYear: { [year: string]: ISpeedAlpha } = {};
		const tempTransportCodeTab = transpMode.speedTab
			.map((transportSpeed) => ({
				speed: transportSpeed.speedKPH,
				year: transportSpeed.year,
			}))
			.sort((a, b) => a.year - b.year);
		const interpolation = interpolator(tempTransportCodeTab, 'year', 'speed', false); // Boolean at false to interpolate beyond limits!
		let speed: number;
		for (let year = minYearTransport; year <= maxYearTransport; year++) {
			speed = interpolation(year);
			tabSpeedPerYear[year] = { speed };
			maxSpeedPerYear[year] = maxSpeedPerYear[year] > speed ? maxSpeedPerYear[year] : speed;
			terrestrialMinAlphaPerYear[year] = Infinity;
		}
		speedPerTranspModePerYear[transportCode] = {
			tabSpeedPerYear,
			name: modeName,
			terrestrial: transpMode.terrestrial,
		};
	});
	// console.log('speedPerTranspModePerYear', speedPerTranspModePerYear, 'maxSpeedPerYear', maxSpeedPerYear);
	// for each transport mode, for each year determine [alpha]
	// using maximumSpeed and mode Speed based on [equation 1](http://bit.ly/2tLfehC)
	for (const transportCode in speedPerTranspModePerYear) {
		const tabSpeedPerYear = speedPerTranspModePerYear[transportCode].tabSpeedPerYear;
		const terrestrial = speedPerTranspModePerYear[transportCode].terrestrial;
		for (const year in tabSpeedPerYear) {
			if (maxSpeedPerYear.hasOwnProperty(year)) {
				const maxSpeed = maxSpeedPerYear[year];
				const speedAmb = tabSpeedPerYear[year].speed;
				let alpha = Math.atan(Math.sqrt((maxSpeed / speedAmb) * (maxSpeed / speedAmb) - 1));
				if (alpha < 0) {
					alpha += CONFIGURATION.TWO_PI;
				}
				tabSpeedPerYear[year].alpha = alpha;
				if (terrestrial === true) {
					terrestrialMinAlphaPerYear[year] = Math.min(terrestrialMinAlphaPerYear[year], alpha);
				}
			}
		}
	}
	datas.speedPerTranspModePerYear = speedPerTranspModePerYear;
	datas.maxSpeedPerYear = maxSpeedPerYear;
	datas.transportTypes = transportTypes;
	datas.terrestrialMinAlphaPerYear = terrestrialMinAlphaPerYear;
}
