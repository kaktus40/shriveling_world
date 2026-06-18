# Cartographie Détaillée des Données et Transformations (Migration)

Ce document fournit une cartographie exhaustive des structures de données, de leurs unités, de leur signification, ainsi que le détail des transformations opérées sur le CPU et le GPU dans le cadre de la migration vers SvelteKit/Babylon/WebGPU.

---

## 1. Phase 1 : Ingestion des Données
**Objectif** : Transformer les fichiers bruts (CSV, GeoJSON) en structures indexées.

### 1.1 Réseau de Villes Lossless (CPU)
*   **Fonction principale** : `assembleBaseNetwork`
*   **Transformations** :
    *   Parsing CSV (papaparse).
    *   Indexation : `cityByCode`, `edgesByOrigin`, `edgesByDestination`.
    *   Calcul des distances orthodromiques (Haversine).
*   **Données Qualifiées** :
    | Entité | Donnée | Unité | Signification |
    | :--- | :--- | :--- | :--- |
    | `BaseCity` | `latitude`, `longitude` | Degrés | Coordonnées sources (WGS84). |
    | `BaseEdge` | `distCrowKM` | km | Distance orthodromique entre villes. |
    | `BaseCity` | `radius` | Mètres | Rayon d'influence optionnel. |

### 1.2 Définition des Limites des Pays (CPU)
*   **Fonction principale** : `extractCountryContours`
*   **Transformations** : Extraction anneaux externes MultiPolygons GeoJSON, suppression du point de clôture redondant (`openRing`).
*   **Données Qualifiées** :
    | Entité | Donnée | Unité | Signification |
    | :--- | :--- | :--- | :--- |
    | `CountryContour` | `ring` | Radians | Liste ordonnée de points `[lon, lat]` en radians. |

---

## 2. Phase 2 : Préparation des Primitives (Statiques & Dynamiques)
**Objectif** : Générer les éléments statiques (invariants) et préparer les données dynamiques annuelles.

### 2.1 Éléments Statiques (CPU & GPU)

#### Matrices NED-to-ECEF (GPU)
*   **Kernel** : `city-ned2ecef`
*   **Entrée** : `cityLonLatRadians` (Float32Array, [Lon, Lat], stride 2).
*   **Sortie** : `cityNed2EcefMatrices` (Float32Array, mat4x4, stride 16).
*   **Transformation (Pseudo-code)** : 
    ```wgsl
    let pos = EarthRadius * SphericalToCartesian(Lon, Lat);
    let basis = LocalBasis(Lon, Lat);
    return mat4(basis, pos);
    ```

#### Maillage Pays & Extrusion (CPU)
*   **Fonction principale** : `generateCountryGeometry`
*   **Transformations** :
    1.  Densification du contour.
    2.  Triangulation Delaunay (Delaunator) des surfaces.
    3.  **UV Calculation** : `u = lon / 2PI + 0.5`, `v = lat / PI + 0.5`.
    4.  Extrusion : Duplication des sommets avec `Z = extrusionHeightMeters`.
    5.  Génération des murs latéraux : triangles (A_bas, B_bas, A_haut).
*   **Qualification des données** :
    | Entité | Donnée | Unité | Signification |
    | :--- | :--- | :--- | :--- |
    | `CountryMesh` | `vertices` | Lon, Lat, m | Triplés [lon, lat, hauteur] pour rendu. |
    | `CountryMesh` | `uvs` | 0-1 | Coordonnées de texture statiques. |

---

## 3. Phase 3 : Phase Opérationnelle (Calcul Dynamique)
**Objectif** : Générer les coordonnées finales des meshes projetés en réponse aux changements (Année, Projection).

### 3.1 Warming Orchestrator (Background CPU/GPU)
*   **Fonction principale** : `WarmingOrchestrator` (`src/lib/compute/webgpu/warming.ts`)
*   **Objectif** : Pré-calculer les intersections de cônes pour toutes les années du jeu en background, sans bloquer l'UI (`requestIdleCallback`).
*   **Flux de données (par année)** :
    1.  `computeDynamicTownPrecomputeForYearCpu` (CPU) : Calcul des paramètres dynamiques de l'année.
    2.  `runWebGpuRawConeAlphaPass` (GPU) : Pré-calcul des alpha.
    3.  `runWebGpuCiseledConePass` (GPU) : Calcul du kernel `ciseled-cones` (Raycasting d'intersection).
    4.  **ReadBack** : Transfert GPU -> CPU (`readBackFloat32Buffer`) des distances `t_min`.
    5.  **Caching** : Stockage du résultat dans `Map<number, Float32Array>` pour accès instantané lors du changement d'année par l'utilisateur.

### 3.2 Cônes (GPU Pipeline)
1.  **Kernel `raw-cone-alphas`** : Interpolation angulaire des pentes `alpha` par échantillon d'azimut.
2.  **Kernel `ciseled-cones`** : Raycasting cône-cône pour déterminer `t_min` (distance d'intersection).
3.  **Kernel `final-cones`** :
    *   **Clipping** : Découpe par la limite pays (via `townBoundaryEcef`).
    *   **UV Calculation** : `u = azimuth / 2PI`, `v = distance / coneLength`.
    *   **Projection** : Application dynamique du **mix de projection** (Globe <-> Carte).
    *   **Sortie** : `finalConeGeometryEcef` (vec4 : `[x, y, z, u]`).

### 3.2 Courbes (GPU)
*   **Kernel** : `curve-geometry`
    *   **Entrée** : `controlPoints` [A, P, Q, B], `speedRatio`, `projectionParams`.
    *   **Transformation** : Échantillonnage Bézier + hauteur + projection dynamique.
    *   **Sortie** : `curveVertexPositions` (vec4).

### 3.3 Pays : Extrusion & Projection (GPU)
*   **Kernel `country-projection`** :
    *   **Transformation** : Applique l'extrusion dynamique (height * mixFactor) et le mix de projection sur les vertices pré-calculés.
    *   **Sortie** : Vertices projetés.

---

## 4. Phase 4 : Mise à jour Babylon.js
**Objectif** : Rafraîchissement du rendu visuel final via `updateVerticesData`.

*   **Principe** : Meshes instanciés une seule fois.
*   **Optimisation** : Injection directe des buffers GPU (`Positions` + `UVs`) sans reconstruction CPU.

---

## 5. Schémas de Synthèse
(Voir `docs/diagrams/` pour les schémas complets).
