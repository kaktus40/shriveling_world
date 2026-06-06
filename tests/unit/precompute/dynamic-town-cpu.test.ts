import assert from 'node:assert/strict';
import test from 'node:test';
import {
	assembleBaseNetwork,
	inspectDatasetFiles,
	prepareDataset,
	resolveDatasetManifest,
	toStaticTownInput,
	type SourceFile,
} from '../../../src/lib/domain/data';
import {
	DynamicCityLinksView,
	benchmarkDynamicTownPrecomputeCpu,
	computeDynamicTownPrecomputeByYearCpu,
	computeDynamicTownPrecomputeForYearCpu,
	computeStaticTownPrecomputeCpu,
	type StaticTownPrecompute,
} from '../../../src/lib/domain/precompute';

function csv(name: string, text: string): SourceFile {
	return { name, text: text.trim() };
}

function buildFixture() {
	const files = [
		csv('cities.csv', `
cityCode,latitude,longitude,radius,cityName
1,0,0,1000,A
2,0,90,1000,B
3,45,0,1000,C
`),
		csv('modes.csv', `
code,name,terrestrial
1,Road,1
2,Rail,1
3,Express,1
4,Air,0
5,Slow,1
`),
		csv('speeds.csv', `
transportModeCode,year,speedKPH
1,2000,100
1,2002,100
2,2000,200
2,2002,200
3,2000,400
3,2002,400
4,2000,800
4,2002,800
5,2000,50
5,2002,50
`),
		csv('network.csv', `
cityCodeOri,cityCodeDes,transportModeCode,eYearBegin,eYearEnd
1,2,2,2000,2001
1,2,3,2001,2002
1,3,2,,
1,3,1,,
1,2,4,,
2,3,5,,
`),
	];
	const inspected = inspectDatasetFiles(files);
	const baseNetwork = assembleBaseNetwork({ files, manifest: resolveDatasetManifest(inspected) });
	const dataset = prepareDataset(baseNetwork);
	const staticTown = computeStaticTownPrecomputeCpu(toStaticTownInput(dataset), { sectorCount: 8, neighborLimit: 2 });
	return { dataset, staticTown };
}

test('dynamic CPU precompute emits bidirectional active terrestrial links sorted by azimuth', () => {
	const { dataset, staticTown } = buildFixture();
	const dynamic = computeDynamicTownPrecomputeForYearCpu(dataset, staticTown, 2000);
	const cityA = new DynamicCityLinksView(dynamic, 0);

	assert.equal(cityA.count, 2);
	assert.equal(cityA.link(0).destinationCityIndex, 2);
	assert.equal(cityA.link(1).destinationCityIndex, 1);
	assert.ok(cityA.link(0).azimuthRadians < cityA.link(1).azimuthRadians);
	assert.equal(new DynamicCityLinksView(dynamic, 1).count, 2);
	assert.equal(new DynamicCityLinksView(dynamic, 2).count, 2);
});

test('dynamic CPU precompute uses inclusive edge periods and minimum alpha per destination', () => {
	const { dataset, staticTown } = buildFixture();
	const year2000 = computeDynamicTownPrecomputeForYearCpu(dataset, staticTown, 2000);
	const year2001 = computeDynamicTownPrecomputeForYearCpu(dataset, staticTown, 2001);
	const year2002 = computeDynamicTownPrecomputeForYearCpu(dataset, staticTown, 2002);
	const cityA2000 = new DynamicCityLinksView(year2000, 0);
	const cityA2001 = new DynamicCityLinksView(year2001, 0);
	const cityA2002 = new DynamicCityLinksView(year2002, 0);

	assertClose(alphaToward(cityA2000, 1), dataset.speedTimeline.speedByModeByYear['2']['2000'].alphaRadians);
	assertClose(alphaToward(cityA2001, 1), dataset.speedTimeline.speedByModeByYear['3']['2001'].alphaRadians);
	assertClose(alphaToward(cityA2002, 1), dataset.speedTimeline.speedByModeByYear['3']['2002'].alphaRadians);
});

test('dynamic CPU precompute excludes Road and curves and clamps slower terrestrial modes to Road alpha', () => {
	const { dataset, staticTown } = buildFixture();
	const dynamic = computeDynamicTownPrecomputeForYearCpu(dataset, staticTown, 2000);
	const cityB = new DynamicCityLinksView(dynamic, 1);

	assert.equal(cityB.count, 2);
	assertClose(alphaToward(cityB, 2), dynamic.roadAlphaRadians);
	assert.ok(cityB.fastestTerrestrialAlphaRadians < dynamic.roadAlphaRadians);
});

test('dynamic CPU precompute uses contiguous offset plus count lists without holes', () => {
	const { dataset, staticTown } = buildFixture();
	const dynamic = computeDynamicTownPrecomputeForYearCpu(dataset, staticTown, 2001);
	let expectedOffset = 0;

	for (let cityIndex = 0; cityIndex < dataset.cityCount; cityIndex += 1) {
		assert.equal(dynamic.cityLinkOffsets[cityIndex], expectedOffset);
		expectedOffset += dynamic.cityLinkCounts[cityIndex];
	}
	assert.equal(expectedOffset, dynamic.cityLinkDestinationIndexes.length);
	assert.equal(dynamic.cityLinkAzimuthRadians.length, expectedOffset);
	assert.equal(dynamic.cityLinkAlphaRadians.length, expectedOffset);
});

test('dynamic CPU precompute builds every year of the inclusive historical span', () => {
	const { dataset, staticTown } = buildFixture();
	const byYear = computeDynamicTownPrecomputeByYearCpu(dataset, staticTown);

	assert.deepEqual(Object.keys(byYear), ['2000', '2001', '2002']);
	assert.equal(byYear['2002'].year, 2002);
});

test('dynamic CPU benchmark measures one year and the complete historical span', () => {
	const { dataset, staticTown } = buildFixture();
	let clockValue = 0;
	const report = benchmarkDynamicTownPrecomputeCpu(dataset, staticTown, 2001, {
		warmupIterations: 0,
		measurementIterations: 2,
		clock: () => clockValue++,
	});

	assert.equal(report.profile, 'cpu');
	assert.equal(report.year, 2001);
	assert.deepEqual(report.phases.map(({ phase }) => phase), ['dynamic-year', 'dynamic-all-years']);
	assert.ok(report.phases.every(({ wallClock }) => wallClock.medianMilliseconds === 1));
});

test('dynamic CPU precompute rejects mismatched static inputs and unavailable Road years', () => {
	const { dataset, staticTown } = buildFixture();
	assert.throws(
		() => computeDynamicTownPrecomputeForYearCpu(dataset, { ...staticTown, cityCount: 99 } as StaticTownPrecompute, 2000),
		/city count/,
	);
	assert.throws(() => computeDynamicTownPrecomputeForYearCpu(dataset, staticTown, 1999), /Road alpha/);
});

function alphaToward(cityLinks: DynamicCityLinksView, destinationCityIndex: number): number {
	for (let localIndex = 0; localIndex < cityLinks.count; localIndex += 1) {
		const link = cityLinks.link(localIndex);
		if (link.destinationCityIndex === destinationCityIndex) {
			return link.alphaRadians;
		}
	}
	throw new Error(`destination ${destinationCityIndex} not found`);
}

function assertClose(actual: number, expected: number, epsilon = 1e-6): void {
	assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}
