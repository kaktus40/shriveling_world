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
- treat `dynamic-town-precompute` as a yearly cache/prewarm stage for the
  dynamic alphas so that a year change can resume from `raw-cones-precompute`
  without rebuilding the earlier runtime state;
- keep the country-boundary decision at `final-cones` so toggling the boundary
  limit does not force a return to the GeoJSON raycast stage;
- let the curve final stage consume the selected year and projection slice when
  the visible curve geometry depends on that state.

## WebGL2

- transform-feedback programs must be linked with both a vertex shader and a
  fragment shader, even when rasterization is discarded;
- the context should be created from a persistent canvas or offscreen canvas;
- a backend that can no longer produce a context must fail explicitly rather
  than recreating hidden one-shot canvases on each compute call.
- the GPU pass that replaces the historical `GPUComputer.calculate()` flow
  should iterate over the full 2D output table in the same session.
- the 2D table traversal must stay compatible with a persistent canvas/context;
  changing the year updates the inputs and replays the affected passes, but it
  does not recreate the context.

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
- the route layer should prewarm the compute session through a shared
  application helper so Babylon viewport setup stays separate from compute
  runtime setup;
- the UI should not auto-load a dataset at route entry;
- E2E tests should use reduced datasets and explicitly cover CPU, WebGL2 and
  WebGPU paths.
- repeated UI edits that belong to the same interaction, such as the year rail
  or the projection rail, should be coalesced into one replay request instead
  of triggering a separate compute call for each sub-control;
- the dataset workspace should use the same replay coalescing model for
  compute-profile and cone-intersection toggles so one UI gesture does not
  schedule multiple backend runs;
- the curve final stage follows the same replay request as final cones when
  year or projection changes alter the visible curve slice, so the app does
  not split cone and curve refreshes into separate runtime passes;
- each route owns one persistent compute session, prewarms it on mount, and
  disposes it on unmount;
- Babylon support probing must use a throwaway canvas and never consume the
  render canvas itself, otherwise the viewport can self-sabotage its own
  context creation;
- `final-cones` is the place where projection formulas are applied for every
  backend profile, but the session that drives it must remain alive between
  recomputations.
- the minimal replay stage for each user change is documented in the stage
  matrix and must drive the event handlers in `workspace` and `app`.
- the replay matrix also documents the country-boundary final-stage decision and
  the curve final-stage dependency on year / projection state.
- current migration gap:
  - the yearly dynamic alpha cache is now reused on the CPU path, but the
    browser runtime still needs to keep that year-keyed cache as the canonical
    source when injecting uniforms / textures before replaying downstream
    passes;
  - the desired yearly dynamic cache shape is a year-keyed map that keeps
    `roadAlphaRadians`, `cityLinkOffsets`, `cityLinkCounts`,
    `cityLinkDestinationIndexes`, `cityLinkAzimuthRadians`,
    `cityLinkAlphaRadians` and `cityFastestTerrestrialAlphaRadians`;
  - the curve final stage is now explicit, but the browser runtime still needs
    the same event-driven cache injection path as the historical app so that
    year and projection changes can refresh uniforms / textures without
    rebuilding the persistent session;
  - the final cone contract is already dense and final-stage based, and the
    Babylon app shell now consumes it through a maintainable cone-mesh adapter;
    the historical `coneMeshShader` path still matters as the reference for the
    stable triangle index buffer and the one-time topology build per city;
  - the app cone adapter keeps the topology stable and only refreshes the
    per-city vertex payload when year, projection, or query focus changes;
- the remaining runtime TODO is not the presence of the adapter, but the
  eventual convergence of this adapter with the historical low-level event
  model so that the same fluid update semantics are preserved end to end.

## Validation Snapshot

- Brave e2e on the reduced datasets currently passes for both `app` and
  `workspace` across `CPU`, `WebGL2`, and `WebGPU`.
- the WebGPU runtime failure that previously blocked Brave was caused by WGSL
  syntax issues in `raw-cone-alphas` and `ciseled-cones`; those kernels now
  compile again.
- Firefox validation is deliberately left aside in this iteration so the
  runtime can be stabilized on the browser path that most directly exercises
  the GPU stack used for day-to-day validation.
