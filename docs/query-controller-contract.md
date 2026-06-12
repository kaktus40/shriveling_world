# Query Controller Contract

This document fixes the canonical vocabulary for the application query orchestration layer.

## Scope

- Shared by `workspace` and the future operational `app` surface.
- Owns the editable query tree, debounce scheduling and worker execution.
- Keeps the worker boundary explicit and serializable.

## Canonical Terms

- `QueryController`: the stateful orchestration contract for one editable query tree.
- `QueryControllerBindings`: host callbacks used by the controller to read and write state.
- `QueryDatasetSnapshot`: the serializable dataset sent to the worker.
- `QueryWorkerClient`: the browser-side query executor.
- `QueryWorkerRequest`: the serialized request posted to the worker.
- `QueryExecutionResult`: the worker result consumed by the UI.

## Public Methods

The controller uses the following verbs:

- `execute`
- `scheduleExecute`
- `reset`
- `update`
- `remove`
- `insert`
- `move`
- `dispose`

The controller does not expose `run(...)` as a public method.

## Contract Rules

- The controller may be shared by multiple routes, but it owns one query tree at a time.
- The controller never reads the dataset itself; it only operates on the snapshot provided by the host.
- The worker client remains responsible for the actual query evaluation.
- The UI layer must not duplicate query mutation logic when the controller already exposes it.
