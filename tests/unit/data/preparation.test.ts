import assert from 'node:assert/strict';
import test from 'node:test';
import {
	assembleBaseNetwork,
	identifyRoadMode,
	inspectDatasetFiles,
	prepareSpeedTimeline,
	prepareDataset,
	resolveDatasetManifest,
	toStaticTownInput,
	hasPreparedDatasetErrors,
	PREPARED_EDGE_STRIDE,
	PreparedCityView,
	PreparedEdgeView,
	type BaseNetwork,
	type DatasetDiagnostic,
	type SourceFile,
} from '../../../src/lib/domain/data';
import { computeStaticTownPrecomputeCpu } from '../../../src/lib/domain/precompute';

function csv(name: string, text: string): SourceFile {
	return { name, text: text.trim() };
}

function buildBaseNetwork(overrides: Partial<Record<'transportModes' | 'transportModeSpeeds' | 'transportNetwork', string>> = {}): BaseNetwork {
	const files = [
		csv(
			'cities.csv',
			`
cityCode,latitude,longitude,radius,cityName
1,0,0,1000,A
2,0,10,1000,B
`
		),
		csv(
			'transport_modes.csv',
			overrides.transportModes ??
				`
code,name,terrestrial
1,Road,1
2,Rail,1
3,Air,0
`
		),
		csv(
			'transport_mode_speeds.csv',
			overrides.transportModeSpeeds ??
				`
transportModeCode,year,speedKPH
1,2000,100
1,2010,100
2,2005,200
2,2010,300
3,2005,500
3,2010,700
`
		),
		csv(
			'transport_network.csv',
			overrides.transportNetwork ??
				`
cityCodeOri,cityCodeDes,transportModeCode,eYearBegin,eYearEnd
1,2,2,2005,2010
1,2,3,2007,2010
`
		),
	];
	const inspected = inspectDatasetFiles(files);
	const manifest = resolveDatasetManifest(inspected);
	return assembleBaseNetwork({ files, manifest });
}

function diagnosticCodes(network: BaseNetwork): string[] {
	return prepareSpeedTimeline(network).diagnostics.map((diagnostic) => diagnostic.code);
}

test('identifyRoadMode accepts Road case-insensitively and returns the unique road code', () => {
	const network = buildBaseNetwork({
		transportModes: `
code,name,terrestrial
1, road ,1
2,Rail,1
`,
		transportModeSpeeds: `
transportModeCode,year,speedKPH
1,2000,100
1,2010,100
2,2005,200
2,2010,300
`,
	});
	const diagnostics: DatasetDiagnostic[] = [];
	const road = identifyRoadMode(network, {}, diagnostics);

	assert.deepEqual(diagnostics, []);
	assert.equal(road?.roadModeCode, 1);
});

test('prepareSpeedTimeline reports a missing Road mode', () => {
	const network = buildBaseNetwork({
		transportModes: `
code,name,terrestrial
2,Rail,1
`,
		transportModeSpeeds: `
transportModeCode,year,speedKPH
2,2005,200
2,2010,300
`,
	});

	assert.ok(diagnosticCodes(network).includes('road-mode-missing'));
});

test('prepareSpeedTimeline reports multiple Road modes', () => {
	const network = buildBaseNetwork({
		transportModes: `
code,name,terrestrial
1,Road,1
2,road,1
`,
		transportModeSpeeds: `
transportModeCode,year,speedKPH
1,2000,100
1,2010,100
2,2005,200
2,2010,300
`,
	});

	assert.ok(diagnosticCodes(network).includes('road-mode-ambiguous'));
});

test('prepareSpeedTimeline reports Road when it is not terrestrial', () => {
	const network = buildBaseNetwork({
		transportModes: `
code,name,terrestrial
1,Road,0
2,Rail,1
`,
		transportModeSpeeds: `
transportModeCode,year,speedKPH
1,2000,100
1,2010,100
2,2005,200
2,2010,300
`,
	});

	assert.ok(diagnosticCodes(network).includes('road-mode-not-terrestrial'));
});

test('prepareSpeedTimeline computes historical span, SI speeds and alpha values', () => {
	const timeline = prepareSpeedTimeline(buildBaseNetwork());

	assert.deepEqual(timeline.span, { beginYear: 2005, endYear: 2010 });
	assert.equal(timeline.roadModeCode, 1);
	assert.deepEqual(timeline.transportTypes, { cones: [0, 1], curves: [2] });
	assert.equal(timeline.diagnostics.length, 0);

	const rail2005 = timeline.speedByModeByYear['2']['2005'];
	const rail2010 = timeline.speedByModeByYear['2']['2010'];
	assert.equal(rail2005.speedMetersPerSecond, (200 * 1000) / 3600);
	assert.equal(rail2010.speedMetersPerSecond, (300 * 1000) / 3600);
	assert.ok(timeline.maxSpeedMetersPerSecondByYear['2010'] > rail2010.speedMetersPerSecond);
	assert.ok(rail2010.alphaRadians > 0);
	assert.ok(timeline.terrestrialMinAlphaRadiansByYear['2010'] <= rail2010.alphaRadians);
});

