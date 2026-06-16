# Cartographie Détaillée des Données et Transformations (Migration)

Ce document décrit le pipeline de données exhaustif de la migration, découpé par phases opérationnelles, avec qualification des données, des fonctions et des programmes GPU.

---

## 1. Phase 1 : Ingestion des Données
**Objectif** : Transformer les sources hétérogènes en structures relationnelles indexées (lossless).

### 1.1 Réseau de Villes Lossless (CPU)
*   **Fonction principale** : `assembleBaseNetwork`
*   **Transformations** :
    *   Parsing CSV (papaparse) des fichiers villes, arêtes, modes et vitesses.
    *   Indexation bidirectionnelle (villes par code, arêtes par origine/destination).
    *   Calcul des distances orthodromiques (Haversine) en kilomètres.
*   **Qualification des données** :
    | Entité | Donnée | Unité | Signification |
    | :--- | :--- | :--- | :--- |
    | `BaseCity` | `latitude`, `longitude` | Degrés | Coordonnées géographiques (WGS84). |
    | `BaseEdge` | `distCrowKM` | km | Distance orthodromique entre villes. |
    | `BaseEdge` | `transportModeCode` | Index | Référence stable au mode de transport. |

### 1.2 Définition des Limites des Pays (CPU)
*   **Fonction principale** : `extractCountryContours`
*   **Transformations** : Extraction des anneaux externes des MultiPolygons GeoJSON. Normalisation (`openRing`) pour supprimer les points de clôture dupliqués.
*   **Données Qualifiées** :
    | Entité | Donnée | Unité | Signification |
    | :--- | :--- | :--- | :--- |
    | `CountryContour` | `ring` | Radians | Liste ordonnée de points `[lon, lat]` en radians. |

---

## 2. Phase 2 : Préparation des Primitives (Statiques & Dynamiques)
**Objectif** : Générer les structures géométriques et temporelles nécessaires au calcul massif (Cônes, Courbes, Pays).

### 2.1 Pays : Maillage, Extrusion et Index (CPU)
*   **Fonction principale** : `generateCountryGeometry`
*   **Transformations** :
    *   **Densification** : Insertion de points sur le contour (`contourMaxSegmentRadians`).
    *   **Triangulation** : Algorithme de Delaunay (Delaunator) sur le contour densifié + points intérieurs (Fibonacci).
    *   **Extrusion** : Duplication des vertices avec décalage en hauteur (`countryExtrusionHeightMeters`).
    *   **Maillage** : Création des index (Uint32) pour les faces inférieures, supérieures et les murs latéraux. Ces index sont envoyés une seule fois à Babylon.js.
*   **Sortie** : `CountryRenderPreGeometry` (Vertices `[lon, lat, 0]` et `[lon, lat, h]`, UVs, Indexes).

### 2.2 Villes et Invariants (CPU / GPU)
*   **Matrices NED-to-ECEF (GPU)** : Kernel `city-ned2ecef`
    *   **Entrées** : `cityLonLatRadians` (Float32, stride 2).
    *   **Sorties** : `cityNed2EcefMatrices` (Float32, stride 16, Col-Major). **Cet élément est un invariant calculé une seule fois.**
*   **Voisinage (CPU)** : `selectOverlapCandidatesCpu`
    *   **Sortie** : `overlapCandidates` (Uint32, sélection bornée par secteur azimutal).
*   **Limites de Clipping (CPU)** : `buildDensifiedContourBuffers`
    *   **Sortie** : `countryContourNVectorBuffer` (Float32, vec4 `[x,y,z,0]`).

### 2.3 Éléments Dynamiques - Annuels (CPU)
*   **Fonction principale** : `prepareDynamicTown`
*   **Transformations** :
    *   Interpolation linéaire des vitesses par mode pour l'année T.
    *   Calcul de l'angle alpha : `α = atan(sqrt((maxSpeed/speed)² - 1))`.
    *   Assemblage de `cityLinkAlpha` (alpha minimal terrestre par destination).
*   **Qualification des données** :
    | Donnée | Unité | Signification |
    | :--- | :--- | :--- |
    | `roadAlphaRadians` | Radians | Pente de référence (mode Route) pour l'année T. |
    | `cityLinkAlpha` | Radians | Pente locale associée à une connexion ville-ville. |

---

