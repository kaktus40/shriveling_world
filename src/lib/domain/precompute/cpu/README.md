# CPU Precompute

Conventions:
- one file per pass or logical CPU tranche;
- keep pass names stable across CPU, WebGL2 and WebGPU;
- prefer small helper modules over a single monolithic backend file;
- export the CPU pass implementations through `src/lib/domain/precompute/cpu/index.ts`.

Current layout:

```text
static-town-cpu.ts
overlap-cpu.ts
curve-cpu.ts
dynamic-town-cpu.ts
raw-cone-cpu.ts
cone-intersection-cpu.ts
final-cone-cpu.ts
```
