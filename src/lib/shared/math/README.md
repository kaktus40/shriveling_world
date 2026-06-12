# Shared Math

This directory contains stage-independent math primitives used by the CPU reference code, the domain layer and shader ports.

Current scope:
- `angles.ts` for angular normalization, signed deltas and interval checks.

Guidelines:
- keep the helpers free of stage-specific names;
- prefer one canonical helper per mathematical operation;
- reuse the same semantics in TypeScript and shader sources when possible.
