# Shared Shader Math

This directory groups stage-independent shader math helpers.

Current scope:
- `webgpu.wgsl` for WGSL ports;
- `webgl2.glsl` for GLSL ports.

Guidelines:
- keep the helpers independent of passes and profiles;
- mirror the semantics of `src/lib/shared/math/angles.ts` and the other shared TypeScript math helpers;
- prefer one canonical helper per mathematical operation;
- do not duplicate pass-specific logic here.
