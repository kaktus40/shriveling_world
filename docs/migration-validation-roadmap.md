# Roadmap De Validation De La Migration

Ce document sert de checklist operationnelle pour piloter la migration SvelteKit, Babylon.js, WebGPU et nouveau pipeline d'intersections.

Il doit etre mis a jour a chaque jalon valide, puis committe. Une etape n'est pas consideree terminee tant que sa section `Validation` n'est pas renseignee.

## Regle De Suivi

Pour chaque jalon:

- documenter les decisions prises;
- documenter les fichiers ajoutes, modifies ou supprimes;
- documenter les commandes de validation lancees;
- documenter les resultats observes;
- documenter les regressions ou limitations restantes;
- committer le code et la documentation ensemble.

Format de commit recommande:

```text
<type>: <short summary>
```

Exemples:

- `docs: detail migration milestones`
- `test: add merger golden fixtures`
- `build: migrate app shell to sveltekit`
- `refactor: extract domain data pipeline`
- `render: add babylon scene shell`
- `compute: add webgpu kernel framework`

## Statuts

Utiliser les statuts suivants:

- `todo`: pas encore commence;
- `in_progress`: en cours;
- `blocked`: bloque, decision requise;
- `validated`: termine et valide;
- `superseded`: remplace par une autre approche documentee.

## Invariants Non Negociables

- Le precalcul ne depend pas de Babylon.js.
- Le precalcul ne depend pas de SvelteKit.
- Le calcul interactif ne relit pas les datasets.
- Un changement d'annee ne reconstruit pas le graphe.
- Un changement de representation ne reconstruit pas les donnees metier.
- Le framework WebGPU n'est pas couple au renderer.
- Les readbacks CPU WebGPU sont reserves aux tests, exports ou debug.
- Les changements scientifiques intentionnels sont documentes.
- Les tests de regression sont mis a jour avant les migrations risquées.
- L'interface utilisateur commune reste SvelteKit.
- Les kernels GPU intensifs sont ecrits en WGSL portable.
- Le client lourd cible Tauri, sans reecriture initiale complete en Rust.
- Le backend Rust/wgpu natif reste une extension possible, pas une dependance du premier portage.

## Vue D'Ensemble Des Jalons

| Jalon | Statut | Objectif |
| --- | --- | --- |
| M0 | validated | Branche propre et documentation initiale |
| M1 | validated | Caracterisation initiale et fixtures |
| M2 | todo | Migration SvelteKit/Vite minimale |
| M2.1 | validated | Evaluation des hooks Rollup applicatifs |
| M3 | todo | Extraction du domaine metier |
| M4 | todo | Architecture explicite de precalcul |
| M5 | todo | Rendu Babylon.js minimal |
| M6 | todo | Framework WebGPU compute minimal |
| M7 | todo | Portage WGSL des passes existantes |
| M8 | todo | Nouveau pipeline d'intersections |
| M9 | todo | Integration interactive complete |
| M9.1 | todo | Packaging client lourd Tauri |
| M10 | todo | Nettoyage, documentation utilisateur et stabilisation |

## M0: Branche Propre Et Documentation Initiale

Statut: `validated`

Objectif:

- creer une branche durable issue de la branche principale;
- documenter le plan general de migration;
- conserver le worktree `toBabylon` intact.

Travail realise:

- branche creee: `migration-sveltekit-babylon-webgpu`;
- base: `origin/master`;
- worktree durable: `/home/abdou/workspace/shriveling_world_migration`;
- document de cadrage ajoute: `docs/migration-sveltekit-babylon-webgpu.md`.

Validation:

- commit initial de documentation: `99957ab docs: add migration roadmap`;
- le worktree principal reste sur `toBabylon`;
- le worktree de migration est propre et en avance d'un commit sur `origin/master`.

## M1: Caracterisation Initiale Et Fixtures

Statut: `validated`

Objectif:

Preparer un socle de travail reproductible sans figer prematurement les resultats attendus du futur pipeline.

Le traitement et le rendu final vont changer. Il ne faut donc pas creer de tests d'attendus qui imposeraient a la migration de reproduire exactement l'ancien comportement. Les attentes fonctionnelles et scientifiques seront definies point par point pendant les jalons suivants.

Ce jalon sert a:

- rendre les datasets de test reproductibles;
- documenter les formats d'entree;
- observer le comportement historique;
- fournir des outils de caracterisation;
- eviter les regressions accidentelles sur le chargement de base;
- preparer les futurs tests, sans les rendre bloquants trop tot.

