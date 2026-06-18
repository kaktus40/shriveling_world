Dataflow (détaillé) — Boîtes fonctionnelles: Dataset → Affichage

But: chaque boîte représente une fonction/étape. Pour chaque boîte:
- Emplacement (stage horizontal)
- Type d'exécution: CPU / GPU (ordonnée)
- Nom de la fonction + phrase synthétique
- Prototype (signature simplifiée)
- Entrées (nom, type, unité / sens)
- Sorties (nom, type, unité / sens)

Résumé stades (abscisse):
1) Ingestion & préparation
2) Static-town precompute
3) Dynamic per-year
4) Raw-cone sampling
5) Cone intersections (ciseled rims)
6) Final geometry (projection, clipping)
7) Adapter -> App descriptors
8) Babylon mesh binding & render

----
Stage 1 — Ingestion & préparation (CPU)

Box: inspectDatasetFiles
- Phrase: Analyse brute des fichiers fournis pour produire diagnostics et types reconnus.
- Prototype: inspectDatasetFiles(files: {name:string,text:string}[]): InspectedFile[]
- Entrées: files (Array of text files)
- Sorties: inspected (objects describing file roles, sizes, errors)

Box: resolveDatasetManifest
- Phrase: Normalise et valide la structure du dataset (fichiers attendus, métadonnées).
- Prototype: resolveDatasetManifest(inspected): DatasetManifest
- Entrées: inspected (diagnostics)
- Sorties: manifest (validated dataset manifest, diagnostics)

Box: prepareDataset
- Phrase: Construit PreparedDataset: listes de villes, edges, indices stables et données de base utilisées par les précalculs.
- Prototype: prepareDataset(baseNetwork): PreparedDataset
- Entrées: baseNetwork / sourceFiles (parsed CSV/GeoJSON)
  - cities: longitude/latitude (radians)
  - edges: origin/destination ids
- Sorties: PreparedDataset
  - cityCount: number
  - preparedDataset.cities (ordered)
  - preparedDataset.edges
  - units: radians (lon/lat), unitless indices

----
Stage 2 — Static-town precompute (CPU, possible GPU partial)

Box: computeStaticTownPrecomputeCpu (CPU)
- Phrase: Calcule invariants par ville (matrices NED→ECEF), listes de voisins candidates et points de contrôle de courbes.
- Prototype: computeStaticTownPrecomputeCpu(input: StaticTownInput, opts: StaticTownPrecomputeOptions): StaticTownPrecompute
- Entrées:
  - cityLonLatRadians: Float32Array (radians) [stride 2]
  - options: sectorCount, neighborLimit
- Sorties:
  - cityNed2EcefMatrices: Float32Array (meters) [stride 16]
  - overlapCandidates: Uint32Array (indices)
  - curveControlPointsEcef: Float32Array (meters)
- Unités: matrices en mètres, angles en radians

Notes: GPU could precompute matrix transforms but current code uses CPU reference; persistent caches recommended.

----
Stage 3 — Dynamic per-year (CPU)

Box: computeDynamicTownPrecomputeForYearCpu (CPU)
- Phrase: Génère paramètres dépendants de l'année (road alpha, city link lists, per-link alpha samples).
- Prototype: computeDynamicTownPrecomputeForYearCpu(preparedDataset, staticTown, year): DynamicTownPrecompute
- Entrées: preparedDataset, staticTown, year (number)
- Sorties:
  - roadAlphaRadians: number (radians)
  - cityLinkOffsets / cityLinkCounts: Uint32Array (indices)
  - cityLinkAzimuthRadians / cityLinkAlphaRadians: Float32Array (radians)
- Usage: downstream raw-cones and intersection stages

----
Stage 4 — Raw-cone sampling (CPU / GPU)

Box: computeRawConePrecomputeCpu (CPU)
- Phrase: Échantillonne alphas par azimut pour chaque ville et calcule positions brutes de bords de cône (raw rim) en ECEF.
- Prototype: computeRawConePrecomputeCpu(staticTown, dynamicTown, options): RawConePrecompute
- Entrées:
  - staticTown buffers (matrices)
  - dynamicTown (alphas, links)
  - options: azimuthSampleCount (e.g., 360), coneLengthMeters
- Sorties:
  - coneAlphaRadians: Float32Array (radians) [cityCount * azimuth]
  - rawConeRimEcef: Float32Array (meters, vec4 per ray)
- GPU variant:
  - runWebGl2RawConeAlphaPass(gl, ...) or runWebGpuRawConeAlphaPass(context, ...) produce GPU-side buffers (transform-feedback / storage buffer). In Phase C they allocate into getOrCreate*DoubleBuffer(...).back

----
Stage 5 — Cone intersections (CPU oracle or GPU heuristic)

Box: runCpuConeIntersectionStage (CPU)
- Phrase: Pour chaque rayon, teste faces voisines et retourne rim ciselé, distances et indexes gagnants (oracle exhaustive).
- Prototype: runCpuConeIntersectionStage(staticTown, rawCones, dynamicTown, strategy, options): ConeIntersectionOraclePrecompute
- Entrées:
  - staticTown invariants
  - rawConeRimEcef (Float32Array)
  - dynamicTown (for alpha thresholds)
- Sorties:
  - ciseledConeRimEcef: Float32Array (meters vec4 per ray)
  - winningNeighborCityIndexes: Uint32Array
  - testedFaceCounts: Uint32Array
- GPU variant:
  - runWebGl2CiseledConePass / runWebGpuCiseledConePass: implement kernels that produce ciseled rim into GPU buffer sets (double-buffer .back)

