# Compute Naming Contract

This document fixes the canonical vocabulary for the compute stack used by the migration.

## Rules

- One concept has one public name.
- Public API names do not use `Workflow` when the concept is a backend or an orchestrator.
- Public API names do not expose `run(...)` as a temporary synonym for execution.
- Public names must describe responsibility, not implementation history.
- A compatibility bridge is acceptable only when it introduces a real boundary, such as profile selection or resource preparation.

## Canonical Terms

- `Backend`: one concrete compute profile implementation.
- `Orchestrator`: the service that selects a profile and dispatches execution.
- `Profile`: the target runtime profile, such as `cpu`, `webgl2`, or `webgpu`.
- `Selection`: the result of profile selection, including fallback information.
- `Capabilities`: the observed availability snapshot of the runtime.
- `Input`: the source data provided to the compute stack.
- `Options`: the configuration parameters for a compute request.
- `Resources`: prepared data that can be reused by interactive computation.
- `Frame`: the interactive result produced from prepared resources.
- `Result`: the final result of a compute operation.
- `Report`: benchmark or diagnostic output.
- `Descriptor`: availability and factory metadata for a backend.
- `Registry`: the set of backend descriptors used by the orchestrator.

## Verbs

Allowed public verbs:

- `select`
- `prepare`
- `compute`
- `measure`
- `validate`
- `dispose`

Forbidden public verbs in the final compute API:

- `run`
- `execute`
- `process`
- `workflow`

## Application

The canonical public surface planned for M6 is:

- `ComputeBackend`
- `ComputeOrchestrator`
- `ComputeInput`
- `ComputeOptions`
- `ComputeResult`
- `ComputeBackendResources`
- `ComputeFrameRequest`
- `ComputeFrameResult`
- `ComputeProfileRequest`
- `ComputeProfileSelection`
- `ComputeCapabilities`
- `ComputeBenchmarkReport`

The current code may still expose compatibility names while the migration is being renamed, but the target vocabulary is fixed by this document.
