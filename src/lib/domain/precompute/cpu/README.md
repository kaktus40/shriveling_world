# CPU Precompute

Conventions:
- one file per pass or logical CPU tranche;
- keep pass names stable across CPU, WebGL2 and WebGPU;
- prefer small helper modules over a single monolithic backend file;
- export the CPU pass implementations through `src/lib/domain/precompute/cpu/index.ts`.

Current layout:

```text
src/lib/shared/math/angles.ts
cone-intersection-constants.ts
cone-intersection-validation.ts
cone-intersection-support.ts
cone-intersection-oracle.ts
cone-intersection-symmetric.ts
cone-intersection-alpha-aware.ts
cone-intersection-block-pruned.ts
static-town-cpu.ts
overlap-cpu.ts
curve-cpu.ts
dynamic-town-cpu.ts
raw-cone-cpu.ts
cone-intersection-cpu.ts
final-cone-cpu.ts
```

Angles are now part of the shared math layer, not a precompute-only helper.
