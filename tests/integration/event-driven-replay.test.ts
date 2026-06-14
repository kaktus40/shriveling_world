import { test, assert } from 'vitest';

import {
  assembleBaseNetwork,
  inspectDatasetFiles,
  prepareDataset,
  resolveDatasetManifest,
  type SourceFile,
} from '$lib/domain/data';
import { createWorkspaceComputeSession } from '$lib/application/workspace';

function csv(name: string, text: string): SourceFile {
  return { name, text: text.trim() };
}

function buildWorkspaceFixture() {
  const files = [
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
3,Air,0
`
    ),
    csv(
      'transport_mode_speeds.csv',
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
      `
cityCodeOri,cityCodeDes,transportModeCode,eYearBegin,eYearEnd
1,2,2,2005,2010
1,2,3,2007,2010
`
    ),
    {
      name: 'boundaries.geojson',
      text: JSON.stringify({ type: 'FeatureCollection', features: [] }),
    },
  ];

  const inspectedFiles = inspectDatasetFiles(files);
  const manifest = resolveDatasetManifest(inspectedFiles);
  const baseNetwork = assembleBaseNetwork({ files, manifest });
  const preparedDataset = prepareDataset(baseNetwork);

  return {
    datasetName: 'fixture',
    files,
    pipeline: {
      inspectedFiles,
      manifest,
      baseNetwork,
      preparedDataset,
    },
    geojsonEntries: [
      { fileName: 'boundaries.geojson', geojson: { type: 'FeatureCollection', features: [] } },
    ],
  };
}

// Integration test asserting event-driven selective execution via passFilter.
test('event-driven: selective re-execution with passFilter', async () => {
  const workspace = buildWorkspaceFixture();
  const session = createWorkspaceComputeSession();
  await session.warm();

  // Full compute (no passFilter) should produce a full benchmark with many stages.
  const fullResult = await session.computeFrame(
    {
      sourceFiles: workspace.files,
      geojsonSources: workspace.geojsonEntries,
    },
    {
      benchmark: true,
      boundaryRaycast: { azimuthSampleCount: 360 },
      staticTown: { sectorCount: 360, neighborLimit: 4 },
      rawCone: { shape: 'symmetric' as any, azimuthSampleCount: 16, coneLengthMeters: 1000, attenuationRadians: 0.1 },
      coneIntersection: { enabled: true },
    },
    { preferred: 'webgl2', allowFallback: true },
  );

  const allStages = fullResult.benchmark.timings.map((t) => t.stage);
  assert.ok(allStages.includes('geojson-boundary-raycast'), 'full run should include geojson-boundary-raycast');
  assert.ok(allStages.includes('raw-cones-precompute'), 'full run should include raw-cones-precompute');

  // Simulate an event that only requires cone re-compute (year change): request only cone-related stages.
  const coneOnlyResult = await session.computeFrame(
    {
      sourceFiles: workspace.files,
      geojsonSources: workspace.geojsonEntries,
    },
    {
      benchmark: true,
      dynamicYear: 2010,
      passFilter: ['static-town-precompute', 'raw-cones-precompute', 'cone-intersections-precompute'],
    },
    { preferred: 'webgl2', allowFallback: true },
  );

  const coneStages = coneOnlyResult.benchmark.timings.map((t) => t.stage);
  assert.ok(coneStages.includes('raw-cones-precompute'), 'cone-only run should include raw-cones-precompute');
  assert.ok(!coneStages.includes('geojson-boundary-raycast'), 'cone-only run must NOT include geojson-boundary-raycast');

  // Simulate an event that only requires boundary re-compute (projection change)
  const boundaryOnlyResult = await session.computeFrame(
    {
      sourceFiles: workspace.files,
      geojsonSources: workspace.geojsonEntries,
    },
    {
      benchmark: true,
      projection: { start: 'mercator' as any, end: 'geographic' as any, percent: 0.5 },
      passFilter: ['geojson-boundary-raycast', 'final-cones-precompute'],
    },
    { preferred: 'webgl2', allowFallback: true },
  );

  const boundaryStages = boundaryOnlyResult.benchmark.timings.map((t) => t.stage);
  assert.ok(boundaryStages.includes('geojson-boundary-raycast'), 'boundary-only run should include geojson-boundary-raycast');
  assert.ok(!boundaryStages.includes('raw-cones-precompute'), 'boundary-only run must NOT include raw-cones-precompute');

  await session.dispose();
});
