# Migration SvelteKit, Babylon.js et WebGPU

Ce document de cadrage decrit le plan de migration de Shriveling world depuis la branche principale historique vers une architecture modernisee.

La nouvelle branche de travail est `migration-sveltekit-babylon-webgpu`, creee depuis `origin/master`.

## Objectifs

La migration poursuit quatre objectifs principaux:

- Reduire la dette technique en remplaçant Sapper/Rollup par SvelteKit/Vite et en mettant a jour les briques logicielles.
- Remplacer le rendu Three.js par Babylon.js.
- Remplacer le pseudo-compute WebGL2 par un framework WebGPU compute specifique au projet.
- Faire evoluer le pipeline de calcul pour ameliorer les intersections entre cones, villes, courbes et limites geographiques.

La migration ne doit pas etre une reecriture monolithique. Elle doit etre decoupee en etapes testables, avec des sorties de reference permettant de distinguer une regression d'une evolution intentionnelle du modele.

## Etat Historique

L'application historique repose sur:

- Sapper, Svelte 3 et Rollup pour l'application web.
- Three.js pour le rendu 3D.
- WebGL2 detourne en moteur de calcul via fragment shaders, textures et framebuffers.
- Un `Merger` central qui lit et assemble les donnees CSV et prepare les structures du modele.
- Des modules de rendu/calcul fortement couples au moteur Three.js.

Les fichiers critiques de l'architecture historique sont:

- `src/application/bigBoard/merger.ts`
- `src/application/bigBoard/bigBoard.ts`
- `src/application/cone/coneMeshShader.ts`
- `src/application/cone/curveMeshShader.ts`
- `src/application/country/countryMeshShader.ts`
- `src/application/country/countryBoard.ts`
- `src/application/common/gpuComputer.ts`
- `src/application/common/configuration.ts`
- `src/application/shaders/*.frag`
- `src/application/shaders/*.glsl`

## Principe D'Architecture Cible

L'architecture cible doit separer clairement cinq couches:

1. `data`: lecture, validation, normalisation et fusion des fichiers CSV/GeoJSON.
2. `precompute`: preparation des structures stables qui alimentent les calculs interactifs.
3. `compute`: kernels WebGPU et orchestration des passes intensives.
4. `render`: affichage Babylon.js, materiaux, camera, interaction et export.
5. `ui`: application SvelteKit, stores, controles utilisateur, chargement des datasets.

Le point majeur est la distinction entre precalcul et calcul interactif.

## Separation Precalcul / Calcul Interactif

Le pipeline doit etre explicitement divise en deux phases.

### Phase De Precalcul

La phase de precalcul est declenchee quand le dataset change ou quand un parametre structurel impose de reconstruire les entrees du modele.

Elle part des donnees brutes:

- villes;
- populations;
- modes de transport;
- vitesses par mode et par annee;
- reseau de transport;
- frontieres GeoJSON;
- parametres structurels de resolution ou d'echantillonnage.

Elle produit des entrees compactes, typées et reutilisables pour les calculs intensifs:

- tables de villes normalisees;
- index ville -> ordre;
- graphes entrants/sortants;
- span temporel valide;
- vitesses interpolees par mode et par annee;
- angles `alpha` par mode et par annee;
- matrices de referentiels locaux;
- positions ECEF/cartographiques;
- voisinages utiles aux intersections;
- limites geographiques preparees;
- buffers statiques pour villes, pays, frontieres et reseau;
- dictionnaires et offsets permettant aux kernels d'acceder aux donnees sans branchements inutiles.

Cette phase ne doit pas dependre du moteur de rendu. Elle doit pouvoir etre testee en isolation.

### Phase De Calcul Interactif

La phase interactive est declenchee quand l'utilisateur change:

- l'annee;
- la projection;
- la representation;
- la forme des cones;
- le coefficient vertical;
- le mode d'affichage;
- certains parametres visuels ou de clipping.

Elle ne doit pas relire les datasets ni reconstruire les graphes. Elle consomme les sorties du precalcul et execute uniquement les kernels necessaires:

- selection des vitesses et alphas pour l'annee;
- deformation des cones;
- calcul des intersections;
- clipping par limites;
- generation des vertices finaux;
- projection ou transformation de representation;
- generation des buffers de rendu.