## 3. Phase 3 : Phase Opérationnelle (Calcul Dynamique)
**Objectif** : Générer les coordonnées finales des meshes projetés en réponse aux changements d'année ou de projection. **Cette phase réutilise les invariants (matrices NED-to-ECEF) produits en Phase 2.**

### 3.1 Cônes (GPU)
Le pipeline de calcul des cônes s'appuie sur une séquence ordonnée de kernels :
1.  **Kernel `raw-cone-alphas`** : Interpolation circulaire des pentes `alpha` par échantillon d'azimut autour de chaque ville.
2.  **Kernel `ciseled-cones`** : Raycasting cône-cône (utilisant les matrices NED-to-ECEF de la Phase 2) pour déterminer la distance d'intersection `t_min` avec les voisins.
3.  **Kernel `final-cones` (Projection & Clipping Pays)** :
    *   **Entrées** : `ciseledRimEcef`, `townBoundaryEcef` (Limites GeoJSON), `projectionParams`.
    *   **Transformation** : Clipping final par la limite pays, puis application du **mix de projection** (Globe <-> Carte).
    *   **Sortie** : `finalConeGeometryEcef` (vec4 projeté).

### 3.2 Courbes (GPU)
*   **Kernel** : `curve-geometry`
    *   **Entrées** : `controlPointsEcef` [A, P, Q, B], `speedRatio`, `projectionParams`, `coefficient`.
    *   **Transformation** :
        1. Calcul de la hauteur de la courbe selon le modèle `OM' - R`.
        2. Échantillonnage de la Bézier cubique (Lerp 3D).
        3. Application du **mix de projection** dynamique.
    *   **Sortie** : `curveVertexPositions` (vec4 projeté).

### 3.3 Pays : Extrusion & Projection (GPU)
*   **Shader / Kernel** (Si profil WebGL2/WebGPU actif) :
    *   **Entrées** : `vertices` [lon, lat, 0/h], `projectionParams`, `mixFactor`.
    *   **Transformation** : Application dynamique de l'extrusion (via le facteur de mix) et de la projection finale directement sur le GPU.
    *   **Pseudo-code** : `PosFinal = project(lon, lat, height * mixFactor, projectionType, percent);`

---

## 4. Phase 4 : Mise à jour Babylon.js
**Objectif** : Rafraîchissement du rendu visuel final.

*   **Gestion des Meshes** : Créés **une seule fois** lors de l'entrée dans la phase opérationnelle (Phase 2).
*   **Mise à jour des Buffers** : Lors d'un changement d'année, d'extrusion ou de projection, les nouvelles positions calculées par les kernels (Phase 3) sont injectées dans les meshes via `mesh.updateVerticesData`.
*   **Rendu** : Babylon.js utilise les buffers mis à jour pour dessiner la scène (Draw calls optimisés).

---

## 5. Spécifications Techniques des Kernels (WGSL)

### 5.1 Kernel `final-cones`
*   **Organisation** : 1 invocation par (ville, échantillon azimut).
*   **Pseudo-code** :
    ```wgsl
    dist_ciseled = length(ciseled_rim);
    dist_boundary = boundary_distance_m;
    rim = select(ciseled_rim, boundary_rim, dist_boundary < dist_ciseled);
    output = project_mix(rim, projection_start, projection_end, percent);
    ```

### 5.2 Kernel `curve-geometry`
*   **Organisation** : 1 invocation par (courbe, échantillon segment).
*   **Pseudo-code** :
    ```wgsl
    P = sample_bezier(A, P_lifted, Q_lifted, B, t);
    output = project_mix(P, projection_start, projection_end, percent);
    ```

---

## 6. Schémas de Synthèse

### 6.1 Flux Global (Mermaid)
![Flux Global](diagrams/data_flow_comprehensive.mermaid)

### 6.2 Cartographie Technique (PlantUML)
![Cartographie Technique](diagrams/data_mapping_comprehensive.plantuml)

### 6.3 Responsabilités CPU / GPU / Renderer
![Responsabilités](diagrams/precompute/01-responsibilities.png)

### 6.4 Modèle Scientifique (Alphas, Cônes et Courbes)
![Modèle Scientifique](diagrams/precompute/08-alpha-dynamic-cones-curves.png)

### 6.5 Maillage et Limites GeoJSON (Extrusion)
![Maillage et Limites GeoJSON](diagrams/precompute/07-geojson-boundaries.png)
