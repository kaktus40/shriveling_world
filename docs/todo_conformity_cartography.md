# TODO List : Mise en conformite du code avec la Cartographie des Donnees (V2)

Cette liste detaille les actions techniques necessaires pour aligner la branche de migration sur le document detailed_data_cartography.md.

---

## Phase 2 : Preparation des Primitives (Invariants & Warming)

- [ ] **Isolation des Invariants Fixes**
    - [ ] Modifier `WebGpuComputeBackend` pour ne dispatcher `runWebGpuCityMatrixPass` qu'une seule fois par dataset.
    - [ ] Generer les **Index Buffers** (Uint32) pour les Cones, Courbes et Pays une seule fois. Les stocker comme ressources statiques.

- [ ] **Gestion du Rejeu Phase 2 (Evenements Invalideurs)**
    - [ ] Implementer la detection de changement (`neighborLimit`, `interiorPointSpacingRadians`, `earthRadiusMeters`).
    - [ ] **Strategie d'invalidation** : Si un de ces parametres change, vider la Map de cache et reinitialiser tout le pipeline de preparation.

- [ ] **Implementation du "Background Warming" (Cones)**
    - [ ] Creer un `WarmingOrchestrator` qui execute en arriere-plan (IDLE) la sequence : `raw-cone-alphas` -> `ciseled-cones`.
    - [ ] Stocker uniquement la **distance d'intersection ($)** dans une `Map<Year, Float32Array>`.
    - [ ] Prioriser l'annee cible de l'UI dans la file de calcul.

---

## Phase 3 : Phase Operationnelle (Calcul Dynamique)

**Note** : En Phase 3, on ne recalcule jamais les intersections si elles sont en cache. On ne fait que la projection et la mise en forme finale.

### 3.1 Pipeline des Cones (GPU)
- [ ] **Chargement du Cache** : Si l'annee est prête, uploader le buffer de distances ($) au GPU.
- [ ] **Implementation du Kernel `final-cones`** :
    - Entree : Sommets Invariants + Distances $ (Cache) + Limites Pays (N-Vectors) + ProjectionParams.
    - Role : Reconstruire ECEF, Appliquer Clipping Pays, Appliquer **Mix de Projection**.

### 3.2 Courbes (GPU)
- [ ] **Alignement du Kernel `curve-geometry`** :
    - Appliquer le calcul de hauteur dynamique et le **mix de projection** identique aux cones.

### 3.3 Pays : Extrusion & Projection (GPU)
- [ ] **Implementation du Kernel `country-projection`** :
    - Role : Appliquer `height * extrusionMix` sur les vertices et le **mix de projection** cartographique.

### 3.4 Unification des Uniforms
- [ ] Creer une structure de `ProjectionParams` commune a tous les kernels (Phase 3) pour garantir une transition visuelle parfaitement synchronisee.

---

## Phase 4 : Mise a jour Babylon.js

- [ ] **Optimisation du Renderer**
    - [ ] Valider qu'AUCUN mesh n'est recree lors d'un changement d'annee (sauf si rejeu Phase 2).
    - [ ] Utiliser exclusivement `updateVerticesData` sur le canal 'position'.

- [ ] **Feedback Utilisateur (Warming UI)**
    - [ ] Si une annee demandee n'est pas encore dans la Map : afficher un indicateur de chargement et bloquer la Phase 3 pour cette annee jusqu'a reception du signal "Ready" du WarmingOrchestrator.

---

## Validation & Performance

- [ ] **Mesure Memoire** : Verifier que le cache 100 ans ne depasse pas ~750 Mo.
- [ ] **Mesure FPS** : Confirmer que le passage d'une annee cachee a une autre se fait en moins de 16ms (60 FPS).