Travail attendu:

- choisir un dataset minimal et un dataset realiste de reference;
- creer une structure de fixtures dediee;
- ajouter des scripts de caracterisation adaptes a l'etat initial du projet;
- verifier que les CSV et GeoJSON sont lisibles;
- verifier que les fichiers attendus sont presents;
- verifier que les fixtures reduites peuvent etre generees;
- documenter les sorties observees du pipeline historique;
- eviter les golden files d'attendus tant que les attentes cible ne sont pas validees.

Datasets de reference retenus:

- `datasets/World_1M`: dataset reduit a environ 500 villes dispersees sur tout le globe;
- `datasets/Europe_1M`: dataset reduit a environ 50 villes situees en Europe;
- fixtures fictives ou reduites generees a partir des 30 premieres lignes de fichiers `cities*.csv`.

Strategie de fixtures reduites:

- pour chaque dataset source utile, prendre les 30 premieres villes du fichier `cities*.csv`;
- conserver le header CSV;
- filtrer `population*.csv` sur les `cityCode` conserves;
- filtrer `transport_network*.csv` pour ne garder que les arcs dont `cityCodeOri` et `cityCodeDes` appartiennent aux villes conservees;
- conserver les fichiers `transport_modes*.csv` et `transport_mode_speed*.csv` tels quels;
- conserver le GeoJSON source pour les premiers tests data;
- creer plus tard un GeoJSON artificiel minimal pour les tests geometriques analytiques.

Datasets de test proposes pour M1:

- `fixture-30-world`: derive de `datasets/World_1M` avec les 30 premieres villes;
- `fixture-30-europe`: derive de `datasets/Europe_1M` avec les 30 premieres villes;
- `reference-world-1m`: utilise `datasets/World_1M` tel quel pour un test plus large;
- `reference-europe-1m`: utilise `datasets/Europe_1M` tel quel pour un test europeen rapide.

Sorties a observer, sans les figer comme attendus definitifs:

- nombre de villes;
- nombre de populations;
- nombre de modes de transport;
- nombre de lignes du reseau;
- detection du mode `Road`;
- span temporel global;
- vitesses interpolees par mode pour quelques annees;
- alphas par mode pour quelques annees;
- nombre de graphes par ville;
- nombre de courbes attendues;
- nombre de cones attendus;
- quelques positions/refentiels calcules avec tolerance numerique.

Ces sorties peuvent etre enregistrees dans des rapports de caracterisation. Elles ne doivent pas devenir des tests bloquants tant que la nouvelle semantique attendue n'a pas ete precisee.

Fichiers attendus:

```text
tests/
  fixtures/
    fixture-30-world/
    fixture-30-europe/
  characterization/
    fixture-30-world.json
    fixture-30-europe.json
    reference-world-1m.json
    reference-europe-1m.json
    summary.json
```

Les datasets de reference complets ne sont pas copies dans `tests/fixtures/`; ils restent dans `datasets/World_1M` et `datasets/Europe_1M` pour eviter la duplication.

Script de generation attendu:

```text
scripts/
  dataset-utils.mjs
  create-reduced-dataset-fixtures.mjs
  characterize-datasets.mjs
```

Les scripts sont volontairement en `.mjs` pour rester executables dans le socle historique sans introduire de runner TypeScript avant la migration SvelteKit/Vite.

Comportement attendu du script:

- detecter automatiquement le fichier `cities*.csv`;
- extraire les 30 premieres villes;
- filtrer populations et reseau de transport;
- copier modes, vitesses et GeoJSON;
- ecrire une fixture reproductible dans `tests/fixtures/`;
- echouer explicitement si les fichiers attendus sont absents ou ambigus.

Commandes de validation attendues:

```bash
npm run characterize:datasets
```

Critere d'acceptation:

- aucune migration SvelteKit/Babylon/WebGPU n'est incluse dans ce jalon.
- les fixtures 30 villes sont generees de maniere reproductible;
- `World_1M` et `Europe_1M` sont documentes comme datasets de reference.
- les rapports de caracterisation sont lisibles et versionnes;
- aucun attendu scientifique futur n'est fige sans validation explicite.

Validation:

- Commande lancee: `npm run characterize:datasets`.
- Resultat: fixtures reduites generees et rapports de caracterisation produits.
- `fixture-30-world`: 30 villes, 5 arcs internes.
- `fixture-30-europe`: 30 villes, 217 arcs internes.
- `reference-world-1m`: 498 villes, 4397 arcs, 2987 arcs internes.
- `reference-europe-1m`: 49 villes, 4389 arcs, 561 arcs internes.
- Les rapports sont descriptifs uniquement et ne figent aucun attendu scientifique futur.

