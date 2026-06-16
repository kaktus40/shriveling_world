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
*   **Transformations** : Extraction des anneaux externes des MultiPolygons GeoJSON. Normalisation (`openRing`).
*   **Données Qualifiées** :
    | Entité | Donnée | Unité | Signification |
    | :--- | :--- | :--- | :--- |
    | `CountryContour` | `ring` | Radians | Liste ordonnée de points `[lon, lat]` en radians. |

---

## 2. Phase 2 : Préparation des Primitives (Statiques & Dynamiques)
**Objectif** : Générer les structures géométriques et temporelles nécessaires au calcul massif.

### 2.1 Pays : Maillage, Extrusion, UVs et Index (CPU)
*   **Fonction principale** : `generateCountryGeometry`
*   **Transformations** :
    *   **Densification** : Insertion de points sur le contour.
    *   **Triangulation** : Algorithme de Delaunay (Delaunator) sur le contour densifié + points intérieurs (Fibonacci).
    *   **UV Calculation** : Calcul statique `u = lon / 2PI + 0.5`, `v = lat / PI + 0.5`.
    *   **Extrusion** : Duplication des vertices avec décalage en hauteur (`countryExtrusionHeightMeters`).
    *   **Maillage** : Création des index (Uint32) et stockage des UVs pré-calculés dans le buffer de vertex.
*   **Sortie** : `CountryRenderPreGeometry` (Vertices `[lon, lat, h]`, UVs, Indexes).

### 2.2 Villes et Invariants (CPU / GPU)
*   **Matrices NED-to-ECEF (GPU)** : Kernel `city-ned2ecef`.

---

## 3. Phase 3 : Phase Opérationnelle (Calcul Dynamique)
**Objectif** : Générer les coordonnées finales des meshes projetés.

### 3.1 Cônes (GPU)
1.  **Kernel `raw-cone-alphas`** : Interpolation des pentes `alpha`.
2.  **Kernel `ciseled-cones`** : Raycasting cône-cône.
3.  **Kernel `final-cones`** :
    *   Clipping final par la limite pays.
    *   Projection dynamique.
    *   **UV Calculation** : Calcul dynamique `u = azimuth / 2PI`, `v = distance / coneLength`.
    *   **Sortie** : `finalConeGeometryEcef` (vec4 : `[x, y, z, u]`).

### 3.2 Pays : Extrusion & Projection (GPU)
*   **Kernel `country-projection`** :
    *   Applique l'extrusion dynamique et la projection finale.
    *   **UVs** : Transfert des UVs pré-calculés en Phase 2 vers le buffer final.

---

## 4. Phase 4 : Mise à jour Babylon.js
**Objectif** : Rendu final.
*   **Optimisation** : Utilisation de `mesh.updateVerticesData` pour injecter directement les buffers GPU (Positions + UVs).