API cible indicative:

```ts
const prepared = await prepareDataset(rawDataset, preparationOptions);

const frame = await computeVisualization(prepared, {
	year,
	projection,
	representation,
	conesShape,
	zCoeff,
});

renderer.update(frame);
```

Cette frontiere est un invariant de la migration.

## Phase 0: Branche Propre Et Cadrage

Objectif: travailler depuis une base stable.

Actions:

- Creer une branche depuis `origin/master`.
- Ne pas importer automatiquement la branche `toBabylon`.
- Utiliser `toBabylon` comme prototype et reserve d'idees, pas comme base de migration.
- Documenter les composants a conserver, remplacer ou supprimer.
- Identifier les datasets de reference.

Livrables:

- `docs/migration-sveltekit-babylon-webgpu.md`
- liste des datasets de reference;
- liste des invariants scientifiques a préserver.

Critere de validation:

- la branche est propre;
- l'etat historique est compris;
- aucun changement applicatif n'a encore ete introduit.

## Phase 1: Tests Et Sorties De Reference

Objectif: securiser la migration avant de changer le socle.

Actions:

- Creer un dataset minimal de test.
- Selectionner un dataset realiste de reference.
- Ajouter des tests sur la lecture CSV/GeoJSON.
- Ajouter des tests sur le `Merger`.
- Verifier:
  - nombre de villes;
  - nombre de modes;
  - nombre d'arcs;
  - detection du mode `Road`;
  - span temporel;
  - vitesses interpolees;
  - alphas par annee;
  - nombre de cones et courbes attendus.
- Produire des snapshots numeriques tolerants pour quelques sorties geometriques.

Livrables:

- fixtures de test;
- tests unitaires du pipeline data;
- snapshots de reference;
- commandes de test reproductibles.

Critere de validation:

- les tests passent sur l'ancien pipeline;
- les futures migrations peuvent etre comparees a une base connue.

## Phase 2: Migration SvelteKit Et Vite

Objectif: moderniser le socle web sans modifier le modele scientifique.

Actions:

- Remplacer Sapper par SvelteKit.
- Remplacer Rollup par Vite.
- Mettre a jour TypeScript, ESLint et Prettier.
- Choisir un seul gestionnaire de paquets. Recommandation: `pnpm`.
- Deplacer les assets publics dans `static/`.
- Recréer les routes necessaires:
  - application;
  - documentation;
  - pages de test visuel;
  - chargement de dataset.
- Conserver temporairement Three.js si necessaire pour limiter le risque.

Livrables:

- application SvelteKit qui demarre;
- build de production fonctionnel;
- chargement de dataset fonctionnel;
- tests existants toujours verts.

Critere de validation:

```bash
pnpm install
pnpm test
pnpm build
pnpm dev
```

## Phase 3: Extraction Du Domaine Metier

Objectif: decoupler les calculs du moteur de rendu.

Actions:

- Extraire les types metier vers un module stable.
- Extraire la lecture et la fusion des donnees.
- Supprimer les imports Three.js des modules de configuration scientifique.
- Isoler les fonctions pures:
  - interpolation;
  - geodesie;
  - referentiels;
  - projections;
  - conversions cartographiques;
  - calculs d'angles.
- Remplacer progressivement la configuration globale mutable par un service ou store type.
- Formaliser les entrees/sorties de la phase de precalcul.

Structure indicative:

```text
src/lib/domain/
  data/
  model/
  math/
  projection/
  precompute/
```

Livrables:

- pipeline data testable sans navigateur;
- types propres pour `PreparedDataset`;
- aucun import Three.js ou Babylon.js dans `domain`.

Critere de validation:

- le precalcul tourne en environnement de test Node;
- les sorties restent compatibles avec les snapshots.

## Phase 4: Rendu Babylon.js

Objectif: remplacer Three.js par Babylon.js pour l'affichage, sans changer encore les algorithmes intensifs.

Actions:

- Creer une abstraction de scene Babylon.
- Reproduire les couches principales:
  - pays;
  - cones;
  - courbes;
  - villes;
  - labels;
  - selection;
  - camera.