## M2: Migration SvelteKit Et Vite Minimale

Statut: `todo`

Objectif:

Remplacer le socle Sapper/Rollup par SvelteKit/Vite sans modifier le modele scientifique ni les algorithmes.

Attention:

Rollup porte actuellement des responsabilites applicatives qui doivent etre migrees explicitement. La migration SvelteKit/Vite n'est valide que si le jalon `M2.1` est aussi traite ou temporairement documente comme bloque.

Travail attendu:

- remplacer les scripts Sapper par des scripts SvelteKit;
- introduire Vite;
- definir une structure `src/routes` compatible SvelteKit;
- deplacer les assets publics vers `static` si necessaire;
- conserver temporairement le rendu Three.js si cela reduit le risque;
- garantir que les tests M1 continuent de passer;
- clarifier le gestionnaire de paquets.

Decision proposee:

- utiliser `pnpm`;
- supprimer `package-lock.json` seulement une fois `pnpm-lock.yaml` etabli;
- garder Three.js pendant ce jalon pour eviter une double migration.

Fichiers probablement concernes:

```text
package.json
pnpm-lock.yaml
svelte.config.js
vite.config.ts
src/routes/
src/app.html
static/
```

Commandes de validation attendues:

```bash
pnpm install
pnpm test
pnpm build
pnpm dev
```

Critere d'acceptation:

- l'application demarre en SvelteKit;
- le build production passe;
- les tests M1 passent;
- aucun changement algorithmique n'est introduit;
- l'ancien routage Sapper est retire ou neutralise proprement.
- les hooks applicatifs Rollup sont remplaces ou couverts par `M2.1`.

Validation:

- A renseigner apres implementation.

## M2.1: Evaluation Des Hooks Rollup Applicatifs

Statut: `validated`

Objectif:

Evaluer les traitements applicatifs actuellement executes par Rollup lors du passage a SvelteKit/Vite, puis ne migrer que ceux qui restent necessaires.

Principe:

- ne pas recopier les hooks Rollup par reflexe;
- utiliser les capacites natives de Vite quand elles couvrent le besoin;
- ajouter des declarations TypeScript pour les imports shader;
- conserver des scripts dedies pour les traitements qui restent applicatifs, notamment la compression des datasets.

Responsabilites historiques a evaluer:

- compilation GLSL avec `glslify`;
- validation des shaders GLSL en developpement via `node-gles`;
- suppression des commentaires et espaces inutiles des shaders;
- injection du dictionnaire de shaders via le placeholder `__SHADERS_HERE__`;
- compression des datasets depuis `datasets/` vers `static/datasets/`;
- generation de `static/datasets/datasets.json`;
- copie des assets declares dans `package.json#toCopy`;
- generation de la documentation Typedoc;
- reecriture des liens HTML de documentation;
- preparation/compression CSS historique.

Fichiers historiques concernes:

```text
rollup.config.js
rollupScripts/shaderCompiler.js
rollupScripts/zipper.js
rollupScripts/cssPreparation.js
package.json
src/application/shaders.ts
```

Architecture cible proposee:

```text
scripts/
  build-datasets.ts
  build-docs.ts
  build-static-assets.ts
  build-pre.ts
src/lib/build/
  datasetBundler.ts
src/vite-env.d.ts
```

Import shader cible possible:

```ts
import rawConesShader from './raw-cones.wgsl?raw';
```

Declaration TypeScript cible:

```ts
declare module '*.wgsl?raw' {
  const source: string;
  export default source;
}
```

Commandes cible possibles:

```bash
pnpm build:datasets
pnpm build:docs
pnpm build:assets
pnpm build:pre
```

Integration Vite/SvelteKit:

- `build:pre` doit pouvoir etre lance avant `vite build`;
- en dev, les datasets doivent etre regeneres au demarrage si l'application depend des versions compressees;
- les shaders WGSL doivent d'abord etre testes avec des imports Vite `?raw`;
- les shaders GLSL historiques doivent etre testes avec des imports Vite `?raw` si `glslify` n'est plus necessaire;
- un plugin Vite peut surveiller `datasets/**` ou les shaders uniquement si les imports natifs ne suffisent pas;
- les scripts Node doivent rester executables hors Vite pour les tests et la CI.

Compatibilite temporaire:

