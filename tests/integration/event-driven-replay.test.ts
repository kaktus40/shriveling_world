import { test, assert } from 'vitest';

import {
  assembleBaseNetwork,
  inspectDatasetFiles,
  prepareDataset,
  resolveDatasetManifest,
  type SourceFile,
} from '$lib/domain/data';
import { createComputeSession } from '$lib/compute';
import { createDefaultComputeBackendRegistry, createWebGl2ComputeBackendDescriptor } from '$lib/compute';

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
  // Build a registry that forces the use of a fake WebGL2 backend so the
  // passFilter logic exercised by WebGL2/WebGPU runners can be tested in CI.
  function createFakeGl(): WebGL2RenderingContext {
    const shader = {} as WebGLShader;
    const program = {} as WebGLProgram;
    const buffer = {} as WebGLBuffer;
    const vao = {} as WebGLVertexArrayObject;
    const transformFeedback = {} as WebGLTransformFeedback;
    const texture = {} as WebGLTexture;
    const uniformLocation = {} as WebGLUniformLocation;
    return {
      VERTEX_SHADER: 0x8b31,
      FRAGMENT_SHADER: 0x8b30,
      COMPILE_STATUS: 0x8b81,
      LINK_STATUS: 0x8b82,
      INTERLEAVED_ATTRIBS: 0x8c8c,
      SEPARATE_ATTRIBS: 0x8c8d,
      ARRAY_BUFFER: 0x8892,
      TRANSFORM_FEEDBACK_BUFFER: 0x8c8e,
      STATIC_DRAW: 0x88e4,
      DYNAMIC_COPY: 0x88ea,
      POINTS: 0x0000,
      RASTERIZER_DISCARD: 0x8c89,
      TRANSFORM_FEEDBACK: 0x8e22,
      TEXTURE_2D: 0x0de1,
      TEXTURE0: 0x84c0,
      NEAREST: 0x2600,
      CLAMP_TO_EDGE: 0x812f,
      RGBA32F: 0x8814,
      RG32F: 0x8230,
      R32UI: 0x8236,
      R32I: 0x8235,
      RGBA: 0x1908,
      RG: 0x8227,
      RED_INTEGER: 0x8d94,
      FLOAT: 0x1406,
      INT: 0x1404,
      UNSIGNED_INT: 0x1405,
      UNPACK_ALIGNMENT: 0x0cf5,
      createShader: () => shader,
      shaderSource: () => {},
      compileShader: () => {},
      getShaderParameter: () => true,
      getShaderInfoLog: () => '',
      deleteShader: () => {},
      createProgram: () => program,
      attachShader: () => {},
      transformFeedbackVaryings: () => {},
      linkProgram: () => {},
      getProgramParameter: () => true,
      getProgramInfoLog: () => '',
      deleteProgram: () => {},
      getUniformLocation: () => uniformLocation,
      createBuffer: () => buffer,
      bindBuffer: () => {},
      bufferData: () => {},
      createVertexArray: () => vao,
      bindVertexArray: () => {},
      enableVertexAttribArray: () => {},
      vertexAttribPointer: () => {},
      createTransformFeedback: () => transformFeedback,
      bindTransformFeedback: () => {},
      bindBufferBase: () => {},
      createTexture: () => texture,
      bindTexture: () => {},
      texParameteri: () => {},
      texImage2D: () => {},
      activeTexture: () => {},
      pixelStorei: () => {},
      uniform1i: () => {},
      uniform4f: () => {},
      useProgram: () => {},
      uniform1f: () => {},
      getBufferSubData: (_target: number, _offset: number, output: ArrayBufferView) => {
        if (output instanceof Float32Array) {
          output.fill(1234.5);
        }
      },
      enable: () => {},
      disable: () => {},
      beginTransformFeedback: () => {},
      drawArrays: () => {},
      drawArraysInstanced: () => {},
      endTransformFeedback: () => {},
      finish: () => {},
    } as unknown as WebGL2RenderingContext;
  }

  function createFakeCanvas(): HTMLCanvasElement {
    return { getContext: (kind: string) => (kind === 'webgl2' ? createFakeGl() : null) } as unknown as HTMLCanvasElement;
  }

  const registry = {
    ...createDefaultComputeBackendRegistry(),
    webgl2: createWebGl2ComputeBackendDescriptor({ canvas: createFakeCanvas() } as any),
  };

  const session = createComputeSession(registry);
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
      rawCone: { shape: 'road' as any, azimuthSampleCount: 16, coneLengthMeters: 1000, attenuationRadians: 0.1 },
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