- Porter progressivement les geometries Three.js vers des `Mesh` ou `VertexData` Babylon.
- Conserver la logique de calcul separee du rendu.
- Ajouter une page de test visuel.

Structure indicative:

```text
src/lib/render/babylon/
  BabylonScene.ts
  CountryLayer.ts
  ConeLayer.ts
  CurveLayer.ts
  CityLayer.ts
  materials.ts
```

Livrables:

- scene Babylon affichant un dataset de reference;
- interaction minimale;
- comparaison visuelle avec l'ancien rendu;
- Three.js supprime des couches de rendu migrees.

Critere de validation:

- le rendu Babylon affiche les memes objets principaux que le rendu historique;
- les tests du domaine restent independants du renderer.

## Phase 5: Framework WebGPU Compute

Objectif: remplacer `GPUComputer` par une infrastructure WebGPU adaptee au projet.

Le framework ne doit pas etre couple a Babylon.js. Il doit etre utilisable par le pipeline de calcul et seulement fournir ensuite des buffers au rendu.

Actions:

- Creer une initialisation WebGPU robuste.
- Gerer:
  - `GPUAdapter`;
  - `GPUDevice`;
  - buffers storage;
  - buffers uniformes;
  - staging buffers de debug;
  - bind groups;
  - pipelines compute;
  - cache de pipelines;
  - dispatch;
  - readback optionnel.
- Definir une API de kernel projet.
- Ajouter un fallback clair si WebGPU est indisponible.
- Porter un premier kernel simple depuis GLSL vers WGSL.

Structure indicative:

```text
src/lib/compute/
  core/
    WebGpuContext.ts
    BufferStore.ts
    Kernel.ts
    PipelineCache.ts
  kernels/
    *.wgsl
  passes/
    cones.ts
    curves.ts
    boundaries.ts
```

API indicative:

```ts
const kernel = await compute.createKernel({
	name: 'rawCones',
	shader: rawConesWgsl,
	bindings,
});

await kernel.dispatch({ x: vertexCount, y: cityCount });
```

Livrables:

- framework WebGPU minimal;
- premier kernel WGSL teste;
- comparaison numerique avec une sortie WebGL2 ou CPU;
- documentation des formats de buffers.

Critere de validation:

- un kernel reproduit une sortie connue;
- le readback CPU est possible pour debug;
- le calcul ne depend pas du rendu.

## Phase 6: Portage Des Kernels Et Passes De Calcul

Objectif: migrer les calculs intensifs existants vers WGSL.

Kernels a porter en priorite:

- generation des cones;
- generation des courbes;
- calculs de limites;
- conversions de projection;
- intersections;
- clipping.

GLSL historique a analyser:

- `src/application/shaders/coneMeshShader.frag`
- `src/application/shaders/lineMeshShader.frag`
- `src/application/shaders/countryMeshShader.frag`
- `src/application/shaders/displayConversions.glsl`
- `src/application/shaders/polar2Cartographic.glsl`

Actions:

- Traduire les fonctions communes GLSL en WGSL.
- Regrouper les uniforms en structures explicites.
- Remplacer les textures de donnees WebGL par storage buffers WebGPU.
- Eviter les readbacks CPU dans le chemin normal.
- Ajouter des tests de precision numerique.

Livrables:

- kernels WGSL versionnes;
- tests de comparaison;
- documentation des buffers par passe.

Critere de validation:

- les cones et courbes sont generes via WebGPU;
- les sorties restent dans les tolerances attendues.

## Phase 7: Evolution Du Pipeline D'Intersections

Objectif: ameliorer la qualite et la robustesse des intersections entre cones.

Problemes a traiter:

- approximations par bounding boxes;
- artefacts aux frontieres;
- intersections instables selon la resolution;
- dependance trop forte au decoupage angulaire;
- melange entre limites geographiques, limites de villes et intersections entre cones.

Pipeline cible:

1. `DatasetParsePass`
2. `NetworkMergePass`
3. `SpeedTimelinePass`
4. `TownStaticGeometryPass`
5. `BoundaryPreparationPass`
6. `ConeRawPass`
7. `ConeConeIntersectionPass`
8. `ConeBoundaryClipPass`
9. `ConeFinalizePass`
10. `ProjectionDisplayPass`
11. `RenderUploadPass`

