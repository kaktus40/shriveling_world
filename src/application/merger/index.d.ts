import type { INEDLocalGLSL } from '../definitions/project';

/**
 * An item grouping for a fixed year and a fixed origin city,
 * all the data needed to generate a simple or
 * a complex cone with the slope for road and the slope for each
 * destination city (clock) using a terrestrial transport.
 */
export interface IConeAnglesItem {
	/**
	 * This property represents the slope of the road transport for the considered year.
	 */
	coneRoadAlpha: number;
	// angle of the non-road fastest terrestrial mode linked to the city
	coneFastTerrModeAlpha: number;
	/**
	 * This property lists for the considered year and the considered origin city
	 * each destination city using a terrestrial transport. Each item of this
	 * array is a clock in direction of the destination city and a slope
	 * corresponding to the transport speed linking the two cities. This array can have zero item.
	 */
	alphaTab: Array<{ clock: number; alpha: number }>;
}

/**
 * It's a lookup mapping for a given year the slope angle between earth surface
 * and cone slope as cone radius is determined, it's the key parameter for cone geometries.
 *
 * This slope (alpha) is determined by ![equation 1](http://bit.ly/2tLfehC)
 */
export interface ILookupConeAngles {
	[year: string]: IConeAnglesItem;
}

/**
 * A transport mode has a given speed for a given year
 *
 * Table of couples year-speed for each transport mode
 */
export interface ILookupTranspModeSpeed {
	[transpModeCode: string]: Array<{ year: number; speed: number }>;
}

/**
 * A transport mode is associated to a cone slope (alpha)
 * for a given year
 */
// export interface ILookupConeAlpha {
//   [transpModeCode: string]: ILookupAlpha;
// }

/**
 * a table of destination [[cityCode]] and the associated
 * transport modes and their respective speed
 */
export interface ILookupDestWithModes {
	[cityCode: string]: ILookupTranspModeSpeed;
}

/**
 * A city and its incident edges in the network:
 * * a [[referential]] of coordinates in [[NEDLocal]]
 * * a table of transport modes and their alphas
 * * a list of destinations and associated transport modes
 * forming the sub-graph edges (centred on the city)
 * * a table of [[origCityProperties]]
 */
export interface ICityGraph {
	referential: NEDLocal; // À inhiber dans forbiddenAttributes de coneMeshShader
	cone: ILookupConeAngles; // À inhiber dans forbiddenAttributes de coneMeshShader
	destinationsWithModes: ILookupDestWithModes;
	origCityProperties: ICity;
}
/**
 * A [[ILookupCityGraph]] searches
 * * a cityCode
 * * and retrieves a piece of network [[ICityNetwork]] made of
 * * incident edges of cityCode in the transport network
 *
 * <uml>
 *     ILookupCityGraph<-ICityGraph
 * </uml>
 */
export interface ILookupCityGraph {
	[cityCode: string]: ICityGraph;
}

export interface IPopulation {
	cityCode?: number;
}

/**
 * City interface
 *
 * Parameters attached to each city:
 * * [[cityCode]]
 * * [[countryCode]]
 * * [[countryName]]
 * * [[cityName]] is the name of the city
 * * [[radius]]: number; // for cases of cities in islands close to a continent
 * * [[populations]] (optional) for several years as provided in csv file 'population.csv'
 * * [[edges]] (optional) is a table will be determined by scanning the [[ITransportNetwork]]
 * * with temporary fields [[inEdges]] and [[outEdges]]
 * * [[dist]] and [[prev]] are used for computing minimum path
 */
export interface ICity {
	cityCode: number;
	countryCode: number;
	countryName: string;
	cityName: string;
	latitude: number;
	longitude: number;
	radius: number; // For cases of cities in islands close to a continent
	populations?: IPopulation;
	outEdges?: IEdge[];
	inEdges?: IEdge[];
	edges?: IEdge[];
	timeDist?: number;
	prev?: ICity;
}

/**
 * The [[speedKPH]] of a given transport mode may be different
 * depending on [[year]]
 */
export interface ITransportModeSpeed {
	year: number;
	transportModeCode: number;
	speedKPH: number;
}

/**
 * A transport mode has
 * * a [[name]],
 * * a [[code]],
 * * can be [[terrestrial]] or not,
 * * and has a table of speeds [[speedTab]] that may change over years
 *
 * If mode is 'terrestrial' the transport mode speed can affect the slope of cones
 * All the info before come from reading files ("transport_mode" and "transport_mode_speed")
 * The info below is computed in the code:
 * * [[minEYear]] and
 * * [[maxEYear]] are computed from info at edge level in file "transport_network"
 * * [[minSYear]] and
 * * [[maxSYear]] are computed from "transport_mode_speed" file
 * * [[yearBegin]] and
 * * [[yearEnd]] are computed from previous values
 **/
export interface ITranspMode {
	name: string;
	code: number;
	terrestrial: boolean; // If yes the transport mode speed can affect the slope of cones
	speedTab: ITransportModeSpeed[];
	minEYear?: number;
	maxEYear?: number;
	minSYear?: number;
	maxSYear?: number;
	yearBegin?: number;
	yearEnd?: number;
}

/**
 * Here we find data of a graph edge in the [[IEdge]]
 * All data here come from the "transport_network" file
 *
 * An edge is defined by:
 * * an origin [[cityCodeOri]]
 * * and  destination [[cityCodeDes]]
 * * a transport mode [[transportModeCode]]
 * Each edge can have zero, one or two
 * dates attached:
 * * a [[eYearBegin]] (optional) and
 * * a [[eYearEnd]] (optional)
 */
