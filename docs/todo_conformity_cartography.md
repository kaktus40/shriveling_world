# TODO List : Mise en conformite du code avec la Cartographie des Donnees (V7)

Cette liste detaille les actions techniques restantes pour finaliser la branche de migration.

---

## Phase 2 : Preparation des Primitives (Invariants & Warming)

- [ ] **Isolation des Invariants Fixes**
    - [ ] Modifier WebGpuComputeBackend pour ne dispatcher runWebGpuCityMatrixPass qu'une seule fois par dataset.
    - [ ] Stocker le buffer resultat (cityNed2EcefMatrices) dans un cache d'invariants statiques.

- [ ] **Gestion des evenements de rejeu Phase 2 (`neighborLimit`, `interiorPointSpacingRadians`)**
    - [ ] Implementer la detection de changement via comparaison des ComputeOptions.
    - [ ] Si changement : vider le cache d'invariants statiques ET la Map<Year, Float32Array> des cones (Phase 3).

- [ ] **Implementation du "Background Warming" (Cones)**
    - [ ] Creer le WarmingOrchestrator executant en arriere-plan la sequence : raw-cone-alphas -> ciseled-cones.
    - [ ] Ajouter une méthode `setFocusYear(year: number)` dans `WarmingOrchestrator` pour réordonner la file de calcul.
    - [ ] Implémenter une boucle de traitement asynchrone `processQueue()` utilisant `requestIdleCallback` pour ne pas bloquer le rendu.
    - [ ] Assurer que `warmYear()` vérifie en priorité la file avant de traiter les années restantes en arrière-plan.
    - [ ] Stocker uniquement la distance d'intersection (t) dans une Map<Year, Float32Array>.
    - [ ] Prioriser l'annee cible de l'UI dans la file de calcul.

- [ ] **Integration des UVs statiques (Pays)**
    - [ ] Ajouter `uvs` (Float32Array) dans `CountryRenderPreGeometry` et le buffer de vertex.
    - [ ] Pré-calculer les UVs lors de l'extrusion (Surface inf. et sup. + murs latéraux).

---

## Phase 3 : Phase Operationnelle (Calcul Dynamique)

**Note** : En Phase 3, l'orchestrateur doit gérer la transition entre le cache CPU et le GPU.

### 3.1 Pipeline des Cones (GPU)
- [ ] **Câblage Orchestrateur / Cache** :
    - Dans WebGpuComputeBackend, avant d'appeler final-cones :
        - Vérifier si l'annee est dans la Map.
        - Si oui : queue.writeBuffer pour uploader les donnees de la Map vers un GPUBuffer.
        - Si non : Exécuter raw-cone-alphas et ciseled-cones, puis sauver le resultat dans la Map.
- [ ] **Implementation du Kernel `final-cones`** :
    - **UV Calculation** : Ajouter le calcul dynamique des UVs (`u=azimuth/2PI`, `v=distance/coneLength`) et élargir le buffer de sortie.
    - Câbler le kernel final-cones (Projection & Clipping Pays).

### 3.2 Courbes (GPU)
- [ ] **Alignement du Kernel `curve-geometry`** :
    - Appliquer la hauteur dynamique et le mix de projection identique aux cônes.

### 3.3 Pays : Extrusion & Projection (GPU)
- [ ] **Deplacer l'extrusion dynamique sur le GPU** (Kernel `country-projection`).

---

## Phase 4 : Mise a jour Babylon.js

- [ ] **Optimisation du Renderer**
    - [ ] Utiliser exclusivement mesh.updateVerticesData pour injecter les buffers GPU (Positions + UVs).
- [ ] **Feedback Utilisateur (Warming UI)**
    - [ ] Afficher un indicateur si l'annee demandee est en cours de warming.
