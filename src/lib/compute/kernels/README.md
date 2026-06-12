# Compute Kernels

Conventions:
- one folder per pass when the pass exists in both profiles;
- one folder for shared primitives when a shader is reused by multiple passes;
- profile-specific entry points live under `webgpu.wgsl` and `webgl2.vert` (or `webgl2.glsl` for shared primitives when needed);
- keep kernel names stable across docs, tests, and backends.

Current layout:

```text
shared/ray-intersect-triangle/
  webgpu.wgsl
  webgl2.glsl
shared/math/
  webgpu.wgsl
  webgl2.glsl
city-ned2ecef/
  webgpu.wgsl
  webgl2.vert
boundary-algebre/
  webgpu.wgsl
  webgl2.vert
raw-cone-alphas/
  webgpu.wgsl
  webgl2.vert
ciseled-cones/
  webgpu.wgsl
  webgl2.vert
final-cones/
  webgpu.wgsl
  webgl2.vert
curve-geometry/
  webgpu.wgsl
  webgl2.vert
```
