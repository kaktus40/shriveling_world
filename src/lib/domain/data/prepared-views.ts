import {
	PREPARED_EDGE_STRIDE,
	UNBOUNDED_EDGE_YEAR_BEGIN,
	UNBOUNDED_EDGE_YEAR_END,
	type PreparedDataset,
} from './types';

/** Read-only view over one city in a compact prepared dataset. */
export class PreparedCityView {
	readonly #dataset: PreparedDataset;
	readonly #cityIndex: number;

	constructor(dataset: PreparedDataset, cityIndex: number) {
		assertIndex(cityIndex, dataset.cityCount, 'cityIndex');
		this.#dataset = dataset;
		this.#cityIndex = cityIndex;
	}

	/** Stable dense index shared by every prepared and compute buffer. */
	get cityIndex(): number {
		return this.#cityIndex;
	}

	/** Base-network city id used to recover the lossless city entity. */
	get cityId(): number {
		return this.#dataset.cityIds[this.#cityIndex];
	}

	/** Source-record id used to recover all original city columns. */
	get sourceRecordId(): number {
		return this.#dataset.citySourceRecordIds[this.#cityIndex];
	}

	/** Source city code. */
	get cityCode(): number {
		return this.#dataset.cityCodes[this.#cityIndex];
	}

	/** Internal longitude in radians. */
	get longitudeRadians(): number {
		return this.#dataset.cityLonLatRadians[this.#cityIndex * 2];
	}

	/** Internal latitude in radians. */
	get latitudeRadians(): number {
		return this.#dataset.cityLonLatRadians[this.#cityIndex * 2 + 1];
	}
}

/** Read-only view over one directed edge in a compact prepared dataset. */
export class PreparedEdgeView {
	readonly #dataset: PreparedDataset;
	readonly #edgeIndex: number;
	readonly #offset: number;

	constructor(dataset: PreparedDataset, edgeIndex: number) {
		assertIndex(edgeIndex, dataset.edgeCount, 'edgeIndex');
		this.#dataset = dataset;
		this.#edgeIndex = edgeIndex;
		this.#offset = edgeIndex * PREPARED_EDGE_STRIDE;
	}

	/** Stable position inside the prepared edge buffers. */
	get edgeIndex(): number {
		return this.#edgeIndex;
	}

	/** Base-network edge id used to recover the lossless edge entity. */
	get edgeId(): number {
		return this.#dataset.edgeIds[this.#edgeIndex];
	}

	/** Source-record id used to recover all original edge columns. */
	get sourceRecordId(): number {
		return this.#dataset.edgeSourceRecordIds[this.#edgeIndex];
	}

	/** Dense origin city index. */
	get originCityIndex(): number {
		return this.#dataset.edges[this.#offset];
	}

	/** Dense destination city index. */
	get destinationCityIndex(): number {
		return this.#dataset.edges[this.#offset + 1];
	}

	/** Dense transport-mode index. */
	get modeIndex(): number {
		return this.#dataset.edges[this.#offset + 2];
	}

	/** Inclusive opening year, or `null` when the edge has no lower bound. */
	get yearBegin(): number | null {
		const year = this.#dataset.edgeYearBegins[this.#edgeIndex];
		return year === UNBOUNDED_EDGE_YEAR_BEGIN ? null : year;
	}

	/** Inclusive closing year, or `null` when the edge has no upper bound. */
	get yearEnd(): number | null {
		const year = this.#dataset.edgeYearEnds[this.#edgeIndex];
		return year === UNBOUNDED_EDGE_YEAR_END ? null : year;
	}
}

function assertIndex(index: number, count: number, name: string): void {
	if (!Number.isSafeInteger(index) || index < 0 || index >= count) {
		throw new RangeError(`${name} must be a valid prepared index`);
	}
}
