import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
	assembleBaseNetwork,
	inspectDatasetFiles,
	prepareDataset,
	resolveDatasetManifest,
	toStaticTownInput,
	type BaseNetwork,
	type SourceFile,
} from '../../../src/lib/domain/data';
import {
	computeCurveVertexBufferCpu,
	prepareCurveGeometryInput,
	prepareCurvePrecompute,
	computeStaticTownPrecomputeCpu,
} from '../../../src/lib/domain/precompute';

function csv(name: string, text: string): SourceFile {
	return { name, text: text.trim() };
}

function buildBaseNetwork(): BaseNetwork {
	const files = [
		csv(
			'cities.csv',
			`
cityCode,latitude,longitude,radius,cityName
1,0,0,1000,A
2,0,10,1000,B
`,
		),
		csv(
			'transport_modes.csv',
			`
code,name,terrestrial
1,Road,1
2,Rail,1
`,
		),
		csv(
			'transport_mode_speeds.csv',
			`
transportModeCode,year,speedKPH
1,2010,100
2,2010,300
`,
		),
		csv(
			'transport_network.csv',
			`
cityCodeOri,cityCodeDes,transportModeCode,eYearBegin,eYearEnd
1,2,2,2010,2010
`,
		),
	];
	const inspected = inspectDatasetFiles(files);
	const manifest = resolveDatasetManifest(inspected);
	return assembleBaseNetwork({ files, manifest });
}

test('curve geometry CPU sampling preserves endpoints and produces dense vec4 positions', () => {
	const prepared = prepareDataset(buildBaseNetwork());
	const staticTown = computeStaticTownPrecomputeCpu(toStaticTownInput(prepared), {
		sectorCount: 4,
		neighborLimit: 1,
	});
	const curvePrecompute = prepareCurvePrecompute(prepared, staticTown);
	const geometryInput = prepareCurveGeometryInput(curvePrecompute, {
		year: 2010,
		pointsPerCurve: 2,
		curvePosition: 'above',
		coefficient: 1,
	});
	const geometry = computeCurveVertexBufferCpu(geometryInput);

	assert.equal(geometry.curveCount, 1);
	assert.equal(geometry.pointsPerCurve, 2);
	assert.equal(geometry.positions.length, 12);
	assert.equal(geometry.positions[3], 1);
	assert.equal(geometry.positions[7], 1);
	assert.equal(geometry.positions[11], 1);
	assert.deepEqual(Array.from(geometry.positions.slice(0, 4)), Array.from(staticTown.curveControlPointsEcef.slice(0, 4)));
	assert.deepEqual(Array.from(geometry.positions.slice(8, 12)), Array.from(staticTown.curveControlPointsEcef.slice(12, 16)));
});
