import { test, assert, vi } from 'vitest';
import { createDefaultComputeBackendRegistry, createComputeSession } from '$lib/compute';
import { createWebGl2ComputeBackendDescriptor } from '$lib/compute/webgl2';

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

test('pipelines/programs remain identical across session frames', async () => {
  const canvas = { getContext: (kind: string) => (kind === 'webgl2' ? createFakeGl() : null) } as unknown as HTMLCanvasElement;
  const registry = {
    ...createDefaultComputeBackendRegistry(),
    webgl2: createWebGl2ComputeBackendDescriptor({ canvas } as any),
  };
  const session = createComputeSession(registry);

  const warnSpy = vi.spyOn(console, 'warn');

  await session.warm();

  // full compute
  await session.computeFrame({ sourceFiles: [], geojsonSources: [] }, { benchmark: true }, { preferred: 'webgl2', allowFallback: true });

  // partial recompute: year change
  await session.computeFrame({ sourceFiles: [], geojsonSources: [] }, { passFilter: ['raw-cones-precompute', 'cone-intersections-precompute'], rawCone: { shape: 'road' as any, azimuthSampleCount: 16, coneLengthMeters: 1000, attenuationRadians: 0.1 } }, { preferred: 'webgl2', allowFallback: true });

  // partial recompute: projection change
  await session.computeFrame({ sourceFiles: [], geojsonSources: [] }, { passFilter: ['geojson-boundary-raycast', 'final-cones-precompute'], projection: { start: 'mercator' as any, end: 'geographic' as any, percent: 0.5 } }, { preferred: 'webgl2', allowFallback: true });

  // No pipeline recreation warnings should have occurred because resources are cached per-device/context.
  assert.equal(warnSpy.mock.calls.length, 0, 'no resource recreation warnings');

  warnSpy.mockRestore();
  await session.dispose();
});
