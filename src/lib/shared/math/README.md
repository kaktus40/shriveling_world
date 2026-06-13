# Shared Math

This directory contains stage-independent math primitives used by the CPU reference code, the domain layer and shader ports.

Current scope:
- `angles.ts` for angular normalization, signed deltas and interval checks.
- `projections.ts` for the shared cartographic formulas used by the application
  shell, the final-cones emission stage, and projection tests.

Guidelines:
- keep the helpers free of stage-specific names;
- prefer one canonical helper per mathematical operation;
- reuse the same semantics in TypeScript and shader sources when possible.

Projection note:
- the `final-cones` stage is the canonical point where the projection mix is
  applied;
- the renderer consumes already projected cone geometry;
- CPU, WebGL2 and WebGPU should use the same projection transition and settings
  contract.
