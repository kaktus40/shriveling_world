# Browser GPU Runtime Notes

This document captures the runtime expectations for the browser GPU backends
used by the application and workspace surfaces.

## Goal

Keep the GPU runtime persistent across successive interactive recomputations.
The historical reference is the main-branch `GPUComputer.calculate()` flow:
one canvas/context is created once, then reused for every subsequent pass.

The compute shape must also remain consistent with that historical flow:
the fragment/compute stage traverses a two-dimensional table of outputs
instead of rebuilding the backend for every year or projection change.

## Requirements

- keep the WebGL2 context alive across successive year and projection changes;
- keep the WebGPU device/context alive across successive year and projection changes;
- keep the same backend instance warm when the user only changes display
  parameters;
- recreate the backend only when the profile changes or the page is disposed;
- keep reduced datasets available for E2E coverage of the three profiles.
- keep the page-owned compute session alive while the route remains mounted;
- prewarm the available browser GPU backends on route mount so their contexts
  and programs are operational before the first interactive recomputation;
- reuse that session across year and projection changes even when the user
  changes the display projection mix.

## WebGL2

- transform-feedback programs must be linked with both a vertex shader and a
  fragment shader, even when rasterization is discarded;
- the context should be created from a persistent canvas or offscreen canvas;
- a backend that can no longer produce a context must fail explicitly rather
  than recreating hidden one-shot canvases on each compute call.
- the GPU pass that replaces the historical `GPUComputer.calculate()` flow
  should iterate over the full 2D output table in the same session.

## WebGPU

- the backend must follow the same persistence rule as WebGL2;
- shader modules must validate cleanly before the profile is reported as
  available;
- current WGSL validation issues remain a follow-up item and should be solved
  before the profile is treated as production-ready in the browser.
- the backend should keep the device/context warm across successive frames and
  only rebuild when the profile changes or the route is disposed.
- the stage/input replay matrix lives in
  [`docs/browser-gpu-runtime-stage-matrix.md`](browser-gpu-runtime-stage-matrix.md)
  and is the source of truth for deciding which passes must be replayed after
  a parameter change.

## Application and Workspace

- `app` and `workspace` should keep the selected backend warm while only year,
  projection, or display parameters change;
- the UI should not auto-load a dataset at route entry;
- E2E tests should use reduced datasets and explicitly cover CPU, WebGL2 and
  WebGPU paths.
- each route owns one persistent compute session, prewarms it on mount, and
  disposes it on unmount;
- `final-cones` is the place where projection formulas are applied for every
  backend profile, but the session that drives it must remain alive between
  recomputations.
- the minimal replay stage for each user change is documented in the stage
  matrix and must drive the event handlers in `workspace` and `app`.
