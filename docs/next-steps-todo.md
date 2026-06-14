Next steps & backlog (short-term)

1) Harden GPU pipeline persistence (Phase B)
- Goal: ensure GPU programs/pipelines are created once during warm() and never recreated later. Add runtime assertions and logs to detect recreation.
- Why: prevents accidental per-dispatch pipeline recreation which harms performance and violates docs.

2) Propagate passFilter coverage
- Ensure every runner/pass (WebGL2/WebGPU/CPU) respects ComputeOptions.passFilter and short-circuits work when appropriate.

3) CPU passFilter support
- Add CPU-side short-circuiting when GPU-only passes are requested to avoid unnecessary work.

4) Integration tests expansion
- Add tests for year/projection interactive replay scenarios, asserting minimal stage re-execution and mesh vertex stability.

5) Phase C planning
- Draft implementation plan for double-buffering, workerization, and async readback where needed. Ensure no progressive/coarse passes.

Operational notes
- Reference: docs/*.md are the source of truth. Link mapping: docs/mapping-report.md
- To resume: run the integration test and inspect logs shown by computeWorkspaceDataset (profile selection + runtime debug).
