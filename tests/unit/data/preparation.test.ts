import assert from 'node:assert/strict';
import test from 'node:test';
import {
	assembleBaseNetwork,
	identifyRoadMode,
	inspectDatasetFiles,
	prepareSpeedTimeline,
	resolveDatasetManifest,
	type BaseNetwork,
	type DatasetDiagnostic,
	type SourceFile,
} from '../../../src/lib/domain/data';

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
