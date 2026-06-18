Audit: Flux de données — Dataset → Affichage

But: ce document trace la donnée depuis l'import dataset jusqu'aux meshes affichés.
Il qualifie les formats (type, unité, sens), décrit les étapes (fonctions / kernels), prototypes, sorties attendues et points d'attention (double-buffer, workers).

1) Vue synthétique
- Entrée: fichier(s) CSV/GeoJSON (src/lib/domain/data)
- Préparation dataset → PreparedDataset (prepareDataset)
- StaticTown precompute (city invariants, NED→ECEF matrices)
- DynamicTown (par année): per-year parameters (road alpha etc.)
- RawCones: per-city per-azimuth alpha samples + raw rim positions (ECEF meters)
- ConeIntersections: ciseled rims, winning neighbor indices, distances (meters)
- FinalCones: finalConeGeometryEcef (Float32Array aligned vec4 per ray) — display-space coordinates (meters)
- Render adapter: buildAppConeMeshDescriptors converts finalConeGeometryEcef → AppConeMeshDescriptor[] → create/update Babylon meshes

2) Types clés (qualifiés)
- Float32Array: vecteurs/positions en mètres (ECEF) ou radians selon le contexte
  - cityLonLatRadians: Float32Array (radians) [stride 2]
  - cityNed2EcefMatrices: Float32Array (meters, 4x4 column-major per city) [stride 16]
  - rawConeRimEcef: Float32Array (meters, vec4 per sample: x,y,z,1)
  - finalConeGeometryEcef: Float32Array (meters, vec4 per sample: x,y,z,1) — prêt à afficher
  - coneAlphaRadians / coneAlphaRadians buffers: Float32Array (radians)
- Uint32Array: indexes, counts, neighbor lists (unitless indices)
- Contracts / counts:
  - cityCount: number (count of cities)
  - azimuthSampleCount: number (samples per city, e.g., 360)

3) Cheminement détaillé (fonctions / kernels)
- Ingestion & préparation
  - inspectDatasetFiles(files) -> diagnostic structures
  - resolveDatasetManifest(inspected) -> manifest
  - prepareDataset(baseNetwork) -> PreparedDataset
    - Inputs: CSV/geojson
    - Outputs: PreparedDataset (city list, edges, etc.)

- Static town precompute
  - computeStaticTownPrecomputeCpu(input, options) -> StaticTownPrecompute
    - Produces: cityNed2Ecef matrices, overlapCandidate buffers, curve control points (meters / radians)
    - Consumers: raw cones, cone intersections

- Dynamic town (per year)
  - computeDynamicTownPrecomputeForYearCpu(preparedDataset, staticTown, year) -> DynamicTownPrecompute
    - Produces: roadAlphaRadians, cityLink offsets/counts, azimuth arrays

- Raw cone generation
  - computeRawConePrecomputeCpu(staticTown, dynamicTown, rawConeOptions) -> RawConePrecompute
    - Produces: coneAlphaRadians (radians), rawConeRimEcef (vec4 per ray in meters)
  - WebGL2/WebGPU variants exist: runWebGl2RawConeAlphaPass / runWebGpuRawConeAlphaPass produce equivalent buffers (often as GPU buffers)

- Cone intersections
  - runCpuConeIntersectionStage(staticTown, rawCones, dynamicTown, strategy, options) -> ConeIntersectionOraclePrecompute
    - Produces: ciseledConeRimEcef (vec4 meters), winningNeighborCityIndexes, testedFaceCounts
  - WebGPU/WebGL2 passes implement partial / heuristic intersection kernels; outputs may be GPU buffers (double-buffer sets)

- Final cones (projection & country clipping)
  - computeFinalConePrecomputeCpu(coneIntersections, boundaryRaycast, earthRadiusMeters, projection) -> FinalConePrecompute
    - Converts ciseled rims, clips by boundary, projects to display space via projectEcefPoint
    - finalConeGeometryEcef: Float32Array (vec4 per ray, meters) — consumer-ready
  - runWebGl2FinalConePass / runWebGpu final-cones WGSL/GLSL produce buffers (transform feedback or GPU storage buffer). In Phase-C these writes target double-buffer.back and orchestrator swaps to .front after compute.

- Final curves (similar path) -> CurveVertexBuffer (Float32Array positions)