Axes d'amelioration:

- representer les cones par secteurs angulaires explicites;
- calculer les intersections dans un referentiel coherent;
- utiliser ECEF ou un referentiel local selon la passe;
- construire un index spatial de villes et frontieres;
- separer intersection cone/cone et clipping geographique;
- conserver des cas tests geometriques simples pour valider les intersections.

Livrables:

- specification des passes;
- kernels d'intersection;
- cas tests analytiques;
- comparaison visuelle et numerique.

Critere de validation:

- moins d'artefacts visibles;
- meilleure stabilite quand la resolution varie;
- performances compatibles avec l'interaction.

## Phase 8: Integration Babylon.js Et WebGPU

Objectif: connecter les buffers produits par WebGPU au rendu Babylon.js.

Actions:

- Utiliser Babylon.js pour le rendu final.
- Etudier l'usage de `WebGPUEngine`.
- Conserver le compute projet independant du renderer.
- Minimiser les copies CPU.
- Mettre a jour les vertex buffers Babylon depuis les buffers de calcul.
- Ajouter un mode debug capable de lire certains buffers CPU.

Livrables:

- rendu Babylon alimente par le pipeline WebGPU;
- changement d'annee interactif;
- changement de representation interactif;
- mode debug pour inspecter les buffers.

Critere de validation:

- les changements d'annee et de representation ne relancent pas le precalcul;
- seules les passes interactives sont executees.

## Phase 9: Interface Utilisateur Et Documentation

Objectif: reconstruire une interface claire autour du nouveau pipeline.

Actions:

- Creer des composants SvelteKit pour:
  - choix du dataset;
  - annee;
  - projection;
  - representation;
  - resolution;
  - affichage des couches;
  - export.
- Ajouter une vue developpeur:
  - etat du precalcul;
  - passes executees;
  - durees GPU/CPU;
  - tailles de buffers;
  - erreurs WebGPU.
- Mettre a jour la documentation utilisateur.
- Mettre a jour la documentation developpeur.

Livrables:

- interface fonctionnelle;
- documentation d'utilisation;
- documentation d'architecture;
- guide de contribution au pipeline compute.

## Regles De Migration

- Ne pas melanger migration technique et changement algorithmique dans le meme commit.
- Ne pas introduire Babylon.js dans les modules de domaine.
- Ne pas introduire WebGPU dans les modules UI.
- Ne pas relancer le precalcul sur un simple changement d'annee ou de representation.
- Ne pas utiliser le readback CPU dans le chemin interactif normal.
- Garder les kernels testables individuellement.
- Garder un dataset minimal de regression.
- Documenter tout changement scientifique intentionnel.

## Role De La Branche `toBabylon`

La branche `toBabylon` est utile comme prototype.

Elements potentiellement reutilisables:

- idees de scene Babylon;
- composants de test Babylon/OpenLayers;
- generation GeoJSON vers mesh;
- experimentation sur les limites de villes;
- premiers shaders/passes separees.

Elements a eviter en import direct:

- migration de dependances en bloc;
- melange Svelte 5, UI libraries et build tooling;
- code partiellement commente;
- changements de datasets non isoles;
- suppression simultanee de modules historiques.

La bonne methode est de cherry-pick ou recopier selectivement des idees apres avoir stabilise l'architecture cible.

## Points De Validation Globaux

La migration sera consideree solide quand:

- le pipeline data/precompute est teste sans navigateur;
- SvelteKit build en production;
- Babylon.js remplace Three.js pour le rendu principal;
- WebGPU remplace le compute WebGL2 pour les passes critiques;
- les changements d'annee et de representation exploitent les buffers de precalcul;
- les intersections de cones sont plus robustes sur les cas tests;
- les performances sont mesurees;
- l'architecture est documentee.

## Questions Ouvertes

- Faut-il conserver une vue OpenLayers 2D synchronisee ou seulement l'utiliser comme outil de debug?
- Quel format d'export devient prioritaire: OBJ, glTF, autre?
- Quelle precision numerique minimale est acceptable pour les comparaisons de sorties?
- Quels datasets doivent devenir les references officielles de regression?
- Quelle politique de fallback si WebGPU est indisponible?