test('prepareSpeedTimeline extrapolates speed values like the historical interpolator', () => {
	const network = buildBaseNetwork({
		transportModeSpeeds: `
transportModeCode,year,speedKPH
1,2000,100
1,2010,100
2,2000,100
2,2010,300
`,
		transportNetwork: `
cityCodeOri,cityCodeDes,transportModeCode,eYearBegin,eYearEnd
1,2,2,2005,2010
`,
	});
	const timeline = prepareSpeedTimeline(network);

	assert.equal(timeline.speedByModeByYear['2']['2005'].speedMetersPerSecond, (200 * 1000) / 3600);
});

test('prepareDataset preserves stable entity order and converts city coordinates to radians', () => {
	const prepared = prepareDataset(buildBaseNetwork());

	assert.equal(prepared.cityCount, 2);
	assert.deepEqual(Array.from(prepared.cityIds), [0, 1]);
	assert.deepEqual(Array.from(prepared.cityCodes), [1, 2]);
	assert.equal(prepared.cityIndexByCode['1'], 0);
	assert.equal(prepared.cityIndexByCode['2'], 1);
	assert.equal(prepared.cityLonLatRadians[0], 0);
	assert.ok(Math.abs(prepared.cityLonLatRadians[2] - Math.PI / 18) < 1e-6);

	assert.equal(prepared.modeCount, 3);
	assert.deepEqual(Array.from(prepared.modeCodes), [1, 2, 3]);
	assert.equal(prepared.edgeCount, 2);
	assert.equal(prepared.edges.length, prepared.edgeCount * PREPARED_EDGE_STRIDE);
	assert.deepEqual(Array.from(prepared.edges), [0, 1, 1, 0, 1, 2]);
	assert.deepEqual(Array.from(prepared.edgeIds), [0, 1]);
	assert.deepEqual(Array.from(prepared.curveEdgePairs), [0, 1, 0, 1]);
	assert.deepEqual(Array.from(prepared.curveEdgeIds), [0, 1]);
	assert.equal(hasPreparedDatasetErrors(prepared), false);
});

test('prepareDataset excludes unresolved edges from compute buffers without deleting lossless records', () => {
	const network = buildBaseNetwork({
		transportNetwork: `
cityCodeOri,cityCodeDes,transportModeCode,eYearBegin,eYearEnd
1,2,2,2005,2010
1,99,3,2007,2010
`,
	});
	const prepared = prepareDataset(network);

	assert.equal(network.edges.length, 2);
	assert.equal(prepared.edgeCount, 1);
	assert.deepEqual(Array.from(prepared.edgeIds), [0]);
	assert.deepEqual(Array.from(prepared.curveEdgePairs), [0, 1]);
	assert.ok(prepared.diagnostics.some((diagnostic) => diagnostic.code === 'prepared-edge-excluded-unresolved'));
});

test('PreparedDataset feeds the complete static-town CPU profile without copying inputs', () => {
	const prepared = prepareDataset(buildBaseNetwork());
	const input = toStaticTownInput(prepared);
	const staticTown = computeStaticTownPrecomputeCpu(input, { sectorCount: 4, neighborLimit: 100 });

	assert.equal(input.cityLonLatRadians, prepared.cityLonLatRadians);
	assert.equal(input.curveEdgePairs, prepared.curveEdgePairs);
	assert.equal(staticTown.cityCount, prepared.cityCount);
	assert.deepEqual(Array.from(staticTown.curveEdgePairs), [0, 1, 0, 1]);
	assert.equal(staticTown.curveControlPointsEcef.length, 32);
});

test('PreparedDataset views expose compact values and lossless traceability ids', () => {
	const prepared = prepareDataset(buildBaseNetwork());
	const city = new PreparedCityView(prepared, 1);
	const edge = new PreparedEdgeView(prepared, 1);

	assert.equal(city.cityIndex, 1);
	assert.equal(city.cityId, 1);
	assert.equal(city.cityCode, 2);
	assert.ok(Math.abs(city.longitudeRadians - Math.PI / 18) < 1e-6);
	assert.equal(city.latitudeRadians, 0);
	assert.equal(edge.edgeId, 1);
	assert.equal(edge.originCityIndex, 0);
	assert.equal(edge.destinationCityIndex, 1);
	assert.equal(edge.modeIndex, 2);
	assert.equal('sourceRecords' in prepared, false);
});
