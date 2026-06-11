import { expect, test } from 'vitest';
import { createCpuWorkflowBackend } from '$lib/compute';
import type { SourceFile } from '$lib/domain/data';

function csv(name: string, text: string): SourceFile {
	return { name, text };
}

function createSourceFiles(): SourceFile[] {
	return [
		csv(
			'cities.csv',
			`cityCode,latitude,longitude,radius
1,0,0,1000
2,1,1,1000
`,
		),
		csv(
			'transport_modes.csv',
			`code,name,terrestrial
1,Road,1
2,Bus,1
`,
		),
		csv(
			'transport_mode_speeds.csv',
			`transportModeCode,year,speedKPH
1,1950,50
2,1950,30
2,1951,35
`,
		),
		csv(
			'transport_network.csv',
			`transportModeCode,cityCodeOri,cityCodeDes,eYearBegin,eYearEnd
1,1,2,1950,1951
2,1,2,1950,1951
`,
		),
		csv(
			'population.csv',
			`cityCode,pop1950
1,100
2,200
`,
		),
		{
			name: 'boundaries.geojson',
			text: JSON.stringify({
				type: 'FeatureCollection',
				features: [
					{
						type: 'Feature',
						properties: { name: 'square' },
						geometry: {
							type: 'Polygon',
							coordinates: [
								[
									[-5, -5],
									[5, -5],
									[5, 5],
									[-5, 5],
									[-5, -5],
								],
							],
						},
					},
				],
			}),
		},
	];
}

test('cpu workflow benchmarks ingestion, geojson and precompute stages from source files', async () => {
	const backend = createCpuWorkflowBackend();
	const result = await backend.run(
		{ sourceFiles: createSourceFiles() },
		{
			profileRequest: { forced: 'cpu' },
			boundaryRaycast: { azimuthSampleCount: 8 },
			staticTown: { sectorCount: 8, neighborLimit: 1 },
			dynamicYear: 1950,
			rawCone: { shape: 'road', azimuthSampleCount: 8, coneLengthMeters: 100000 },
			coneIntersection: { enabled: true },
		},
	);

	expect(result.selection.selected).toBe('cpu');
	expect(result.inspectedFiles.map((file) => file.kind)).toContain('geojson');
	expect(result.baseNetwork.cities).toHaveLength(2);
	expect(result.preparedDataset).toBeDefined();
	if (!result.preparedDataset) {
		throw new Error('preparedDataset should be defined');
	}
	expect(result.staticTown).toBeDefined();
	if (!result.staticTown) {
		throw new Error('staticTown should be defined');
	}
	expect(result.preparedDataset.cityCount).toBe(2);
	expect(result.geojsonRuns).toHaveLength(1);
	expect(result.geojsonRuns[0].boundaryPrecompute.cityContourIndexes).toHaveLength(2);
	expect(result.staticTown.cityCount).toBe(2);
	expect(result.dynamicTown?.year).toBe(1950);
	expect(result.rawCones?.cityCount).toBe(2);
	expect(result.coneIntersections?.cityCount).toBe(2);
	expect(result.benchmark.timings.map((timing) => timing.stage)).toContain('csv-ingestion');
	expect(result.benchmark.timings.map((timing) => timing.stage)).toContain('geojson-boundary-precompute');
	expect(result.benchmark.timings.map((timing) => timing.stage)).toContain('static-town-precompute');
	expect(result.benchmark.timings.map((timing) => timing.stage)).toContain('raw-cones-precompute');
	expect(result.benchmark.totalDurationMs).toBeGreaterThanOrEqual(0);
	expect(result.diagnostics.some((diagnostic) => diagnostic.severity === 'error')).toBe(false);
});
