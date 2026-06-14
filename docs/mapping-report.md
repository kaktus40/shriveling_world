Mapping docs/ → code source
================================

Résumé
-----
Ce document cartographie les exigences des documents source (docs/) vers les fichiers et fonctions concrètes du worktree migration. Il liste preuves d'implémentation, écarts observés et actions recommandées, avec focus sur app et workspace (persistence GPU, passes alimentées, déclencheurs événementiels).

1) docs/browser-gpu-runtime-notes.md
------------------------------------------------
Exigences clés:
- Contextes GPU persistants
- warm() au démarrage (prewarm)
- Relances événementielles minimales (coalescing)

Fichiers & points d'implémentation:
- src/lib/application/runtime.ts — primeComputeRuntime(session).warm() appelé à l'onMount dans app et workspace
- src/lib/compute/core/session.ts — createComputeSession.warm(): warmBackend('webgl2','webgpu')
- src/lib/compute/webgl2/backend.ts — probeWebGl2Context(), ensureResources(), ensureGl(), createWebGl2ComputeResources
- src/lib/compute/webgpu/backend.ts — ensureDevice(), ensureResources(), createWebGpuComputeResources

Preuves:
- warm() chauffe backends et create*Resources compile les shaders (WebGL2: transform-feedback programs; WebGPU: createShaderModule).
- primeComputeRuntime est invoqué depuis src/routes/app/+page.svelte et src/routes/workspace/+page.svelte.

Gaps recommandés:
- Assurer que le cache annuel (dynamicTown) produit par le CPU est injecté comme source de vérité dans les passes GPU avant dispatch.
- Ajouter tests d'intégration pour valider persistence des contextes et warm semantics.

2) docs/browser-gpu-runtime-stage-matrix.md
------------------------------------------------
Exigences clés:
- Mapping stage→pass et contrats buffers/uniforms
- Règles de replay minimales (stage matrix)

Fichiers & points d'implémentation:
- WebGPU: src/lib/compute/webgpu/resources.ts (pipeline.passes, shaderModuleCache)
  - passes: city-ned2ecef, raw-cone-alphas, ciseled-cones, final-cones, curve-geometry
  - passes/*/buffers.ts — device.queue.writeBuffer usage
- WebGL2: src/lib/compute/webgl2/resources.ts, src/lib/compute/webgl2/programs.ts, src/lib/compute/webgl2/passes/* (transform-feedback + buffer writes)

Preuves:
- Chaque passe crée buffers/uniforms et écrit via device.queue.writeBuffer (WebGPU) ou bufferData/getBufferSubData (WebGL2) avant dispatch.

Gaps/actions:
- Tests de readback pour vérifier que uniforms/buffers contiennent les valeurs attendues après write.
- Valider bind group layouts / indices et contrats des buffers.

3) docs/ihm-project-controls-and-interactions.md
------------------------------------------------
Exigences clés:
- Répartition app ↔ workspace des contrôles
- Quels événements déclenchent recompute (dataset, year, projection, visual)

Fichiers & points d'implémentation:
- src/routes/app/+page.svelte, src/routes/workspace/+page.svelte — handlers dataset/year/projection appellent replay.request() ou reloadCompute
- src/lib/application/replay.ts — createReplayScheduler coalescing

Preuves:
- Handlers UI déclenchent les replay schedulers; createReplayScheduler coalesces et déclenche reloadCompute.

Gaps/actions:
- Tests qui simulent changements UI rapides et vérifient que seules les passes nécessaires redémarrent (diagnostics). 

4) docs/precompute-dataflow-cpu-gpu.md
------------------------------------------------
Exigences clés:
- Contrats CPU↔GPU (staticTown, dynamicTown, geojsonRuns)
- CPU comme référence pour certaines passes

Fichiers & points d'implémentation:
- src/lib/compute/cpu/* (CPU reference implementations)
- src/lib/compute/webgpu/passes/* and src/lib/compute/webgl2/passes/* — consomment outputs CPU (staticTown/dynamicTown) via buffers/textures

Preuves:
- CPU back-end produit staticTown/dynamicTown; GPU passes read these via writeBuffer / textures.

Gaps/actions:
- Écrire tests assurant que dynamicTown (année) est injecté avant groupes d'ordonnancement GPU; tests de non-régression.

Actions recommandées (priorité)
- Ajouter tests d'intégration event-driven (dataset load, year/projection changes) — tests Vitest/Playwright. (Haute)
- Ajouter tests de readback buffer/uniforms pour passes WebGPU/WebGL2. (Haute)
- Documenter propriétaire et critères d'acceptation par jalon (M9). (Moyenne)

Fichiers clefs récapitulatifs
- session: src/lib/compute/core/session.ts
- runtime prime: src/lib/application/runtime.ts
- webgl2 backend: src/lib/compute/webgl2/backend.ts and resources.ts and programs.ts
- webgpu backend: src/lib/compute/webgpu/backend.ts and resources.ts and passes/*
- replay scheduler: src/lib/application/replay.ts
- routes: src/routes/app/+page.svelte, src/routes/workspace/+page.svelte

Prochaine livraison possible (si demandé)
- Tests d'intégration initiales + fixtures réduites pour valider persistence et minimal replay.

Fin du mapping.
