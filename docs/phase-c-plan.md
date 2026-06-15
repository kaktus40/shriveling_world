Phase C — Double-buffering & Workerization (Plan)

Goal
- Improve interactivity and frame-to-frame fluidity when changing year or projection by moving heavy GPU/CPU work off the main thread and eliminating stalls.
- Maintain pipeline/program/pipeline persistence for the entire app lifetime (no recompile/recreate between passes).

Constraints
- No progressive/coarse passes; pipelines must persist.
- Buffer/uniform updates only between passes.
- Must be compatible with existing passFilter semantics and current backends (CPU, WebGL2, WebGPU).

Proposal (high level)
1. Double-buffering
   - Maintain two full sets of GPU/CPU buffers for outputs that may be read by the render path ("front" and "back").
   - Writes always target the back buffer; once compute completes, atomically swap front/back references.
   - Keep compute pipelines/programs bound to devices/contexts and reused for the app lifetime.

2. Workerization
   - Offload precompute and readback orchestration to Web Workers (or dedicated Worker-like thread in host), keeping GPU device/pipelines on main thread when required by API constraints. Two approaches:
     a) WebGPU-first: create device in a worker (if supported) and run compute in worker; main receives buffer handles via MessagePort/transferable.
     b) WebGL2 / Babylon meshes: keep GL context on main thread; run CPU heavy preprocessing in worker and send results to main for GPU dispatch.
   - Adopt a hybrid: run CPU precompute & dataset parsing in workers; run GPU dispatch on main thread but orchestrated by an off-main scheduler that applies buffer updates and queues work.

3. Buffer update protocol
   - Define small descriptors describing which buffers/uniforms changed per pass.
   - Use explicit update calls (setUniforms, setBufferData) that only touch changed regions.

4. Worker pool & scheduling
   - Small pool of workers for dataset parsing and CPU precompute tasks.
   - Scheduler collects passFilter requests, dedupes overlapping requests, and schedules minimal set of compute tasks.

Deliverables (phase C initial sprint)
- RFC doc (this file) checked into docs/.
- Minimal worker scaffolding: worker entry, message protocol, API for dispatching "compute tasks" and receiving completion events.
- Double-buffer manager module (createDoubleBufferManager) to allocate and swap buffers for WebGPU/WebGL2.
- Integration test that simulates rapid year/projection changes and asserts renderable buffers always point to a fully computed front buffer and programs are not recreated.

Next steps for implementation
1. Add createDoubleBufferManager and integrate with WebGPU/WebGL2 backends to allocate two sets of dispatch resources where appropriate.
2. Add worker scaffolding for CPU precompute tasks (parsing, staticTown/dynamicTown computations) and migrate CPU compute invocation to workers.
3. Add scheduler that coalesces rapid successive requests and ensures only necessary passes run against current back/front buffers.
4. Expand integration tests to assert no pipeline recreation and fluid swaps under rapid event load.

Risks and mitigations
- WebGPU in Worker: limited browser support; design fallback to main-thread device with worker-based CPU precompute.
- Message transfer cost: use transferable ArrayBuffer for heavy buffers to avoid copies where feasible.

Timeline (small sprint)
- Week 1: implement double-buffer manager + small refactor in webgpu/webgl2 resources to support two buffer sets.
- Week 2: implement worker scaffolding and migrate CPU precompute tasks to worker pool.
- Week 3: integrate scheduler and add integration tests + performance characterization.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