- Orchestration & session
  - CpuComputeBackend.computeFrame(...) : orchestrates parse→static→dynamic→raw→intersections→final steps; uses createInprocessWorker() or real Worker to offload CPU-heavy steps
  - WebGl2ComputeBackend & WebGpuComputeBackend: delegate earlier stages to CPU but run heavy kernels on GPU; they must ensure final outputs are converted to JS arrays when required by renderer

- App adapter & render
  - buildAppConeMeshDescriptors(result: ComputeResult, cities, projection...) -> AppConeMeshDescriptor[]
    - Reads result.geojsonRuns[i].finalCones.finalConeGeometryEcef (Float32Array) and maps to rims per city
  - createAppConeMeshController(scene).update(descriptors) -> creates/updates Babylon Meshes
    - Uses VertexData.applyToMesh or updateVerticesData (positions, normals) with units in app-space (meters scaled to globe radius)

4) Prototypes (extraits)
- computeFinalConePrecomputeCpu(coneIntersections: ConeIntersectionOraclePrecompute, boundaryRaycast: BoundaryRaycastResult, earthRadiusMeters: number, projection?: ProjectionTransition): FinalConePrecompute

- runWebGl2FinalConePass(input: WebGl2FinalConesPassInput): Promise<WebGl2FinalConesPassResult>
  - Input includes WebGL2RenderingContext, computed buffers or GL handles, resources (program cache)
  - Writes to a transform-feedback buffer (finalConeGeometryEcefBuffer) — in Phase C this is assigned from getOrCreateGlDoubleBuffer(...).back

- getOrCreateGlDoubleBuffer(gl, key, target, size, usage) -> { front: WebGLBuffer, back: WebGLBuffer }
- swapGlDoubleBuffer(gl, key) -> void

- createAppConeMeshController(scene: Scene): AppConeMeshController
  - update(cones: AppConeMeshDescriptor[]) → void
  - Internally: compute positions Float32Array, indices Uint32Array, normals, then VertexData.applyToMesh(mesh, true) or mesh.updateVerticesData(...)

5) Points d'attention / bugs observés
- Mismatch type: some GPU backends currently produce GPU buffers (GPUBuffer / WebGLBuffer) not converted to Float32Array — renderer expects Float32Array and skips if not one. (cônes manquants symptom)
- Double-buffer discipline: passes must write to .back, and orchestrator MUST swap to make .front visible; render must consume .front or readback JS arrays from .front.
- Workerization: compute worker may produce JS objects (Float32Array) or transfer ArrayBuffers. When GPU compute produced GPU buffers, a copy/readback is required to get CPU-side Float32Array for renderer.

6) Événements et étapes à déclencher
- Dataset change (new dataset): full pipeline: ingestion → prepare → staticTown → dynamicTown → rawCones → coneIntersections → finalCones → finalCurves → render. Cache staticTown when dataset unchanged.
- Year change: only dynamicTown -> rawCones -> coneIntersections -> finalCones -> finalCurves (if curves enabled). Strategy: keep staticTown cached; debounce year changes (current replay delay 80ms) to coalesce rapid steps.
- Projection change: only finalCones and finalCurves need re-projection (projection settings applied in final stage). If projection only, avoid re-running intersections/raw cones/staticTown.
- Small UI interactions (camera, selection) should not trigger compute; only rebind render descriptors to existing final data.

7) Suggestions pour fluidité (regroupement et coalescing)
- Cache staticTown indefinitely per dataset. Recompute only if dataset changes.
- On year/projection rapid updates: debounce (80ms) and coalesce; run only necessary downstream stages:
  - Year change: recompute dynamicTown -> rawCones -> intersections -> finalCones (and curves if enabled)
  - Projection change: recompute finalCones (project and clip) and finalCurves; avoid upstream recompute
- Prefer worker-based CPU precompute (already scaffolded) transferring final arrays (ArrayBuffer) back via transferList to main for binding into meshes; for GPU-based passes, ensure readback of front buffer to Float32Array before building App descriptors (or adapt renderer to consume GPU buffers via OffscreenWebGL if feasible)
- Ensure double-buffer swaps occur atomically after compute and before render frame binds the data

8) Diagnostic additions to implement
- Instrument counts: number of buffer allocations per frame, shader compile times, swap latencies
- On finalCones path: if finalCones exists but not a Float32Array, log origin backend and whether a .front exists (for GPU path)

9) Diagram (synthèse)
- see docs/diagrams/dataflow.svg (flow diagram with boxes: Files -> prepareDataset -> staticTown -> dynamicTown(year) -> rawCones -> coneIntersections -> finalCones -> build descriptors -> Babylon meshes -> frame)

---
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