- tant que des passes WebGL2 existent, le pipeline GLSL doit rester fonctionnel;
- les nouveaux kernels WGSL devront etre geres par un pipeline adjacent, sans casser GLSL;
- l'injection `__SHADERS_HERE__` doit etre remplacee si possible par des imports modules explicites;
- `glslify` ne doit etre conserve que pour les shaders qui utilisent encore ses directives.
- aucun equivalent `glslify` pour WGSL ne doit etre ajoute par defaut;
- un preprocesseur WGSL ne sera evalue que si l'assemblage manuel ou les imports Vite deviennent insuffisants.
- la validation WGSL reste obligatoire et sera assuree par creation de `GPUShaderModule` puis lecture de `getCompilationInfo()`;
- une validation native Rust/wgpu/Naga sera evaluee quand le backend desktop natif sera introduit.

Alternatives datasets a evaluer:

- conserver le script de compression deflate historique;
- laisser l'hebergement appliquer gzip/brotli a des assets non precompresses;
- produire un format applicatif specifique au futur precalcul;
- permettre a Tauri de charger directement des dossiers datasets locaux.

Tests attendus:

- verifier qu'un fichier WGSL peut etre importe avec Vite et TypeScript;
- verifier qu'un shader WGSL valide compile via WebGPU;
- verifier qu'un shader WGSL invalide produit une erreur de validation lisible;
- verifier qu'un fichier GLSL historique peut etre importe ou compile selon le besoin reel;
- verifier que les declarations TypeScript couvrent les extensions shader utilisees;
- verifier que l'ancien dictionnaire global de shaders n'est plus necessaire ou qu'il a un equivalent documente;
- verifier que chaque dossier de `datasets/` produit un fichier compresse dans `static/datasets/`;
- verifier que `static/datasets/datasets.json` liste les datasets;
- verifier que l'application peut charger et inflater un dataset genere;
- verifier que les assets declares sont copies.
- documenter si la compression applicative reste necessaire ou si la compression serveur suffit.

Critere d'acceptation:

- chaque traitement Rollup historique est classe en `supprime`, `remplace par Vite`, `remplace par script`, ou `a conserver temporairement`;
- le chargement de dataset compresse fonctionne;
- le chargement des shaders fonctionne;
- les shaders WGSL sont importables avec typage TypeScript;
- les commandes sont documentees;
- les tests M1 passent toujours;
- aucun changement algorithmique n'est introduit.

Validation:

- Audit produit dans `docs/migration-build-pipeline-audit.md`.
- L'injection globale `__SHADERS_HERE__` sera remplacee par des imports modules explicites.
- Les futurs WGSL seront importes via Vite/SvelteKit avec `?raw` et declarations TypeScript.
- Aucun preprocesseur WGSL n'est retenu par defaut.
- `glslify` est conserve uniquement comme compatibilite temporaire si les GLSL historiques restent actifs.
- La compression datasets est conservee comme script applicatif separe a court terme.
- Le lint auto-fix dans le build est marque comme a supprimer.

## M3: Extraction Du Domaine Metier

Statut: `todo`

Objectif:

Rendre les calculs metier independants du renderer et du framework UI.

Travail attendu:

- extraire les types de donnees vers un module `domain`;
- extraire lecture, validation et fusion des donnees;
- extraire les fonctions geodesiques et de projection;
- supprimer les imports Three.js des modules de configuration scientifique;
- isoler les dependances navigateur;
- rendre le pipeline data executable dans les tests sans DOM.

Architecture cible:

```text
src/lib/domain/
  data/
  model/
  math/
  projection/
  config/
```

Points critiques:

- `src/application/common/configuration.ts` importe aujourd'hui des types Three.js;
- `src/application/bigBoard/merger.ts` melange donnees, calculs et effets secondaires;
- les types dans `src/application/definitions/project.ts` doivent etre conserves mais reorganises.

Critere d'acceptation:

- `domain` ne depend pas de Three.js;
- `domain` ne depend pas de Babylon.js;
- `domain` ne depend pas de SvelteKit;
- les tests M1 passent apres extraction.

Validation:

- A renseigner apres implementation.

## M4: Architecture Explicite De Precalcul

Statut: `todo`

Objectif:

Formaliser la phase qui transforme le dataset brut en entrees stables pour les calculs interactifs.

API cible:

```ts
const prepared = await prepareDataset(rawDataset, preparationOptions);
```

Sortie cible:

```ts
interface PreparedDataset {
  cities: PreparedCities;
  network: PreparedNetwork;
  speedTimeline: PreparedSpeedTimeline;
  references: PreparedReferentials;
  boundaries: PreparedBoundaries;
  staticBuffers: PreparedStaticBuffers;
  metadata: PreparedMetadata;
}
```

Travail attendu:

- definir les structures `Prepared*`;
- separer donnees stables et parametres interactifs;
- documenter quels changements invalident le precalcul;
- creer des tests sur `prepareDataset`;
- preparer les buffers qui seront consommes par WebGPU.

Changements qui relancent le precalcul:

- dataset different;
- resolution structurelle des frontieres;
- definition du voisinage;
- changement du modele de preparation des intersections;
- changement des parametres de simplification geometrique.

Changements qui ne relancent pas le precalcul:

- annee;
- projection;
- representation;
- `zCoeff`;
- affichage ou masquage des couches;
- forme interactive des cones si les donnees necessaires sont deja preparees.

Critere d'acceptation:

- la frontiere precalcul/calcul interactif est testee;
- un changement d'annee ne relance pas `prepareDataset`;
- les buffers statiques sont documentes.

Validation:

- A renseigner apres implementation.

## M5: Rendu Babylon.js Minimal

Statut: `todo`

Objectif:

Introduire Babylon.js comme renderer principal sans migrer encore tout le compute vers WebGPU.

Travail attendu:

- creer une scene Babylon;
- afficher les pays ou frontieres;
- afficher les villes;
- afficher un cone simple ou une geometrie issue du pipeline existant;
- fournir une camera et une interaction minimale;
- isoler Babylon dans `render/babylon`.

Architecture cible:

```text
src/lib/render/babylon/
  BabylonScene.ts
  CountryLayer.ts
  CityLayer.ts
  ConeLayer.ts
  CurveLayer.ts
  materials.ts
```

Critere d'acceptation:

- Babylon affiche un dataset de reference;
- le domaine ne depend pas de Babylon;
- les tests M1 a M4 passent;
- Three.js est soit encore present temporairement, soit retire uniquement des zones migrees.

Validation:

- A renseigner apres implementation.

## M6: Framework WebGPU Compute Minimal

Statut: `todo`

Objectif:

Creer le remplacement structurel de `GPUComputer`, sans encore porter tout le modele.

Decision d'architecture:

- l'implementation initiale est un backend WebGPU orchestre en TypeScript;
- les kernels sont ecrits en WGSL;
- l'API doit rester compatible avec un futur backend Rust/wgpu natif;
- le framework compute ne doit pas dependre de Babylon.js, Tauri ou SvelteKit.

Travail attendu:

- initialiser `GPUAdapter` et `GPUDevice`;
- creer une abstraction de buffers;
- creer une abstraction de kernel;
- creer un cache de pipelines;
- executer un kernel WGSL simple;
- lire les resultats CPU pour tests;
- documenter les limitations navigateur.

Architecture cible:

```text
src/lib/compute/core/
  WebGpuContext.ts
  BufferStore.ts
  Kernel.ts
  PipelineCache.ts
src/lib/compute/kernels/
  smoke.wgsl
```

Interface cible indicative:

```ts
interface ComputeBackend {
  prepareStaticBuffers(prepared: PreparedDataset): Promise<PreparedGpuResources>;
  computeFrame(input: InteractiveComputeInput): Promise<ComputedFrame>;
  dispose(): Promise<void>;
}
```

Critere d'acceptation:

- un test WebGPU simple passe quand WebGPU est disponible;
- un skip explicite existe quand WebGPU est indisponible;
- le framework compute ne depend pas de Babylon;
- le framework compute ne depend pas de SvelteKit.
- l'API ne bloque pas l'ajout futur d'un backend Rust/wgpu.

Validation:

- A renseigner apres implementation.

## M7: Portage WGSL Des Passes Existantes

Statut: `todo`

Objectif:

Porter les calculs intensifs historiques GLSL/WebGL2 vers WebGPU/WGSL.

Passes prioritaires:

- generation des cones;
- generation des courbes;
- conversion de projection;
- limites geographiques;
- clipping.

Travail attendu:

- traduire les fonctions GLSL communes en WGSL;
- remplacer les textures de donnees par des storage buffers;
- expliciter les uniforms dans des structs WGSL;
- ajouter des tests de comparaison avec les snapshots M1;
- mesurer les performances.

Critere d'acceptation:

