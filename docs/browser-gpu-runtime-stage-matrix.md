# Browser GPU Runtime Stage Matrix

This document is the operational matrix for the browser GPU runtime used by
`workspace` and `app`.

It answers two questions:

- which data is required by each compute stage;
- which kind of insertion the stage consumes or produces in the runtime
  contract.

The matrix is intentionally aligned with the historical `GPUComputer.calculate()`
model from the main branch:

- one runtime instance stays alive for the full page lifetime;
- successive recomputations reuse that runtime;
- only the minimal affected stage chain is replayed when a parameter changes.

## Insertion Legend

- `CPU`: CPU-side preparation or rewrite.
- `U`: uniform or constant buffer.
- `SB`: storage buffer.
- `T`: texture / sampler pair.
- `A`: vertex or instance attribute.
- `TF`: transform feedback output.
- `OUT`: output buffer or renderable geometry buffer.
- `-`: not consumed by this stage.

## Stage Matrix

| Data / contract | ingestion / base-network | prepared-dataset | geojson-boundary-precompute | geojson-boundary-raycast | static-town-precompute | dynamic-town-precompute | raw-cones-precompute | cone-intersections-precompute | final-cones-precompute | curve-geometry-precompute |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| source files / dataset manifest | CPU | - | - | - | - | - | - | - | - | - |
| prepared dataset summary / static indices | CPU | U / SB | - | - | - | - | - | - | - | - |
| GeoJSON contours / contour indexes | CPU | SB | T / SB | T / SB | - | - | - | - | - | - |
| city NED2ECEF matrices | - | SB | - | - | SB | - | - | - | - | - |
| pair invariants / overlap candidates | - | SB | - | - | SB | - | - | SB | - | - |
| dynamic year / yearly town state | - | - | - | - | - | U / SB | U / SB | U / SB | U / SB | U / SB |
| raw cone parameters | - | - | - | - | - | - | U / SB | U / SB | - | - |
| cone intersection heuristics | - | - | - | - | - | - | - | U / SB | - | - |
| projection mix start / end / percent / settings | - | - | - | - | - | - | - | - | U | - |
| curve controls / curve year / coefficient | - | - | - | - | - | - | - | - | - | U / SB |
| benchmark / diagnostics | CPU | CPU | CPU | CPU | CPU | CPU | CPU | CPU | CPU | CPU |

## Replay Rules

Use the matrix above to determine the earliest stage that must be replayed when
an input changes.

| Change | Minimal stage to replay | Notes |
| --- | --- | --- |
| dataset / source file set | `ingestion / base-network` | Rebuild the full chain; nothing downstream is reliable. |
| GeoJSON geometry / boundary inputs | `geojson-boundary-precompute` | Replay the boundary precompute, then the dependent raycast and final stages. |
| boundary azimuth sample count | `geojson-boundary-precompute` | The boundary precompute contract changes before the raycast. |
| static town options (`sectorCount`, `neighborLimit`) | `static-town-precompute` | The static neighborhood contract changes, so all dependent stages must be replayed. |
| year / yearly dynamic state | `dynamic-town-precompute` | Reuse the persistent runtime, refresh dynamic buffers, then replay raw cones and downstream stages. |
| raw cone shape / sample count / length / attenuation | `raw-cones-precompute` | Raw cone buffers change, so intersection, final geometry and curves depending on those outputs must be replayed. |
| cone intersection strategy / alpha heuristic | `cone-intersections-precompute` | Keep the same runtime, replay the ciseled / intersection stage and downstream outputs. |
| projection mix or projection settings | `final-cones-precompute` | The projection formulas are applied at final cone emission for every backend profile. |
| curve parameters | `curve-geometry-precompute` | Only the curve geometry stage must be replayed. |
| compute profile (`cpu`, `webgl2`, `webgpu`) | profile-specific warm backend | The active runtime is swapped, but the same stage contract is replayed without re-reading the dataset. |

## Practical Consequence

The current application and workspace routes should keep one persistent compute
session each.

As long as the route remains mounted:

- the session should be prewarmed on mount so the available browser GPU
  backends are ready before the first user-driven recomputation;
- the backend should stay warm;
- changing the year should not recreate the runtime;
- changing the projection mix should not recreate the runtime;
- changing the profile should only swap the active backend, not the data
  contract;
- the compute passes remain event-driven and replay only from the first affected
  stage.
