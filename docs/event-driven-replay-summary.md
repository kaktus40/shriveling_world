Event-driven replay — summary

What was implemented
- Added passFilter option (ComputeOptions.passFilter) to selectively run pipeline stages.
- Propagated passFilter checks to WebGL2 and WebGPU cone and boundary runners.
- Added unit tests for WebGL2 boundary passFilter behavior.
- Added an integration test (tests/integration/event-driven-replay.test.ts) that warms a persistent compute session, runs a full compute, then cone-only and boundary-only runs using passFilter to validate selective re-execution semantics.
- Updated probes to compile/validate shaders on warm; ensured programs are compiled at startup.

How to run tests
- Unit tests: npm test
- Integration tests: npm run test:integration

Notes
- Tests use a fake WebGL2 canvas to run GPU runners in CI/headless.
- Some CPU-side timings may still be emitted when GPU is selected but filtered; the important invariant is that requested stages are executed.

Next steps are tracked in docs/next-steps-todo.md and in the session todo list.