----
Stage 6 — Final geometry (projection & clipping) (CPU or GPU)

Box: computeFinalConePrecomputeCpu (CPU)
- Phrase: Clip ciseled rims by boundary raycast, projeter en espace d'affichage (projection transition) et produire finalConeGeometryEcef prêt à afficher.
- Prototype: computeFinalConePrecomputeCpu(coneIntersections, boundaryRaycast, earthRadiusMeters, projection): FinalConePrecompute
- Entrées:
  - coneIntersections.ciseledConeRimEcef: Float32Array (meters)
  - boundaryRaycast: BoundaryRaycastResult (angular flags and ECEF positions)
  - projection: {start,end,percent,settings}
- Sorties:
  - finalConeGeometryEcef: Float32Array (meters aligned vec4 per ray) — display-space ready
- GPU variant:
  - runWebGl2FinalConePass produces transform-feedback buffer (finalConeGeometryEcefBuffer) allocated from getOrCreateGlDoubleBuffer(...).back; orchestrator must swap and optionally read back .front to Float32Array for renderer

----
Stage 7 — Adapter: build descriptors (CPU)

Box: buildAppConeMeshDescriptors (CPU)
- Phrase: Lit finalConeGeometryEcef (Float32Array) et produit un tableau d'AppConeMeshDescriptor par ville: apex + rimPoints list en App space (meters scaled).
- Prototype: buildAppConeMeshDescriptors(result: ComputeResult, cities, projectionStart,end,percent, focusCityIndex, queryMatches): AppConeMeshDescriptor[]
- Entrées:
  - result.geojsonRuns[].finalCones.finalConeGeometryEcef: Float32Array (meters)
  - cities: WorkspaceCitySummary[] (lon/lat radians, cityIndex)
- Sorties:
  - AppConeMeshDescriptor[]: {name, cityIndex, cityCode, apex:[x,y,z], rimPoints: [ [x,y,z], ... ] }
- Note: requires finalConeGeometryEcef to be a Float32Array; if a GPU buffer is present, orchestrator must readback.

----
Stage 8 — Babylon binding & render (GPU via Babylon)

Box: createAppConeMeshController.update (CPU→GPU binding)
- Phrase: Create/update Babylon Mesh objects from descriptors; compute normals, apply VertexData and bind to GPU mesh buffers.
- Prototype: update(cones: AppConeMeshDescriptor[]): void
- Entrées:
  - descriptors (apex, rimPoints arrays in app-space meters)
- Sorties/side-effects:
  - Creates/updates Babylon Mesh vertex buffers (positions, normals) — GPU resident buffers via engine
- Units: positions in meters (will be scaled to globe radius inside projection adapter if necessary)

Box: Engine render loop (GPU)
- Phrase: Exécute scene.render() ; meshes already bound to GPU buffers.
- Prototype: engine.runRenderLoop(() => scene.render())

----
Cross-cutting utilities / phase-c helpers

Box: getOrCreateGlDoubleBuffer / getOrCreateGpuDoubleBuffer (GPU)
- Phrase: Registries per-context/device that allocate/return stable front/back buffer sets to support double-buffering semantics.
- Prototype: getOrCreateGlDoubleBuffer(gl, key, target, size, usage) -> {front,back}
- Usage: final-cones, ciseled-cones, raw-cones writes target .back

Box: swapGlDoubleBuffer / swapGpuDoubleBuffer
- Phrase: Atomically swaps front/back references in registry so render consumers read latest computed front
- Prototype: swapGlDoubleBuffer(gl,key) -> void

Box: createComputeWorker / createInprocessWorker (worker RPC)
- Phrase: Abstracts worker creation; supports transferring ArrayBuffers and falling back to in-process synchronous handlers returning Promise-like results.
- Prototype: createComputeWorker(scriptUrl?) -> {post(req):Promise<Response>, terminate()}
- Usage: offload CPU stages (staticTown, rawCones, coneIntersections, finalCones) and return JS typed arrays via transfer

----
Navigation visuelle recommandée
- Ordonner horizontalement les stades 1..8
- Ordonner verticalement: CPU (top), GPU (bottom). Marquer les boîtes qui peuvent être réalisées sur GPU (rawCones, ciseled-cones, final-cones) en bas; garder CPU-only boxes en haut.
- Flèches: connecter sorties → entrées suivantes; annoter chaque flèche avec type/format (Float32Array meters, Uint32Array indexes, radians)

----
Annexes rapides: unités et conventions
- Angles: radians (lon/lat, azimuths, alpha)
- Positions: ECEF meters (x,y,z), vec4 aligned per ray: [x,y,z,1]
- Buffers: dense row-major by city then azimuth sample
- Index layout: cityIndex * azimuthSampleCount + sampleIndex

----
Recommandations opérationnelles (priorités)
1. Garantir que chaque point où renderer attend Float32Array, l'orchestrateur convertisse ou lise le buffer GPU front vers Float32Array (readback) ou fournisse un mapping adapté.
2. Appliquer double-buffer discipline strictement: tous les kernels écrivent .back ; orchestrateur swap* après compute ; renderer lit .front.
3. Coalescer les événements:
   - dataset change -> full pipeline
   - year change -> dynamicTown -> rawCones -> coneIntersections -> finalCones
   - projection change -> finalCones -> finalCurves
4. Workerization: déléguer CPU-heavy stages au worker pool et transférer les ArrayBuffers (postMessage transferList) pour éviter copies.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
