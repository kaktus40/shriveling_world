import { test, assert, vi } from 'vitest';
import { createDefaultComputeBackendRegistry, createComputeSession } from '$lib/compute';
import { createWebGl2ComputeBackendDescriptor } from '$lib/compute/webgl2';

function createFakeGl(): WebGL2RenderingContext & { __counters?: Record<string, number> } {
  const shader = {} as WebGLShader;
  const program = {} as WebGLProgram;
  const buffer = {} as WebGLBuffer;
  const vao = {} as WebGLVertexArrayObject;
  const transformFeedback = {} as WebGLTransformFeedback;
  const texture = {} as WebGLTexture;
  const uniformLocation = {} as WebGLUniformLocation;

  const counters: Record<string, number> = { createProgram: 0, createShader: 0, createBuffer: 0 };

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
    createShader: () => { counters.createShader++; return shader; },
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    deleteShader: () => {},
    createProgram: () => { counters.createProgram++; return program; },
    attachShader: () => {},
    transformFeedbackVaryings: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    deleteProgram: () => {},
    getUniformLocation: () => uniformLocation,
    createBuffer: () => { counters.createBuffer++; return buffer; },
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
    __counters: counters,
  } as unknown as WebGL2RenderingContext & { __counters?: Record<string, number> };
}

test('pipelines/programs remain identical across session frames', async () => {
  const gl = createFakeGl();
  const canvas = { getContext: (kind: string) => (kind === 'webgl2' ? gl : null) } as unknown as HTMLCanvasElement;
  const registry = {
    ...createDefaultComputeBackendRegistry(),
    webgl2: createWebGl2ComputeBackendDescriptor({ canvas } as any),
  };
  const session = createComputeSession(registry);

  const warnSpy = vi.spyOn(console, 'warn');

  await session.warm();

  // record counts after warm (initial resource creation)
  const afterWarmCreateProgram = gl.__counters?.createProgram ?? 0;
  const afterWarmCreateShader = gl.__counters?.createShader ?? 0;
  const afterWarmCreateBuffer = gl.__counters?.createBuffer ?? 0;

  // Build minimal dataset files required by compute (same as other workspace fixtures)
  const files = [
    { name: 'cities.csv', text: `cityCode,latitude,longitude,radius,cityName\n1,0,0,1000,A\n2,10,20,1000,B` },
    { name: 'population.csv', text: `cityCode,pop1950,pop1960\n1,1000,1200\n2,2000,2400` },
    { name: 'transport_modes.csv', text: `code,name,terrestrial\n1,Road,1\n2,Rail,1\n3,Air,0` },
    { name: 'transport_mode_speeds.csv', text: `transportModeCode,year,speedKPH\n1,2000,100\n1,2010,100\n2,2005,200\n2,2010,300\n3,2005,500\n3,2010,700` },
    { name: 'transport_network.csv', text: `cityCodeOri,cityCodeDes,transportModeCode,eYearBegin,eYearEnd\n1,2,2,2005,2010\n1,2,3,2007,2010` },
    { name: 'boundaries.geojson', text: JSON.stringify({ type: 'FeatureCollection', features: [] }) },
  ];

  const geojsonSources = [{ fileName: 'boundaries.geojson', geojson: { type: 'FeatureCollection', features: [] } }];

  // full compute
  await session.computeFrame({ sourceFiles: files, geojsonSources }, { benchmark: true }, { preferred: 'webgl2', allowFallback: true });

  // capture counts after full compute
  const afterFullCreateProgram = gl.__counters?.createProgram ?? 0;
  const afterFullCreateShader = gl.__counters?.createShader ?? 0;
  const afterFullCreateBuffer = gl.__counters?.createBuffer ?? 0;

  // partial recompute: year change
  await session.computeFrame({ sourceFiles: files, geojsonSources }, { passFilter: ['raw-cones-precompute', 'cone-intersections-precompute'], rawCone: { shape: 'road' as any, azimuthSampleCount: 16, coneLengthMeters: 1000, attenuationRadians: 0.1 } }, { preferred: 'webgl2', allowFallback: true });

  // capture counts after partial year recompute
  const afterYearCreateProgram = gl.__counters?.createProgram ?? 0;
  const afterYearCreateShader = gl.__counters?.createShader ?? 0;
  const afterYearCreateBuffer = gl.__counters?.createBuffer ?? 0;

  // partial recompute: projection change
  await session.computeFrame({ sourceFiles: files, geojsonSources }, { passFilter: ['geojson-boundary-raycast', 'final-cones-precompute'], projection: { start: 'mercator' as any, end: 'geographic' as any, percent: 0.5 } }, { preferred: 'webgl2', allowFallback: true });

  // capture counts after projection recompute
  const afterProjectionCreateProgram = gl.__counters?.createProgram ?? 0;
  const afterProjectionCreateShader = gl.__counters?.createShader ?? 0;
  const afterProjectionCreateBuffer = gl.__counters?.createBuffer ?? 0;

  // No pipeline recreation warnings should have occurred because resources are cached per-device/context.
  assert.equal(warnSpy.mock.calls.length, 0, 'no resource recreation warnings');

  // Ensure create* counts did not increase after initial warm/full compute phases (resources reused)
  assert.equal(afterFullCreateProgram, afterWarmCreateProgram, 'no new programs created after warm');
  assert.equal(afterYearCreateProgram, afterFullCreateProgram, 'no new programs created on year recompute');
  assert.equal(afterProjectionCreateProgram, afterFullCreateProgram, 'no new programs created on projection recompute');

  assert.equal(afterFullCreateShader, afterWarmCreateShader, 'no new shaders created after warm');
  assert.equal(afterYearCreateShader, afterFullCreateShader, 'no new shaders created on year recompute');
  assert.equal(afterProjectionCreateShader, afterFullCreateShader, 'no new shaders created on projection recompute');

  assert.equal(afterFullCreateBuffer, afterWarmCreateBuffer, 'no new buffers created after warm');
  assert.equal(afterYearCreateBuffer, afterFullCreateBuffer, 'no new buffers created on year recompute');
  assert.equal(afterProjectionCreateBuffer, afterFullCreateBuffer, 'no new buffers created on projection recompute');

  warnSpy.mockRestore();
  await session.dispose();
});
