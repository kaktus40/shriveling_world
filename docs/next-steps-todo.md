Next steps & backlog (short-term)

1) Harden GPU pipeline persistence (Phase B) — DONE
- Goal: ensure GPU programs/pipelines are created once during warm() and never recreated later. Added runtime warnings to detect recreation.
- Done: resource factories now track contexts/devices and warn on recreation (console.warn + trace). See src/lib/compute/webgpu/resources.ts and src/lib/compute/webgl2/resources.ts.

2) Propagate passFilter coverage — pending
- Ensure every runner/pass (WebGL2/WebGPU/CPU) respects ComputeOptions.passFilter and short-circuits work when appropriate.

3) CPU passFilter support — DONE
- Add CPU-side short-circuiting when GPU-only passes are requested to avoid unnecessary work. Implemented with dependency inference. See src/lib/compute/cpu/backend.ts.

4) Integration tests expansion — pending
- Add tests for year/projection interactive replay scenarios, asserting minimal stage re-execution and mesh vertex stability.

5) Phase C planning — pending
- Draft implementation plan for double-buffering, workerization, and async readback where needed. Ensure no progressive/coarse passes.

Operational notes
- Reference: docs/*.md are the source of truth. Link mapping: docs/mapping-report.md
- To resume: run the integration test and inspect logs shown by computeWorkspaceDataset (profile selection + runtime debug).
