Project TODOs and next steps

Overview
- Keep this list updated as work progresses. Items are ordered by priority (high -> low).

High priority (action now)
- [ ] Finish double-buffer discipline end-to-end: ensure all passes write to .back and consumers read .front
- [ ] Update render path (Babylon) to bind mesh vertex buffers to front buffers only (avoid reallocation)
- [ ] Persist compute profile selection in UI (localStorage) and avoid forcing user choice to CPU silently
- [ ] Close "scene" module at startup by default (activeModule = null)
- [ ] Debounce/coalesce rapid year/projection changes to improve responsiveness (scheduler tuned)

Medium priority
- [ ] Worker productionization: emit worker via Vite/rollup with new URL(...) pattern and ensure transferables
- [ ] Add integration tests verifying front/back swap correctness and no pipeline recreation
- [ ] Complete double-buffer integration for remaining GPU/WebGL passes and render bindings

Low priority / Future
- [ ] Add in-app telemetry: shader compile times, buffer creation counts, swap latencies
- [ ] Consider WebGPU-in-worker path and fallback behavior policy for unsupported browsers

Notes
- Recent changes:
  - Replay scheduler default task delay tuned to 80ms to batch UI-driven rapid changes.
  - UI now persists compute profile to localStorage and starts with scene closed by default.

See docs/phase-c-plan.md for Phase C design and longer-term milestones.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
