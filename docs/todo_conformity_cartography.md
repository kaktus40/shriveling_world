# TODO List : Mise en conformite du code avec la Cartographie des Donnees (Audit V3)

Cette liste detaille les actions techniques restantes pour finaliser la branche de migration.

---

## Phase 3 : Phase Operationnelle (Calcul Dynamique)

### 3.1 Pipeline des Cones (GPU)
- [x] **Câblage Orchestrateur / Cache**
- [x] **Implementation Kernel `final-cones`**
    - [x] UV Calculation (Sphérique)
    - [x] Câblage projection et clipping

### 3.2 Courbes (GPU)
- [ ] **Alignement du Kernel `curve-geometry`** :
    - [ ] Appliquer la hauteur dynamique et le mix de projection identique aux cônes (utilisation de `project_display_from_ecef`).
    - [ ] **Test** : Valider la projection des courbes avec des paramètres de mix.

### 3.3 Pays : Extrusion & Projection (GPU)
- [x] **Finalisation Kernel `country-projection`** :
    - [x] Intégrer les paramètres de mix de projection (Start/End/Percent).
    - [x] **Test** : Vérifier la projection des sommets extrudés (Position vs UVs).

---

## Phase 4 : Mise a jour Babylon.js

- [x] **Optimisation du Renderer**
    - [x] Utiliser exclusivement `mesh.updateVerticesData` pour injecter les buffers GPU (Positions + UVs).
    - [x] **Test** : Vérifier que le nombre de draw calls reste stable (instanciation unique).
- [ ] **Feedback Utilisateur (Warming UI)**
    - [ ] Afficher un indicateur si l'annee demandee est en cours de warming.

---

## Phase 5 : Alignement des Profils (WebGL2)

- [ ] **Refactoring du Backend WebGL2 (Phase 5)**
    - [ ] Créer un test d'intégration pour le pipeline WebGL2 (prérequis).
    - [ ] Adapter `src/lib/compute/webgl2/backend.ts` pour intégrer le `WarmingOrchestrator`.
    - [ ] Appliquer la structure de double-buffering aux passes WebGL2 (final-cones, country-projection).
    - [ ] Assurer que `runWebGl2ConeStages` vérifie le cache avant de dispatcher les shaders.

---

## Validation & Stratégie de test

- [x] **Validation par Contrats (Contract-Based Mocking)** :
    - Remplacement de l'émulation WGSL binaire (incompatible) par une validation des contrats de buffers (taille, usage, bindgroups) dans les tests d'intégration.
