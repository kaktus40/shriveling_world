import assert from 'node:assert/strict';
import { expect, test } from 'vitest';

import {
	createWebGl2WorkflowBackendDescriptor,
	probeWebGl2Availability,
	type WebGl2WorkflowBackendOptions,
} from '$lib/compute';

import type { SourceFile } from '$lib/domain/data';

function csv(name: string, text: string): SourceFile {
	return { name, text: text.trim() };
}

function buildMinimalDataset(): { sourceFiles: SourceFile[]; geojsonSources: { fileName: string; geojson: GeoJSON.FeatureCollection }[] } {
	return {
		sourceFiles: [
			csv(
				'cities.csv',
				`
cityCode,latitude,longitude,radius,cityName
1,0,0,1000,A
2,10,20,1000,B
`
			),
			csv(
				'population.csv',
				`
cityCode,pop1950,pop1960
1,1000,1200
2,2000,2400
`
			),
			csv(
				'transport_modes.csv',
				`
code,name,terrestrial
1,Road,1
2,Rail,1
`
			),
			csv(
				'transport_mode_speeds.csv',
				`
transportModeCode,year,speedKPH
1,2000,100
2,2000,200
`
			),
			csv(
				'transport_network.csv',
				`
cityCodeOri,cityCodeDes,transportModeCode,eYearBegin,eYearEnd
1,2,2,2000,2010
`
			),
			{
				name: 'boundaries.geojson',
				text: JSON.stringify({
					type: 'FeatureCollection',
					features: [],
				}),
			},
		],
		geojsonSources: [
			{
				fileName: 'boundaries.geojson',
				geojson: { type: 'FeatureCollection', features: [] },
			},
		],
	};
}

function createFakeCanvas(): WebGl2WorkflowBackendOptions['canvas'] {
	return {
		getContext: (kind: string) => (kind === 'webgl2' ? ({} as WebGL2RenderingContext) : null),
	} as unknown as WebGl2WorkflowBackendOptions['canvas'];
}

test('webgl2 probe stays false without a canvas', () => {
	expect(probeWebGl2Availability(undefined)).toBe(false);
	expect(createWebGl2WorkflowBackendDescriptor().isAvailable()).toBe(false);
});

test('webgl2 probe becomes available with a webgl2-capable canvas and the backend keeps the selected profile', async () => {
	const descriptor = createWebGl2WorkflowBackendDescriptor({ canvas: createFakeCanvas() });
	assert.equal(await descriptor.isAvailable(), true);

	const backend = await descriptor.create();
	const result = await backend.run(
		buildMinimalDataset(),
		{ benchmark: true },
		{
			requested: 'webgl2',
			forced: 'webgl2',
			selected: 'webgl2',
			fallbackUsed: false,
			capabilities: {
				webgpuAvailable: false,
				webgl2Available: true,
				cpuAvailable: true,
				notes: ['WebGL2 skeleton backend'],
			},
		},
	);

	expect(result.selection.selected).toBe('webgl2');
	expect(result.benchmark.profile).toBe('webgl2');
	expect(result.benchmark.notes.some((note) => note.includes('delegates compute stages to the CPU reference backend'))).toBe(true);
	expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'webgl2-skeleton-cpu-delegation')).toBe(true);
});