export interface IEdge {
	cityCodeOri?: number;
	cityCodeDes: number;
	transportModeCode: number;
	eYearBegin?: number;
	eYearEnd?: number;
	dist?: number;
	prev?: number;
	distCrowKM?: number;
}

export type IMergerState = 'missing' | 'ready' | 'pending' | 'complete';
/**
 * [[ILookupCurvesAndCityGraph]] contains
 * * [[ILookupCityGraph]] network data (graph data) with modes and speed parameters
 * * [[curvesData]] curves data for geometric processes
 *
 * (some duplication but the purposes are different)
 */
export interface ILookupCurvesAndCityGraph {
	lookupCityGraph: ILookupCityGraph;
	curvesData: ILookupCurves;
}
/**
 * Defines the city at the other extremity of an edge
 */
export interface ICityExtremityOfEdge {
	cityCode: string | number;
	position: LonLatH;
}
/**
 * Curve data associated to an edge from a given city
 *
 * [[pointP]] and [[pointQ]] are control points for Bezier curves
 *
 * [[theta]] is the angle between cities
 */
export interface IlookupCurveGeometry {
	endCity: ICityExtremityOfEdge;
	pointP: LonLatH;
	pointQ: LonLatH;
	middle: LonLatH;
	speedPerModePerYear: { [transportName: string]: { [year: string]: number } };
	maxSpeedPerYear: { [year: string]: number };
	theta: number;
}
/**
 * Curves from a city
 */
export interface ILookupCurvesFromCity {
	beginCity: ICityExtremityOfEdge;
	curvesList: { [cityCodeEnd: string]: IlookupCurveGeometry };
}
/**
 * A curve and its associated graph edge has a [[cityCodeBegin]]
 *
 * other parameters of this curve derive from the [[ILookupCurveItem]]
 */
export interface ILookupCurves {
	[cityCodeBegin: number]: ILookupCurvesFromCity;
}

export interface ICodeSpeedPerYear {
	[code: string]: {
		speed: number;
		alpha?: number;
	};
}

/**
 * [[ITransportCodeItem]] has
 * * a [[speed]] and
 * * a [[year]]
 */
export interface ITransportCodeItem {
	speed: number;
	year: number;
}
/**
 * Associating a speed to an alpha (cone slope)
 * as in [equation 1](http://bit.ly/2tLfehC)
 */
export interface ISpeedAlpha {
	speed: number;
	alpha?: number;
}
/**
 * Interface of a transport mode with table od speed
 */
export interface ITabSpeedPerTranspModePerYear {
	tabSpeedPerYear: { [year: string]: ISpeedAlpha };
	name: string;
	terrestrial: boolean;
}
/**
 * [[ILookupCacheAnchorsEdgeCone]] describes:
 * * an edge with an end (optional) middle, pointP
 *   at 1/4 anf pointQ at 3/4, as anchor points
 * * description of the cone with
 *   theta the angle between the two cities
 *   and clock the unit triangle tha generates the cone
 */
export interface ILookupCacheAnchorsEdgeCone {
	end?: ICityExtremityOfEdge;
	pointP: LonLatH;
	pointQ: LonLatH;
	middle: LonLatH;
	theta: number;
	clock: number;
}

export interface IStaticTownHelper {
	/**
	 * map linking city code (key), with city order in the list (value)
	 */
	cityMap: Map<number, number>;
	/**
	 * number of neighboor per town
	 */
	neighboorLimit: number;
	/**
	 * a float array that defines the "neighboorLimit" neighboors of a town. It's a two dimensions array (abscisse= order of neighboor townB and ordonnées= townA). Each cell has 3 members: order of townB, azimut to townB, azimut from townB
	 */
	townOverlaps: Float32Array;
	/**
	 * azimut-distance-midpoint of town A (abscisses) to town B (ordonnées)
	 */
	azDistMid: Float32Array;
	/**
	 * point P - point Q  of town A (abscisses) to town B (ordonnées)
	 */
	pointPPointQ: Float32Array;
	/**
	 * vecteur unitaire de A vers B dans NED de A +elevation  from town A (abscisses) to town B (ordonnées)
	 */
	vUnitAndElevation: Float32Array;
	citiesGlslDatas: INEDLocalGLSL[];
}
export interface IDynamicTownPreGeometry {
	cityLinks: Float32Array;
	citiesDict: Int16Array;
	roadAlpha: number;
}

export interface IMergerData {
	cities?: ICity[];
	populations?: IPopulation[];
	transportModeSpeeds?: ITransportModeSpeed[];
	transportModes?: ITranspMode[];
	transportNetwork?: IEdge[];
	roadCode?: number;
	span?: { begin: number; end: number };
	transportTypes?: ItransportDict;
	speedPerTranspModePerYear?: ISpeedPerTranspModePerYear;
	maxSpeedPerYear?: IMaxSpeedPerYear;
	terrestrialMinAlphaPerYear?: ITerrestrialMinAlphaPerYear;
	staticTownData?: IStaticTownHelper;
	dynamicTownData?: { [year: string]: IDynamicTownPreGeometry };
}

export interface ItransportDict {
	curves: string[];
	cones: string[];
}
export interface ISpeedPerTranspModePerYear {
	[transportCode: string]: ITabSpeedPerTranspModePerYear;
}

interface IMaxSpeedPerYear {
	[year: string]: number;
}

export interface ITerrestrialMinAlphaPerYear {
	[year: string]: number;
}

export interface ICodeSpeedPerYear {
	[code: string]: {
		speed: number;
		alpha?: number;
	};
}