- les sorties WGSL correspondent aux sorties historiques dans les tolerances definies;
- les passes interactives peuvent etre lancees sans reconstruire le precalcul;
- les readbacks CPU ne sont utilises que pour tests/debug.

Validation:

- A renseigner apres implementation.

## M8: Nouveau Pipeline D'Intersections

Statut: `todo`

Objectif:

Ameliorer les intersections entre cones et les decoupes par limites.

Travail attendu:

- formaliser les cas geometriques simples;
- distinguer intersection cone/cone et clipping frontieres;
- construire un index spatial exploitable par WebGPU;
- definir les buffers necessaires;
- implementer une premiere passe d'intersection robuste;
- comparer visuellement et numeriquement.

Cas tests minimum:

- deux villes isolees avec cones simples;
- trois villes formant un triangle;
- villes proches avec vitesses tres differentes;
- ville proche d'une frontiere;
- polygone avec concavite;
- changement de resolution sans rupture topologique majeure.

Critere d'acceptation:

- les artefacts historiques identifies diminuent;
- la stabilite est meilleure quand la resolution varie;
- les performances restent compatibles avec l'interaction.

Validation:

- A renseigner apres implementation.

## M9: Integration Interactive Complete

Statut: `todo`

Objectif:

Relier SvelteKit, precalcul, WebGPU compute et Babylon.js en une application interactive coherente.

Perimetre:

- ce jalon vise d'abord l'application web;
- le client lourd Tauri est traite dans `M9.1`;
- l'interface doit toutefois deja rester compatible avec un build statique embarquable.

Travail attendu:

- charger un dataset;
- lancer le precalcul une seule fois;
- changer l'annee sans relancer le precalcul;
- changer la representation sans relancer le precalcul;
- mettre a jour les buffers Babylon;
- afficher les temps CPU/GPU en mode debug;
- gerer les erreurs WebGPU.

Critere d'acceptation:

- le changement d'annee est interactif;
- le changement de representation est interactif;
- les couches peuvent etre affichees/masquees;
- les tests et le build passent.
- le build frontend peut etre produit sous forme statique ou embarquable.

Validation:

- A renseigner apres implementation.

## M9.1: Packaging Client Lourd Tauri

Statut: `todo`

Objectif:

Produire un client lourd Linux/Windows en reutilisant l'interface SvelteKit et le pipeline de calcul existant.

Decision d'architecture:

```text
Frontend commun:
  SvelteKit

Desktop shell:
  Tauri

Backend desktop:
  Rust pour acces systeme, fichiers, exports, packaging

Compute initial:
  WebGPU via frontend/webview si disponible

Compute futur possible:
  Rust/wgpu natif derriere la meme interface ComputeBackend
```

Travail attendu:

- ajouter la configuration Tauri;
- verifier que le build SvelteKit peut etre embarque;
- definir les commandes Rust minimales;
- gerer l'acces aux fichiers locaux;
- tester le chargement de datasets locaux;
- tester les exports;
- documenter les limitations WebGPU des webviews Linux/Windows;
- definir la strategie de fallback si WebGPU est indisponible dans la webview.

Fichiers attendus:

```text
src-tauri/
  Cargo.toml
  tauri.conf.json
  src/
    main.rs
```

Commandes attendues:

```bash
pnpm tauri dev
pnpm tauri build
```

Critere d'acceptation:

- l'application desktop se lance sous Linux;
- la configuration Windows est preparee;
- le frontend est le meme que l'application web;
- les datasets peuvent etre charges;
- les exports ou acces fichiers essentiels passent par Tauri/Rust;
- les limitations WebGPU desktop sont documentees.

Validation:

- A renseigner apres implementation.

## M10: Stabilisation Et Documentation Finale

Statut: `todo`

Objectif:

Nettoyer la dette residuelle et rendre la migration maintenable.

Travail attendu:

- supprimer le code mort Three.js si le portage est termine;
- supprimer l'ancien `GPUComputer` si WebGPU couvre les besoins;
- documenter l'architecture finale;
- documenter l'utilisation;
- documenter les limitations;
- documenter les benchmarks;
- preparer une PR propre.

Critere d'acceptation:

- documentation developpeur a jour;
- documentation utilisateur a jour;
- tests verts;
- build vert;
- risques restants documentes.

Validation:

- A renseigner apres implementation.

## Journal Des Jalons

Ajouter une entree a chaque validation:

```text
YYYY-MM-DD - Mx - validated - commit <hash> - resume court
```

Entrees:

- 2026-06-03 - M0 - validated - commit `99957ab` - branche durable et roadmap initiale creees.
