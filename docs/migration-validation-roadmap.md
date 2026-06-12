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
- La strategie de tests est documentee dans `docs/migration-test-strategy.md` et guide les validations de jalons.
- Le moteur de calcul est organise en trois profils obligatoires:
  `WebGPU -> WebGL2 -> CPU`.
  `WebGPU` est la cible de production, `WebGL2` le fallback accelere et `CPU`
  la reference fonctionnelle et l'oracle de tests.
- Le profil `CPU` doit rester disponible en permanence et peut toujours etre
  force.
- Le profil `WebGL2` doit pouvoir etre force lorsqu'il est disponible, avec un
  repli explicite vers `CPU` si besoin.
- Le framework compute doit pouvoir etre active des l'ingestion CSV/GeoJSON
  jusqu'aux precomputes derives afin de mesurer chaque etape sur tous les
  profils disponibles.
- La cible de runner pour la migration est `Vitest` pour les tests unitaires,
  d'integration et de conformance CPU, avec `Playwright` pour les tests E2E et
  de rendu.
- La suite Playwright doit exposer au moins un smoke test de chargement
  applicatif avant validation de l'integration interactive complete.
- Les routes `src/routes/test/test1`, `test2` et `test3` sont les pages de
  validation interactives officielles de la migration.
- Toute nouvelle page de validation doit etre justifiee par jalon et ne doit
  etre creee que si `test1/test2/test3`, les tests automatises, les benchmarks
  et les diagnostics structures ne suffisent pas.
- Toute passe WebGPU critique doit avoir une reference CPU ou une justification documentee.
- L'interface utilisateur commune reste SvelteKit.
- Les kernels GPU intensifs sont ecrits en WGSL portable.
- Le client lourd cible Tauri, sans reecriture initiale complete en Rust.
- Le backend Rust/wgpu natif reste une extension possible, pas une dependance du premier portage.

## Vue D'Ensemble Des Jalons

| Jalon | Statut | Objectif |
| --- | --- | --- |
| M0 | validated | Branche propre et documentation initiale |
| M1 | validated | Caracterisation initiale et fixtures |
| M2 | validated | Migration SvelteKit/Vite minimale |
| M2.1 | validated | Evaluation des hooks Rollup applicatifs |
| M3 | validated | Extraction du domaine metier |
| M3.1 | validated | Inspection dataset et assemblage lossless du reseau |
| M4 | validated | Architecture explicite de precalcul |
| M4.1 | validated | Socle de tests CPU et contrats de buffers |
| M5 | deferred | Prototype comparatif de rendu Babylon.js / luma.gl |
| M6 | in_progress | Framework compute multi-profil et fallback WebGPU -> WebGL2 -> CPU |
| M7 | in_progress | Portage WGSL / backend WebGPU des passes existantes |
| M8 | in_progress | Nouveau pipeline d'intersections |
| M9.0 | in_progress | Modularisation UI en deux pans (workspace / app) |
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
- fixtures fictives ou reduites generees a partir des 30 premieres villes du fichier classe `cities` par inspection de schema.

Strategie de fixtures reduites:

- pour chaque dataset source utile, prendre les 30 premieres villes du fichier classe `cities`;
- conserver le header CSV;
- filtrer toutes les tables `cityLinkedAttributes` sur les `cityCode` conserves;
- filtrer le fichier classe `transportNetwork` pour ne garder que les arcs dont `cityCodeOri` et `cityCodeDes` appartiennent aux villes conservees;
- conserver les fichiers classes `transportModes` et `transportModeSpeeds` tels quels;
- conserver les GeoJSON sources pour les premiers tests data;
- creer plus tard un GeoJSON artificiel minimal pour les tests geometriques analytiques.

Datasets de test proposes pour M1:

- `fixture-30-world`: derive de `datasets/World_1M` avec les 30 premieres villes;
- `fixture-30-europe`: derive de `datasets/Europe_1M` avec les 30 premieres villes;
- `reference-world-1m`: utilise `datasets/World_1M` tel quel pour un test plus large;
- `reference-europe-1m`: utilise `datasets/Europe_1M` tel quel pour un test europeen rapide.

Sorties a observer, sans les figer comme attendus definitifs:

- nombre de villes;
- nombre de tables d'enrichissement ville et de lignes rattachees;
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

- detecter automatiquement les fichiers par inspection de schema, sans dependance aux noms;
- extraire les 30 premieres villes;
- filtrer les enrichissements ville et le reseau de transport;
- copier modes, vitesses et GeoJSON detectes;
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

Statut: `validated`

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

- conserver `npm` temporairement pour ne pas coupler la migration SvelteKit a une migration de gestionnaire de paquets;
- versionner `package-lock.json` pour rendre l'installation reproductible;
- garder le code Three.js legacy present mais non raccorde au shell SvelteKit minimal, pour eviter une double migration.

Fichiers probablement concernes:

```text
package.json
package-lock.json
svelte.config.js
vite.config.ts
src/routes/
src/app.html
static/
```

Commandes de validation attendues:

```bash
npm install
npm run characterize:datasets
npm run build
npm run validate
```

Critere d'acceptation:

- l'application demarre en SvelteKit;
- le build production passe;
- les tests M1 passent;
- aucun changement algorithmique n'est introduit;
- l'ancien routage Sapper est retire ou neutralise proprement;
- les hooks applicatifs Rollup sont remplaces ou couverts par `M2.1`.

Validation:

- `npm install` execute avec resolution des dependances SvelteKit/Vite.
- `npm run build` valide:
  - generation des datasets compresses via `scripts/build-datasets.mjs`;
  - import d'un fichier WGSL via Vite avec `?raw`;
  - build statique SvelteKit via `@sveltejs/adapter-static`.
- `src/service-worker.ts` Sapper a ete supprime pour eviter la dependance obsolete `@sapper/service-worker`.
- `npm run validate` reste rouge: `svelte-check` remonte 233 erreurs et 10 warnings dans le code legacy Sapper/Three encore present.
- Ces erreurs ne bloquent pas M2 parce que le shell SvelteKit minimal ne depend pas encore de ce code legacy. Elles doivent etre traitees par suppression ou portage progressif pendant M3-M8, pas masquees par un assouplissement TypeScript global.
- Verification ulterieure sur le worktree de migration:
  - `npm run build` passe;
  - `npm run validate` passe;
  - `npm run test:e2e` passe apres correction du `webServer` Playwright via
    `--configLoader runner` et fallback explicite sur le Chromium systeme
    disponible.

Resultat:

- M2 valide sur le critere build applicatif.
- Dette explicitement ouverte: validation stricte du code legacy non portee.
- Le smoke E2E Playwright n'est plus une reserve ouverte sur ce worktree.

Mise a jour npm:

- Les dependances npm ont ete montees vers leurs versions courantes resolues par `npm install`.
- `rollup-plugin-terser` a ete remplace par `@rollup/plugin-terser`, car l'ancien paquet ne supporte pas Rollup 4.
- `node-gles` a ete supprime: la validation WebGL legacy ne fait plus partie du chemin SvelteKit/Vite.
- `showdown` a ete supprime: le routage Markdown Sapper legacy devra etre porte avec un choix de parseur separe.
- `@sveltejs/kit` et `@sveltejs/adapter-static` ont ete restaures sur la ligne SvelteKit 2 apres resolution npm.
- Validations apres mise a jour:
  - compilation TypeScript ciblee de `src/lib/domain/data/*.ts`;
  - `npm run characterize:datasets`;
  - `npm run build`.
- L'audit npm restant signale uniquement une vulnerabilite basse via `cookie@0.6.0`, dependance transitive de SvelteKit 2. La correction automatique propose une retrogradation incorrecte vers SvelteKit `0.0.30`; elle est donc refusee.
- L'audit est stoppe a ce stade pour poursuivre la migration fonctionnelle.

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

## M3.1: Inspection Dataset Et Assemblage Lossless Du Reseau

Statut: `validated`

Objectif:

Remplacer la detection fragile des fichiers par nom et preparer une aggregation de donnees robuste, lossless et requetable.

Note de cadrage:

- les briques d'inspection, d'assemblage et de preparation sont validees comme
  pipeline de domaine independant;
- le branchement du nouveau pipeline dans l'application interactive appartient
  aux jalons d'extraction et d'integration suivants;
- la validation M3.1 ne signifie pas que le `Merger` historique est deja
  supprime.
- `src/routes/test/test1/+page.svelte` est la page d'inspection interactive
  rattachee a ce jalon pour charger un dataset compresse et afficher
  inspection, manifest, `BaseNetwork`, `PreparedDataset` et diagnostics.

Contrat dataset:

- le type d'un fichier est determine uniquement par la presence de colonnes caracteristiques;
- les fichiers peuvent contenir des colonnes supplementaires libres;
- les colonnes supplementaires ne sont pas contractualisees;
- le coeur applicatif ne doit presumer ni le nom, ni le type metier, ni l'unite des colonnes non caracteristiques;
- toutes les colonnes sources doivent etre conservees dans le reseau resultat;
- les colonnes libres sont exposees pour requetes utilisateur via un mapping semantique explicite.
- un fichier CSV non reconnu comme type primaire mais contenant `cityCode` est une table d'enrichissement rattachee aux villes.

Colonnes caracteristiques minimales a confirmer:

```text
cities:
  cityCode
  latitude
  longitude
  radius

transportNetwork:
  cityCodeOri
  cityCodeDes
  transportModeCode

transportModes:
  code
  name
  terrestrial

transportModeSpeeds:
  transportModeCode
  year
  speedKPH
```

Tables d'enrichissement rattachees aux villes:

- signature minimale: `cityCode`;
- classification appliquee seulement si le fichier ne correspond pas deja a un type primaire plus specifique;
- multiplicite: plusieurs fichiers d'enrichissement peuvent exister dans un meme dataset;
- chaque ligne est associee a la ville de meme `cityCode`;
- les lignes dont le `cityCode` ne correspond a aucune ville sont conservees dans les diagnostics;
- ces fichiers ne sont pas obligatoires pour construire le reseau de transport de base;
- le fichier historiquement appele `population.csv` est un cas particulier de cette famille, pas un contrat population global.

Contrainte d'ordre:

- l'ordre d'arrivee des fichiers est inconnu et ne doit jamais influencer le resultat;
- le pipeline doit d'abord collecter tous les fichiers, puis inspecter le dataset complet;
- aucune jointure ni aucun parsing complet ne doit commencer avant la resolution globale du manifest;
- le meme dataset doit donner le meme manifest et le meme reseau, que les fichiers arrivent par drag and drop, archive, dossier local, ordre alphabetique ou ordre aleatoire.

Mecanisme propose:

1. `DatasetInspection`
   - lit chaque fichier brut;
   - extrait les en-tetes sans presumer du nom du fichier;
   - compare les en-tetes aux signatures de colonnes caracteristiques;
   - applique les signatures du plus specifique au plus generique;
   - classe en table d'enrichissement ville tout CSV restant qui possede `cityCode`;
   - produit un rapport de classification, d'ambiguite et d'erreurs.

2. `DatasetManifestResolution`
   - choisit les fichiers primaires requis;
   - verifie l'unicite des fichiers primaires;
   - regroupe les fichiers optionnels;
   - conserve les fichiers inconnus et ambigus dans les diagnostics;
   - echoue avant assemblage si le manifest est incomplet ou contradictoire.

3. `DatasetParsing`
   - parse chaque fichier classifie;
   - conserve chaque ligne source complete dans `raw`;
   - extrait les champs caracteristiques dans une vue typee minimale;
   - conserve les champs libres dans `extra` sans interpretation metier.

4. `BaseNetworkAssembly`
   - construit des index immuables par identifiants caracteristiques;
   - relie les fichiers par index, pas par mutation de tables;
   - conserve les relations sous forme d'adjacence et de references stables;
   - rattache les tables d'enrichissement aux villes via `cityCode`;
   - produit un catalogue de champs requetables;
   - produit des diagnostics sur references manquantes, doublons, types invalides et arcs orphelins.

Forme cible indicative:

```ts
interface BaseNetwork {
  cities: BaseCity[];
  edges: BaseEdge[];
  transportModes: BaseTransportMode[];
  indexes: BaseNetworkIndexes;
  fields: QueryableFieldCatalog;
  diagnostics: DatasetAssemblyDiagnostics;
}

interface BaseCity {
  id: number;
  characteristic: {
    cityCode: number;
    latitudeRadians: number;
    longitudeRadians: number;
    radiusMeters: number;
  };
  raw: Record<string, unknown>;
  linkedRecords: Record<string, SourceRecord[]>;
  inEdgeIds: number[];
  outEdgeIds: number[];
}
```

Requetes utilisateur:

Les requetes de type "trouve les villes qui ont plus de X habitants en 1950 et une surface superieure a 10 km2" ne doivent pas dependre de noms imposes dans le coeur.

Le flux cible est:

- le systeme decouvre les champs disponibles;
- l'utilisateur ou un profil associe un champ source libre a un sens applicatif;
- la requete utilise ce mapping semantique;
- le moteur filtre le reseau enrichi sans supposer le nom original de la colonne.

Critere d'acceptation:

- les scripts ne dependent plus de `cities*.csv`, `population*.csv` ou `transport_network*.csv`;
- les fixtures M1 sont regenerees par detection de schema;
- les rapports de caracterisation indiquent les fichiers detectes par type et les colonnes libres;
- aucune colonne source n'est perdue pendant l'assemblage;
- les fichiers CSV contenant seulement `cityCode` comme colonne de liaison sont rattaches aux villes comme enrichissements;
- l'assemblage produit un reseau de base avec index et diagnostics;
- aucune logique metier ne reference une colonne non caracteristique par nom impose.

Validation:

- Implementation:
  - `src/lib/domain/data/inspection.ts` porte l'inspection par schema et la resolution de manifest;
  - `src/lib/domain/data/assembly.ts` porte l'assemblage lossless du reseau de base;
  - `scripts/dataset-files.ts` fournit l'adaptateur fichier Node vers le module de domaine;
  - `scripts/create-reduced-dataset-fixtures.ts` ne depend plus des noms de fichiers;
  - `scripts/characterize-datasets.ts` ne depend plus des noms de fichiers;
  - les anciens prototypes `scripts/dataset-inspection.mjs` et `scripts/dataset-assembly.mjs` sont supprimes pour eviter une double implementation;
  - les CSV non primaires contenant `cityCode` sont traites comme `cityLinkedAttributes`;
  - les rapports de caracterisation exposent les fichiers detectes, colonnes libres, index et diagnostics d'assemblage;
  - l'assembleur accepte une liste `{ name, text }[]`, donc il peut recevoir les fichiers dans un ordre non determine.
- Validations executees:
  - `npm run characterize:datasets`;
  - `npm run test:integration`;
  - `npm test`;
  - `./node_modules/.bin/tsc --noEmit --ignoreConfig --strict --allowJs --moduleResolution bundler --module esnext --target es2022 scripts/*.ts src/lib/domain/data/*.ts`;
  - `npm run build`.
- Tests d'integration automatises:
  - chaine complete `SourceFile[] -> DatasetManifest -> BaseNetwork -> PreparedDataset`;
  - egalite du manifest, du reseau lossless et des buffers prepares lorsque
    l'ordre des fichiers est inverse;
  - fixture analytique avec colonnes libres, enrichissement orphelin, arête
    non resolue et fichier inconnu;
  - fixtures reduites Europe et Monde;
  - manifests incomplets, fichiers primaires multiples, schema ambigu et nom
    de fichier source duplique;
  - diagnostics de valeurs invalides, identifiants dupliques et references
    metier absentes.
- Diagnostics observes:
  - les datasets complets contiennent des arcs references vers des villes absentes du sous-ensemble de villes charge;
  - `population.csv` est correctement rattache comme `cityLinkedAttributes`, avec lignes orphelines conservees en diagnostics;
  - `datasets/World_1M/transport_mode_speed_v05.csv` contient quelques lignes historiques mal formees ou commentees dans des champs numeriques; elles sont conservees en source et signalees par diagnostics;
  - les valeurs numeriques caracteristiques invalides sans valeur exploitable sont normalisees a `null` dans les rapports JSON.
- Limite volontaire:
  - le nouveau reseau de base n'est pas encore branche dans l'application interactive;
  - `Merger` historique reste le chemin applicatif jusqu'au jalon d'extraction/portage suivant.

### Sous-ensemble Valide: Preparation Des Vitesses

Objectif:

Porter les fonctions historiques suivantes sans muter `BaseNetwork`:

- `identifyingRoadMode`;
- `historicalTimeSpan`;
- `setSpeedDatas`.

Implementation:

- `src/lib/domain/data/preparation.ts`;
- `src/lib/domain/data/types.ts`;
- `tests/unit/data/preparation.test.ts`.

Regles validees:

- le mode `Road` est obligatoire et unique;
- la recherche de `Road` est insensible a la casse et aux espaces;
- l'absence ou la multiplicite de `Road` emet un diagnostic bloquant;
- `Road` doit etre terrestre;
- les vitesses source `speedKPH` sont conservees dans `SourceRecord`;
- les vitesses preparees sont converties en metres par seconde;
- les angles `alpha` sont exprimes en radians;
- la periode historique suit la logique differentielle: les modes non-road definissent la periode, puis `Road` la contraint;
- `BaseNetwork` reste lossless et n'est pas mute.

Validations executees:

- `npm test`;
- `./node_modules/.bin/tsc --noEmit --ignoreConfig --strict --moduleResolution bundler --module esnext --target es2022 src/lib/domain/data/*.ts src/lib/shared/*.ts`.

Limites restantes hors M3.1:

- brancher le pipeline de domaine dans l'application interactive;
- retirer progressivement les consommateurs du `Merger` historique;
- ajouter le moteur de mapping semantique et de requetes utilisateur.

Orientation validee pour le precalcul statique des villes:

- trois profils `CPU`, `WebGL2` et `WebGPU` implementeront le meme contrat de
  buffers;
- la chaine de repli sera `WebGPU -> WebGL2 -> CPU`;
- le profil CPU restera la reference fonctionnelle, le dernier fallback et l'oracle
  des tests de conformite;
- les buffers compacts seront la source de verite, exposes par des vues et
  getters sans duplication des donnees;
- `cityNed2EcefMatrices` regroupera position ECEF et repere NED par ville;
- les invariants des paires contiendront azimuts, distance angulaire et index
  de secteur;
- les reductions de voisinage reproduiront initialement la strategie
  historique avant toute evolution algorithmique;
- les controles de courbes `[A, P, Q, B]` seront calcules uniquement pour les
  arêtes connues via `curveEdgePairs`, en `O(E)`;
- le contrat detaille est documente dans
  `docs/static-town-precompute-architecture.md`.

Implementation commencee:

- `src/lib/domain/data/prepared-dataset.ts` construit le chaînon compact
  `BaseNetwork -> PreparedDataset`, convertit les coordonnees en radians,
  preserve les ids de tracabilite et exclut les arêtes non resolues uniquement
  des buffers de calcul;
- `PreparedDataset.curveEdgePairs` contient toutes les arêtes connues hors mode
  `Road`, dans l'ordre des arêtes preparees, y compris les doublons metier;
- `src/lib/domain/data/prepared-views.ts` fournit des vues legeres sur les
  villes et arêtes compactes sans recopier les colonnes libres du reseau
  lossless;
- `src/lib/domain/precompute/types.ts` definit les premiers contrats et strides;
- `src/lib/domain/precompute/cpu/static-town-cpu.ts` implemente la reference CPU
  des invariants par ville et par paire ordonnee;
- `src/lib/domain/precompute/backend.ts` formalise le contrat commun et la
  chaine de repli `WebGPU -> WebGL2 -> CPU`;
- `src/lib/domain/precompute/benchmark.ts` definit les rapports comparables par
  phase et globalement, et instrumente le profil CPU;
- `src/lib/domain/precompute/views.ts` fournit les premieres vues legeres sur
  les buffers partages;
- `src/lib/domain/precompute/cpu/overlap-cpu.ts` reproduit la selection historique
  des voisins par secteur, la redistribution des quotas et l'ordre final par
  azimut, sans dupliquer les invariants de paires;
- `src/lib/domain/precompute/cpu/curve-cpu.ts` construit `curveEdgePairs` et les
  controles `[A, P, Q, B]` uniquement pour les arêtes connues, en ECEF metres;
- `tests/unit/precompute/static-town-cpu.test.ts` caracterise l'ordre stable,
  les unites SI, les azimuts, distances, secteurs, paires diagonales et
  reductions de voisinage, ainsi que les controles de courbes;
- les arêtes antipodales sont rejetees tant qu'une regle metier ne definit pas
  le grand cercle a utiliser;
- `PreparedDataset` alimente le profil statique CPU sans copie de ses buffers
  villes et courbes;
- seul le profil CPU est implemente a ce stade;
- les backends WebGL2/WebGPU restent a implementer apres stabilisation du
  pipeline CPU.

Decision validee pour le precalcul dynamique annuel:

- le contrat scientifique de `alpha` est documente dans
  `docs/scientific-model-alpha-and-dynamic-cones.md`;
- `alpha = atan(sqrt((maximumSpeed / ambientSpeed)^2 - 1))`;
- une vitesse plus elevee produit un alpha plus faible et un cone plus plat;
- `Road` definit `roadAlpha`, pente par defaut de la surface;
- entre plusieurs modes terrestres actifs vers une meme destination, conserver
  le minimum alpha;
- une liaison plus lente que Road ne doit pas augmenter alpha au-dela de
  `roadAlpha`;
- les arêtes sont traitees comme bidirectionnelles;
- les bornes historiques `citiesDict` sont remplacees par `offset + count`;
- les trois variantes a alimenter sont le cone Road, le cone regulier selon la
  meilleure connexion terrestre et le cone complexe par direction.

Implementation CPU du precalcul dynamique annuel:

- `PreparedDataset` porte maintenant les periodes inclusives de chaque arête
  dans deux `Int32Array`, avec sentinelles explicites pour les bornes absentes;
- `src/lib/domain/precompute/cpu/dynamic-town-cpu.ts` implemente la production
  annuelle et la production du span complet;
- les sorties utilisent `offset + count`, des tableaux separes et aucun trou;
- `DynamicCityLinksView` fournit des getters sans recopier les buffers;
- le benchmark CPU compare le cout d'une annee et celui du span complet;
- les tests couvrent les periodes inclusives, les deux directions,
  l'exclusion Road/courbes, le minimum alpha, le tri et les offsets.

Implementation CPU de la generation des cones bruts:

- `src/lib/domain/precompute/cpu/raw-cone-cpu.ts` formalise la reference des trois
  formes `road`, `fastest-terrestrial` et `complex`;
- la loi complexe reprend les voisins circulaires, l'atténuation vers Road et
  l'interpolation `smoothstep` prevues par `rawCones.frag`;
- les alphas directionnels et le bord ECEF sont deux sorties distinctes;
- le sommet n'est pas replique dans le bord puisqu'il est porte par la matrice
  NED vers ECEF;
- la tolerance angulaire Float32 partagee fixe les comparaisons aux bornes;
- tests, vues legeres, benchmark et schema PlantUML francais sont fournis.

## M3: Extraction Du Domaine Metier

Statut: `validated`

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
src/lib/application/
  validation/
src/lib/domain/
  data/
  model/
  math/
  projection/
  config/
```

Implementation initiale:

```text
src/lib/domain/data/
  types.ts
  csv.ts
  inspection.ts
  assembly.ts
  index.ts
```

Contraintes de code:

- les exports publics doivent etre documentes pour TypeDoc;
- le parseur CSV utilise PapaParse via un wrapper de domaine;
- `dynamicTyping` reste desactive pour conserver les valeurs source;
- les conversions typées restent dans l'assemblage avec diagnostics;
- le module `domain/data` reste independant de SvelteKit, Three.js, Babylon.js, WebGPU et du DOM.

Points critiques:

- `src/application/common/configuration.ts` importe aujourd'hui des types Three.js;
- `src/application/bigBoard/merger.ts` melange donnees, calculs et effets secondaires;
- les types dans `src/application/definitions/project.ts` doivent etre conserves mais reorganises.
- les interfaces de `toBabylon` dans `/home/abdou/workspace/shriveling_world/src/application/merger/index.d.ts` doivent servir de reference pour les types de domaine.

Reference `toBabylon` a conserver:

- `ICity`, `IEdge`, `ITranspMode`, `ITransportModeSpeed` pour les entites sources typables;
- `IStaticTownHelper` et `IDynamicTownPreGeometry` pour la separation statique/dynamique du precalcul;
- `ILookupCurvesAndCityGraph` pour comparer le comportement historique pendant le portage;
- `IMergerData` comme inspiration du conteneur prepare, pas comme sortie directe de `BaseNetworkAssembly`.

Critere d'acceptation:

- `domain` ne depend pas de Three.js;
- `domain` ne depend pas de Babylon.js;
- `domain` ne depend pas de SvelteKit;
- les nouveaux types documentent explicitement leur correspondance avec les interfaces `toBabylon`;
- les tests M1 passent apres extraction.

Validation:

- Implementation:
  - `src/lib/domain/data/types.ts`, `csv.ts`, `inspection.ts`, `assembly.ts` et `index.ts` crees;
  - code documente pour TypeDoc;
  - PapaParse retenu comme parseur CSV du domaine.
  - orchestration applicative extraite dans
    `src/lib/application/validation/datasets.ts`;
  - `src/routes/test/+layout.ts`, `test1`, `test2` et `test3` consomment
    desormais le domaine via cette couche applicative au lieu d'un helper sous
    `src/lib/testing`.
  - un `workspace` applicatif commun a ete ajoute dans
    `src/lib/application/workspace/`;
  - `src/routes/+layout.ts` charge desormais le catalogue datasets partage pour
    les ecrans applicatifs futurs;
  - `src/routes/+page.svelte` n'est plus un simple smoke shell et consomme ce
    `workspace` commun pour charger un dataset et exposer son resume.
  - une premiere route applicative non `test`, `src/routes/workspace/+page.svelte`,
    expose le dataset comme objet metier avec ses modes, villes, champs
    requetables et diagnostics;
  - la vue des diagnostics compute de `/workspace` dispose maintenant d'un
    filtrage par profil (`cpu`, `webgl2`, `webgpu`) et d'un affichage plus
    lisible des messages runtime;
  - des selecteurs de synthese metier ont ete ajoutes au `workspace`
    applicatif pour eviter de reconstruire ces vues dans chaque ecran.
  - l'architecture du futur moteur de requetes a ete fixee dans
    `docs/query-engine-architecture.md`:
    AST explicite, evaluation pure, execution parallele dans un `Worker`, et
    compatibilite UX avec l'arbre de requete de `VoitureBDD2`.
  - le moteur de requetes AST est maintenant implemente dans
    `src/lib/domain/query/`;
  - un snapshot de requete serialisable par ville et un executeur applicatif
    `Worker` ont ete ajoutes dans `src/lib/application/query/` et
    `src/lib/workers/city-query.worker.ts`.
  - l'IHM cible du moteur de requetes doit exposer dans `/workspace` un arbre
    visuel recursif, lisible par un humain, permettant d'ajouter, supprimer et
    imbriquer des groupes et filtres sans manipuler directement le format AST;
    la roadmap de l'IHM doit garder ce modele comme reference pour les futurs
    ecrans metier.
  - un premier editeur interactif de cet arbre est branche dans
    `src/routes/workspace/+page.svelte` via `src/lib/components/query/QueryNodeEditor.svelte`;
    il permet de modifier la structure AST, de reordonner les noeuds,
    de relancer l'execution dans le `Worker` et d'afficher les diagnostics et
    resultats de requete dans l'interface.
  - le requeteur AST est considere comme suffisamment mature pour le stade
    actuel et n'est plus un point bloquant du jalon M3.
- Validations executees:
  - compilation TypeScript ciblee des fichiers `src/lib/domain/data/*.ts`;
  - `npm run build`.
- Verification ulterieure sur le worktree de migration:
  - `tests/integration/data-pipeline.test.ts` passe;
  - `npm test`, `npm run test:integration`, `npm run build` et
    `npm run validate` passent apres extraction de l'orchestration applicative
    et ajout de la route `/workspace`;
  - les tests unitaires couvrent maintenant l'evaluation de l'AST, la
    construction du snapshot de requete et l'execution worker serialisable;
  - `npm run test:e2e` passe apres branchement du `workspace` partage sur le
    shell racine et les routes de validation;
  - la dette de couplage legacy ne porte plus sur `M3`; elle est traitee par
    les jalons suivants de precalcul et d'integration interactive.

## M4: Architecture Explicite De Precalcul

Statut: `validated`

Objectif:

Formaliser la phase qui transforme le dataset brut en entrees stables pour les calculs interactifs.

Analyse de reference:

- `docs/precompute-dataflow-cpu-gpu.md` decrit le cheminement des donnees,
  les responsabilites CPU/GPU/renderer et les entrees/sorties de chaque phase.

API cible:

```ts
const prepared = await prepareDataset(rawDataset, preparationOptions);
```

Sortie cible:

```ts
interface PreparedDataset {
  baseNetwork: BaseNetwork;
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
- s'inspirer de `IMergerData` sans melanger donnees sources lossless et donnees preparees;
- positionner `IStaticTownHelper` comme reference pour les donnees statiques;
- positionner `IDynamicTownPreGeometry` comme reference pour les donnees dynamiques par annee;
- positionner `geojson2preVertex.ts` comme reference pour la preparation des pays et des limites de cones;
- conserver le maillage interne des pays pour le rendu 3D;
- separer donnees stables et parametres interactifs;
- documenter quels changements invalident le precalcul;
- creer des tests sur `prepareDataset`;
- preparer les buffers qui seront consommes par WebGPU.

Travail deja realise:

- `prepareDataset` produit un `PreparedDataset` compact, stable et independant de l'annee;
- `src/lib/compute/core/invalidation.ts` formalise le diff des options de
  workflow et la granularite d'invalidation des tranches de calcul;
- la couche applicative `src/lib/application/workspace/precompute.ts` expose un helper
  qui opere uniquement sur un `DatasetWorkspaceSnapshot` deja prepare;
- le helper `runDatasetWorkspacePrecompute` reutilise le snapshot prepare et ne
  remonte que les tranches de precalcul dependantes de l'annee ou des options;
- `src/lib/application/workspace/invalidation.ts` adapte le diff compute core
  aux requetes issues du workspace;
- `tests/unit/application/workspace-precompute.test.ts` caracterise la reuse
  du snapshot prepare et la variation isolee de la tranche annuelle.
- `tests/unit/application/workspace-invalidation.test.ts` verrouille la
  classification des changements qui impactent ou non les differentes tranches
  de precompute.

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

Changements de requete qui ne relancent jamais `prepareDataset`:

- changement d'annee;
- changement de `boundaryAzimuthSampleCount` seulement: invalide la tranche
  GeoJSON et la geometrie finale, pas le dataset prepare;
- changement de `sectorCount` ou `neighborLimit`: invalide la tranche
  `staticTown`, puis les tranches aval, mais pas le dataset prepare;
- changement de `shape`, `azimuthSampleCount`, `coneLengthMeters` ou
  `attenuationRadians`: invalide `rawCones` et les tranches aval, mais pas le
  dataset prepare.

Critere d'acceptation:

- la frontiere precalcul/calcul interactif est testee;
- un changement d'annee ne relance pas `prepareDataset`;
- les buffers statiques sont documentes.

Validation:

- Premier jalon GeoJSON:
  - `src/lib/shared/constants.ts`;
  - `src/lib/shared/vector3.ts`;
  - `src/lib/shared/spherical.ts`;
  - `src/lib/domain/geojson/types.ts`;
  - `src/lib/domain/geojson/geometry.ts`;
  - `src/lib/domain/geojson/precompute.ts`;
  - `src/lib/domain/geojson/boundary-raycast.ts`;
  - `src/lib/domain/geojson/index.ts`.
- Validations executees:
  - `./node_modules/.bin/tsc --noEmit --ignoreConfig --strict --moduleResolution bundler --module esnext --target es2022 src/lib/shared/*.ts src/lib/domain/data/*.ts src/lib/domain/geojson/*.ts`;
  - caracterisation en memoire sur un GeoJSON carre avec une ville dedans et une ville dehors;
  - caracterisation en memoire du raycast CPU sur un GeoJSON carre avec une ville interne et quatre intervalles d'azimut valides;
  - caracterisation de `cityContourIndexes` avec un `cityId` different de l'ordre de ville pour verifier que les matrices `NED2ECEF` et les index de contours partagent le meme ordre.
- Decisions validees pour le remplacement de `boundaryAlgebre.frag`:
  - toutes les coordonnees angulaires internes sont en radians;
  - les distances internes sont en metres;
  - `u_towns` ne sera pas reconduit comme buffer `[longitude, latitude, countryIndex]`;
  - la position et le repere local de chaque ville seront portes par un buffer `cityNed2EcefMatrices` calcule par WebGPU et ordonne selon la sortie de l'ingestion CSV;
  - l'association ville -> contour sera portee par un buffer separe `cityContourIndexes`, dans le meme ordre que `cityNed2EcefMatrices`;
  - les contours pays seront disponibles en radians et en n-vectors pour eviter les conversions repetees dans les shaders;
  - les intervalles d'azimut seront injectes sous forme continue `[minRadians, maxRadians]`, sans stockage de `centerRadians`;
  - le centre d'un intervalle est calcule par `(minRadians + maxRadians) / 2`;
  - `PI`, `TWO_PI`, `HALF_PI` et `EARTH_RADIUS_METERS` sont des constantes globales partagees par les processus TypeScript et WGSL;
  - le mapping WebGPU cible est `global_invocation_id.x = cityIndex` et `global_invocation_id.y = azimuthIntervalIndex`.
- Correction historique constatee:
  - `MatNED2ECEF` dans `toBabylon/src/application/common/shaders/sphericalCalculus.glsl` utilisait `cos(latitude)` pour `sPhi`;
  - la convention du projet utilise une latitude terrestre en radians, donc `sPhi` doit etre `sin(latitude)`;
  - la migration doit partir du contrat corrige et ne pas recopier cette anomalie.
- Elements concretes deja en place:
  - la bibliotheque de fonctions mathematiques partagees existe en TS et en
    WGSL/GLSL dans `src/lib/shared` et `src/lib/compute/kernels/shared`;
  - `cityNed2EcefMatrices` est produit dans le socle `staticTown` et consomme
    par les backends CPU, WebGL2 et WebGPU;
  - `boundaryAlgebre` est porte cote CPU, WebGL2 et WebGPU;
  - les tests d'invalidation garantissent qu'un changement d'annee ne relance
    pas `prepareDataset` et n'affecte que les tranches prevues.
- Verification ulterieure sur le worktree de migration:
  - le precalcul CPU statique, dynamique, `rawCones` et intersections CPU est
    bien present dans `src/lib/domain/precompute`;
  - la frontiere precalcul / integration interactive est formalisee par les
    contrats d'invalidation et les tests de workspace.

## M4.1: Socle De Tests CPU Et Contrats De Buffers

Statut: `validated`

Objectif:

Mettre en place les premiers tests automatises qui serviront de reference pour le portage GPU et pour les prochains jalons de migration.

Document de reference:

- `docs/migration-test-strategy.md`.

Travail attendu:

- ajouter une commande `npm test` ou equivalente pour les tests CPU rapides;
- choisir un runner cible base sur `Vitest`; `tsx --test` reste transitoire
  tant que la migration des scripts n'est pas terminee;
- creer les tests unitaires de `src/lib/shared`;
- creer les tests de contrats de buffers GeoJSON;
- creer les tests CPU de `computeTownBoundaryLimitsCpu`;
- couvrir au minimum:
  - carre avec ville au centre;
  - carre avec ville excentree;
  - polygone non carre;
  - polygone concave simple;
  - ville hors contour;
  - `cityId` different de l'ordre ville;
  - intervalle d'azimut continu avec borne negative;
- preparer la structure `tests/conformance/cpu-gpu` sans rendre les tests WebGPU bloquants tant que le kernel WGSL n'existe pas.

Critere d'acceptation:

- les tests CPU passent localement;
- les invariants d'unites radians/metres sont testes;
- les strides de buffers sont testes;
- les tests distinguent clairement reference CPU et future implementation GPU;
- la documentation liste les limitations restantes.

Validation:

- Implementation:
  - `package.json` ajoute `npm test`;
  - `tests/unit/shared/spherical.test.ts` couvre conversions spheriques et matrice `NED2ECEF`;
  - `tests/unit/geojson/precompute.test.ts` couvre ingestion GeoJSON, radians, buffers et index de contours;
  - `tests/unit/geojson/boundary-raycast.test.ts` couvre la reference CPU des limites par ville.
- Cas couverts:
  - carre avec ville au centre;
  - carre avec ville excentree;
  - polygone non carre;
  - polygone concave simple;
  - ville hors contour;
  - `cityId` different de l'ordre ville;
  - intervalle d'azimut continu avec borne negative.
- Validations executees:
  - `npm test`;
  - `npm run build`.
- Support interactif associe:
  - `src/routes/test/test1/+page.svelte` couvre la preparation GeoJSON et la
    reference CPU des limites par villes;
  - `src/routes/test/test2/+page.svelte` inspecte contours, triangulation pays,
    associations ville -> contour et diagnostics GeoJSON.
- Verification ulterieure sur le worktree de migration:
  - `npm test` passe avec `68/68` tests;
  - `npm run test:integration` passe avec `5/5` tests;
  - `src/routes/test/test3/+page.svelte` existe bien comme page de validation
    interactive officielle du pipeline CPU des cones.
- Limites restantes:
  - les tests WebGPU ne sont pas encore actifs car le kernel WGSL de raycast n'existe pas;
  - la conformite CPU/GPU sera ajoutee dans `tests/conformance/cpu-gpu`;
  - l'integration interactive du pipeline data valide par M3.1 reste a
    traiter dans M3 et M9.

## M5: Prototype Comparatif Du Renderer

Statut: `deferred`

Objectif:

Selectionner le moteur de rendu uniquement lorsque les buffers finaux sont
suffisamment matures pour comparer Babylon.js et luma.gl sur des entrees
strictement identiques.

Decision differee:

- Babylon.js reste un candidat, pas un choix definitif;
- luma.gl est le principal candidat alternatif;
- le renderer consomme uniquement les buffers finaux et ne participe a aucun
  calcul amont;
- les conditions de declenchement et criteres sont detailles dans
  `docs/renderer-evaluation.md`.

Travail attendu:

- definir une interface `RenderBackend` independante;
- creer un prototype Babylon.js;
- creer un prototype luma.gl;
- afficher les pays ou frontieres;
- afficher les villes;
- afficher un volume representatif de cones et courbes;
- fournir une camera et une interaction minimale;
- comparer performances, qualite, picking et cout d'ingenierie.

Architecture cible:

```text
src/lib/render/
  contract/
  babylon/
  luma/
```

Critere d'acceptation:

- les deux prototypes consomment les memes buffers finaux;
- les mesures de rendu sont separees des mesures compute;
- une decision argumentee est enregistree dans `docs/renderer-evaluation.md`;
- le domaine et le framework compute ne dependent d'aucun renderer;
- les tests M1 a M4 passent;
- le renderer retenu affiche un dataset de reference.

Validation:

- Jalon volontairement differe jusqu'a stabilisation des buffers finaux pays,
  villes, cones et courbes.

## M6: Framework Compute Multi-Profil Et Fallback

Statut: `in_progress`

Objectif:

Creer le remplacement structurel de `GPUComputer` et l'orchestrateur maison
qui selectionne ou force les profils `WebGPU`, `WebGL2` et `CPU` avec fallback
explicite depuis l'ingestion CSV/GeoJSON jusqu'aux buffers de precompute.

Decision d'architecture:

- l'implementation initiale est un orchestrateur TypeScript qui pilote les
  backends compute;
- les kernels critiques restent ecrits en WGSL pour WebGPU;
- le backend WebGL2 est le premier fallback accelere a integrer;
- le backend CPU reste la reference fonctionnelle et l'ultime repli;
- le profil `CPU` reste toujours disponible et peut etre force a tout moment;
- le profil `WebGL2` peut etre force lorsqu'il est disponible, avec un repli
  explicite vers `CPU` si le navigateur ou la webview ne le supporte pas;
- l'orchestrateur doit pouvoir encadrer les etapes d'ingestion CSV, d'ingestion
  GeoJSON, d'assemblage lossless, de preparation du dataset et de precompute;
- chaque etape doit pouvoir etre benchmarkee independamment, quel que soit le
  profil retenu;
- l'API doit rester compatible avec un futur backend Rust/wgpu natif;
- le framework compute ne doit pas dependre de Babylon.js, Tauri ou SvelteKit.

Travail attendu:

- initialiser la detection de capacites et la selection de profil;
- permettre un profil force explicite, y compris `webgl2` lorsqu'il est
  disponible;
- creer une abstraction de buffers partagee entre les profils, avec un
  contrat explicite sur les unites, l'ordre lon/lat et les strides;
- creer une abstraction de kernel / passe partagee entre les profils, avec
  un contrat explicite des entrees, sorties et stages benchmarkes;
- creer un cache de pipelines et de programmes;
- definir les etapes benchmarkees depuis l'ingestion CSV/GeoJSON jusqu'aux
  buffers precomputes;
- executer un kernel WGSL simple sur WebGPU;
- executer une passe WebGL2 simple avec le meme contrat de buffers;
- lire les resultats CPU pour tests et debug;
- documenter les limitations navigateur, les profils forçables et les
  conditions de fallback.

Architecture cible:

```text
src/lib/compute/core/
  WebGpuContext.ts
  BufferStore.ts
  Kernel.ts
  PipelineCache.ts
  ProfileSelector.ts
  fallback.ts
src/lib/compute/webgl2/
src/lib/compute/webgpu/
src/lib/compute/kernels/
  city-ned2ecef/
    webgpu.wgsl
    webgl2.vert
  boundary-algebre/
    webgpu.wgsl
    webgl2.vert
  raw-cone-alphas/
    webgpu.wgsl
    webgl2.vert
  ciseled-cones/
    webgpu.wgsl
    webgl2.vert
  final-cones/
    webgpu.wgsl
    webgl2.vert
  curve-geometry/
    webgpu.wgsl
    webgl2.vert
  shared/ray-intersect-triangle/
    webgpu.wgsl
    webgl2.glsl
```

Interface cible indicative:

```ts
interface ComputeBackend {
  readonly profile: 'webgpu' | 'webgl2' | 'cpu';
  prepareStaticBuffers(prepared: PreparedDataset): Promise<PreparedGpuResources>;
  computeFrame(input: InteractiveComputeInput): Promise<ComputedFrame>;
  dispose(): Promise<void>;
}
```

Critere d'acceptation:

- un test de selection de profil applique la chaine `WebGPU -> WebGL2 -> CPU`;
- un test explicite couvre le forçage de `WebGL2` quand le profil est
  disponible;
- un test explicite couvre le forçage de `CPU` et confirme qu'il reste
  toujours disponible;
- un test de benchmark compare les etapes d'ingestion, d'assemblage et de
  precompute pour au moins deux profils differents;
- un test WebGPU simple passe quand WebGPU est disponible;
- un skip explicite existe quand WebGPU est indisponible;
- un backend WebGL2 passe avec les contrats de buffers villes et limites;
- le framework compute ne depend pas de Babylon;
- le framework compute ne depend pas de SvelteKit;
- l'API ne bloque pas l'ajout futur d'un backend Rust/wgpu.

Validation:

- A renseigner apres implementation.

Etat reel observe ulterieurement:

- un premier kernel WGSL metier existe deja dans `src/lib/compute/kernels/city-ned2ecef/webgpu.wgsl`;
- l'import WGSL via Vite est deja prouve dans le shell applicatif;
- le framework compute est amorce dans `src/lib/compute/core` et
  `src/lib/compute/cpu/workflow.ts`;
- les premiers fichiers concrets sont:
  - `src/lib/compute/core/types.ts`;
  - `src/lib/compute/core/selector.ts`;
  - `src/lib/compute/core/timing.ts`;
  - `src/lib/compute/cpu/workflow.ts`;
  - `src/lib/compute/webgl2/workflow.ts`;
  - `src/lib/compute/webgpu/workflow.ts`;
  - `src/lib/compute/index.ts`;
  - `tests/unit/compute/profile-selector.test.ts`;
  - `tests/unit/compute/cpu-workflow.test.ts`;
  - `tests/unit/compute/webgl2-workflow.test.ts`;
  - `tests/unit/compute/webgpu-workflow.test.ts`;
- le backend CPU de reference orchestre deja l'ingestion, l'assemblage, le
  `PreparedDataset`, les precomputes GeoJSON et les passes CPU de reference;
- le selecteur de profil accepte deja le forçage et le fallback explicite;
- un fallback WebGL2 existe deja avec detection de contexte, des dispatchs
  reels `city-ned2ecef`, `raw-cone-alphas`, `ciseled-cones` et
  `boundary-algebre` et `finalCones` en transform feedback, comparaison
  runtime optionnelle des buffers relus et delegation du reste au CPU de
  reference;
- un premier squelette WebGPU existe deja avec compilation du premier kernel
  metier `city-ned2ecef`, du raycast GeoJSON `boundary-algebre` et de la
  selection d'alpha des raw cones, de la reduction finale des cones et de la
  geometrie finale prete a afficher, tout en deleguant les autres etapes au
  CPU de reference;
- l'ecran `/workspace` peut deja consommer le backend CPU de reference et
  afficher la selection de profil, la strategie d'intersection cone/cone et
  le benchmark par etape;
- le backend WebGPU est maintenant branche sur le meme contrat, mais son
  deploiement reste secondaire par rapport au fallback WebGL2 stabilise;
- l'orchestrateur de migration doit encore etre relie aux points d'entree de
  l'application pour exposer le benchmark par phase et le choix de profil.

Conclusion:

- `M6` est `in_progress`, avec le socle CPU, le selecteur et les premiers
  kernels WebGL2/WebGPU deja en place.

## M7: Portage WGSL / Backend WebGPU Des Passes Existantes

Statut: `in_progress`

Objectif:

Porter les calculs intensifs historiques vers le backend WebGPU/WGSL, puis
aligner les fallback WebGL2 sur le meme contrat quand cela reste pertinent.

Passes prioritaires:

- generation des cones;
- generation des courbes;
- conversion de projection;
- limites geographiques;
- geometrie finale des cones;
- clipping.

Travail deja realise:

- la geometrie des courbes est portee et benchmarkee sur CPU, WebGL2 et
  WebGPU avec le meme contrat de sortie render-ready;
- les passes cones principales sont deja en place sur les trois profils;
- la prochaine phase de M7 consiste surtout a durcir les comparaisons et a
  finir les derniers kernels utilitaires encore partiellement portés.

Travail attendu:

- traduire les fonctions communes en WGSL;
- remplacer les textures de donnees par des storage buffers;
- expliciter les uniforms dans des structs WGSL;
- brancher les passes sur l'orchestrateur de M6;
- porter la selection d'alpha des raw cones;
- ajouter des tests de comparaison avec les snapshots M1;
- mesurer les performances;
- garder le backend CPU comme oracle et le backend WebGL2 comme fallback.

Critere d'acceptation:

- les sorties WGSL correspondent aux sorties historiques dans les tolerances definies;
- les passes interactives peuvent etre lancees sans reconstruire le precalcul;
- le backend WebGPU s'integre dans la chaine de fallback sans modifier les
  contrats de buffers;
- la selection d'alpha des raw cones est benchmarkee sur le meme contrat que
  la reference CPU;
- les readbacks CPU ne sont utilises que pour tests/debug.

Validation:

- A renseigner apres implementation.

## M8: Nouveau Pipeline D'Intersections

Statut: `in_progress`

Objectif:

Ameliorer les intersections entre cones et les decoupes par limites.

Travail attendu:

- conserver `overlapCandidates` comme perimetre de villes voisines;
- construire les longueurs maximales de cones par ville;
- formaliser le rayon symetrique `phiB0` entre deux villes;
- prioriser le parcours de `phiB0` vers le plan A-B-centre Terre;
- construire une BVH circulaire de blocs de faces exploitable par WebGPU;
- aligner et benchmarker une variante de BVH circulaire sur les intervalles
  monotones d'alpha et les limites d'attenuation;
- benchmarker le filtre par intervalle d'azimuts possible;
- comparer les interpolations d'attenuation de `alpha`, `cos(alpha)` et
  `tan(alpha)` avant toute evolution du modele scientifique;
- caracteriser la fourchette prioritaire formee du couloir symetrique et des
  supports rapides `alpha < roadAlpha` proches ou chevauchants;
- benchmarker plusieurs largeurs bilaterales de voisinage autour de `phiB0`;
- distinguer conceptuellement intersection cone/cone et clipping frontieres,
  tout en evaluant leur fusion dans une meme passe WebGPU;
- definir les buffers necessaires;
- implementer un oracle exhaustif limite aux voisins statiques;
- implementer Moller-Trumbore double face puis evaluer une variante watertight
  si les tests Float32 le necessitent;
- comparer visuellement et numeriquement.

Travail realise:

- primitive CPU Moller-Trumbore double face documentee pour TypeDoc;
- separation de la tolerance algebrique et de la distance minimale en metres;
- oracle CPU exhaustif sur toutes les faces des voisins statiques retenus;
- sortie du bord cisele, de la distance minimale et des index de diagnostic;
- comptage des faces testees par rayon;
- benchmark stable `cone-intersection-exhaustive`;
- parcours CPU exhaustif ordonne par le rayon symetrique `phiB0`;
- reutilisation des azimuts `gammaAB` et `gammaBA` deja presents dans les
  invariants de paire;
- benchmark stable `cone-intersection-symmetric-order` et statistiques
  d'ordre de decouverte de la face gagnante;
- classification CPU des faces Road/rapides, calculee une fois par ville;
- fourchette prioritaire CPU alpha-aware associant couloir court, faces de
  bord et supports rapides dans un voisinage bilateral configurable;
- parcours alpha-aware encore exhaustif et strictement conforme a l'oracle;
- reference CPU conservatrice qui groupe les faces en blocs et rejette un
  bloc uniquement lorsque `blockEntryT > bestT + epsilon`;
- diagnostics de taille de fourchette et d'appartenance de la face gagnante;
- benchmark stable `cone-intersection-alpha-aware-order`;
- benchmark stable `cone-intersection-alpha-aware-block-pruned`;
- portage WebGL2 puis WebGPU du noyau `ciseledCones` avec comparaison readback
  contre l'oracle CPU;
- contrat de cache memoire d'instance par annee pour
  `coneIntersectionDistanceMeters`;
- resolution angulaire fixe a `1 deg` et cache vide au changement de dataset;
- clipping pays volontairement exclu du cache cone/cone;
- tests analytiques sans dependance a Babylon.js, SvelteKit ou WebGPU.

Etat de reflexion valide avant implementation de la filtration:

- l'oracle CPU exhaustif reste la reference de conformite;
- l'ordre symetrique exhaustif caracterise le rang de decouverte du minimum
  sans supprimer de face;
- la majorite des directions porte `roadAlpha`; les supports
  `alpha < roadAlpha` sont rares, explicites et doivent enrichir la
  fourchette prioritaire;
- la fourchette candidate unit le couloir `phiB0 -> gammaBA`, ses faces de
  bord et les supports rapides proches ou chevauchants;
- les longues plages Road et les supports rapides eloignes sont regroupes en
  blocs conservateurs;
- la reference CPU conserve exactement l'oracle en rejettant un bloc
  seulement lorsque sa borne `blockEntryT` ne peut plus battre `bestT`
  au-dela d'une tolerance numerique;
- le rejet de production exige une borne geometrique
  `blockEntryT > bestT + epsilon`;
- toutes les strategies, parametres de voisinage et combinaisons de filtres
  seront benchmarkes sans cache contre l'oracle;
- le cache d'instance par annee sera mesure separement et ne stockera que
  `coneIntersectionDistanceMeters`.

Prochaine implementation:

1. benchmarker plusieurs largeurs bilaterales sur les datasets reduits;
2. regrouper les longues plages Road et les supports rapides en blocs;
3. ajouter des volumes englobants conservateurs et mesurer le rejet reel;
4. comparer chaque variante a l'oracle exhaustif;
5. implementer ensuite le cache memoire d'instance par annee.

Cas tests minimum:

- deux villes isolees avec cones simples;
- trois villes formant un triangle;
- villes proches avec vitesses tres differentes;
- ville proche d'une frontiere;
- polygone avec concavite;
- changement de resolution sans rupture topologique majeure.
- rayon symetrique situe de part et d'autre du plan A-B-centre Terre;
- cone complexe avec plusieurs minima locaux;
- rayon passant sur une arête partagee par deux faces;
- longueur globale et longueur locale de cone;
- comparaison exhaustive, intervalle angulaire, heuristique, BVH circulaire
  fixe et BVH circulaire consciente d'alpha;

Critere d'acceptation:

- les artefacts historiques identifies diminuent;
- la stabilite est meilleure quand la resolution varie;
- les performances restent compatibles avec l'interaction.
- aucune intersection n'est manquee face a l'oracle sur les jeux de conformite;
- les benchmarks mesurent le nombre moyen et p95 de faces testees;
- le cout de la sortie intermediaire et de la fusion pays est documente.

Validation:

- Implementation intermediaire alpha-aware CPU validee:
  - toutes les faces restent visitees exactement une fois;
  - distances, positions ciselees, voisin et face gagnants identiques a
    l'oracle sur les tests analytiques;
  - largeur bilaterale explicitement configurable et instrumentee;
  - aucune elimination de face avant introduction d'une borne conservatrice.
- Validations executees:
  - controle TypeScript strict limite aux modules migres;
  - `npm test`;
  - `npm run build`.
- Support interactif associe:
  - `src/routes/test/test3/+page.svelte` expose les etapes CPU `staticTown`,
    `dynamicTown`, `rawCones` et `coneIntersections` sur les datasets
    compacts charges depuis l'application.
- M8 reste `in_progress`: les blocs conservateurs, leur benchmark sur datasets
  reduits et le cache annuel ne sont pas encore implementes.
- Etat reel observe ulterieurement:
  - un prototype non route de laboratoire heuristique existe dans
    `src/lib/testing/ray-range-heuristics.ts`;
  - ce helper est actuellement purement CPU, sans dependance Babylon.js dans le
    code de migration;
  - une couverture unitaire minimale doit preceder tout branchement interactif.

## M9.0: Modularisation UI En Deux Pans

Statut: `in_progress`

Objectif:

Separer l interface en deux pans reutilisables et maintenables:

- `workspace` pour la validation, les diagnostics et les benchmarks;
- `app` pour l usage operationnel, le rendu principal et les interactions metier.

Ce jalon ne change pas l inventaire shader. Il reorganise l UI et ses
composants autour des briques deja validees.

Travail attendu:

- decouper `src/routes/workspace/+page.svelte` en sous-composants plus petits;
- extraire les panneaux de resume, diagnostics et benchmark dans des modules
  reutilisables;
- definir la coque applicative `src/routes/app`;
- creer une couche de composants partages pour les panneaux, tableaux et
  selections;
- refactoriser `QueryNodeEditor.svelte` si necessaire pour reutiliser ses
  sous-parties;
- garder les pages de test comme vues fines de validation, pas comme containers
  d orchestration.

Travail deja realise:

- extraction des panneaux `workspace` vers:
  - `src/lib/components/workspace/WorkspaceSummaryGrid.svelte`;
  - `src/lib/components/workspace/WorkspaceComputePanel.svelte`;
  - `src/lib/components/workspace/WorkspaceDatasetDetails.svelte`;
  - `src/lib/components/workspace/WorkspaceQueryPanel.svelte`;
- extraction de l orchestration applicative de page vers:
  - `src/lib/application/workspace/page.ts`;
- extraction du controleur de requete `workspace` vers:
  - `src/lib/application/query/controller.ts`;
- extraction de la barre de controle `workspace` vers:
  - `src/lib/components/workspace/WorkspaceControls.svelte`;
- extraction des panneaux de statut `workspace` vers:
  - `src/lib/components/workspace/WorkspaceNoticePanel.svelte`;
- extraction de sous-panneaux de synthese `workspace` vers:
  - `src/lib/components/workspace/WorkspaceSummaryCard.svelte`;
- extraction de sous-panneaux `query` vers:
  - `src/lib/components/query/QuerySnapshotFieldsPanel.svelte`;
  - `src/lib/components/query/QueryExecutionResultPanel.svelte`;
- extraction des tableaux metier `workspace` vers:
  - `src/lib/components/workspace/WorkspaceTransportModesTable.svelte`;
  - `src/lib/components/workspace/WorkspaceCityPreviewTable.svelte`;
  - `src/lib/components/workspace/WorkspaceQueryableFieldsTable.svelte`;
- extraction du tableau de benchmark `workspace` vers:
  - `src/lib/components/workspace/WorkspaceComputeBenchmarkTable.svelte`;
- extraction de panneaux communs reutilisables vers:
  - `src/lib/components/shared/DiagnosticsDetails.svelte`;
  - `src/lib/components/shared/MetricCardGrid.svelte`;
  - `src/lib/components/shared/metricCards.ts`;
- factorisation des panneaux repetitifs des pages `test1`, `test2` et `test3`
  autour de ces composants partages;
- extraction de `QueryNodeEditor.svelte` vers:
  - `src/lib/components/query/QueryNodeGroupEditor.svelte`;
  - `src/lib/components/query/QueryNodeLeafEditor.svelte`;
  - `src/lib/components/query/queryEditor.ts`;
- reduction de `src/routes/workspace/+page.svelte` a un role
  d orchestration;
- maintien des contrats metier et compute identiques.

Critere d acceptance:

- le workspace est decoupe en composants et modules plus petits;
- la future coque operationnelle est definie sans dupliquer la logique du
  workspace;
- les panneaux communs sont reutilisables;
- les fichiers Svelte les plus gros ont ete reduits ou scindes;
- les contrats metier restent inchanges.

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
- faire evoluer `src/routes/test/test1`, `test2` et `test3` d'un role
  d'inspection CPU vers un role de validation interactive complete des profils
  CPU, WebGL2 et WebGPU.

Critere d'acceptation:

- le changement d'annee est interactif;
- le changement de representation est interactif;
- les couches peuvent etre affichees/masquees;
- les tests et le build passent.
- le build frontend peut etre produit sous forme statique ou embarquable.

Validation:

- A renseigner apres implementation.

Etat reel observe ulterieurement:

- les pages `test1`, `test2` et `test3` existent et servent deja de validation
  interactive CPU;
- aucune integration Babylon.js complete n'est encore branchee;
- le smoke Playwright existe dans `tests/e2e/home.spec.ts` et passe desormais
  sur le shell SvelteKit minimal;
- `playwright.config.ts` demarre Vite avec `--configLoader runner` et utilise
  le Chromium systeme si les navigateurs Playwright n'ont pas ete installes.

Conclusion:

- `M9` reste `todo`.

## M9.1: Packaging Client Lourd Tauri

Statut: `todo`

Objectif:

Produire un client lourd Linux/Windows en reutilisant l'interface SvelteKit et le pipeline de calcul existant.

## Audit Recent Du Worktree De Migration

Etat constate lors de l'audit initial:

- `package-lock.json` etait desynchronise par rapport au socle reel de
  dependances migrees;
- `src/lib/testing/ray-range-heuristics.ts` avait ete ajoute comme helper CPU
  non route pour le laboratoire heuristique;
- `tests/unit/precompute/ray-range-heuristics.test.ts` couvrait deja ce helper
  localement;
- `npm run test:e2e` echouait alors parce que le `webServer` Playwright ne
  demarrait pas.

Resolution retenue:

1. resynchroniser `package-lock.json` avec `package.json` sans introduire de
   dependance de rendu prematuree;
2. conserver le helper heuristique dans `M8` tant qu'aucune route dediee n'est
   justifiee;
3. garder la couverture CPU unitaire minimale comme precondition a toute
   integration SvelteKit/Babylon;
4. corriger `playwright.config.ts` pour demarrer Vite sans ecriture temporaire
   sous `node_modules` et reutiliser un Chromium systeme quand disponible.

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

Etat courant:

- le worktree de migration ne contient plus les routes Sapper legacy;
- le noyau `src/application` Three.js/WebGL historique a ete retire du worktree;
- le pipeline Rollup historique et les assets `src/toStatic` non references ont ete supprimes;
- `package.json` a ete reduit aux dependances encore utiles au socle SvelteKit, aux scripts datasets, a Vitest et a Playwright.

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
- 2026-06-03 - M1 - validated - commit `904e174` - fixtures reduites et caracterisation datasets ajoutees.
- 2026-06-03 - M2.1 - validated - commit `23d2ff0` - audit des hooks Rollup et decisions de migration documentes.
- 2026-06-03 - M2.1 - validated - commit `360638c` - strategie de validation WGSL documentee.
- 2026-06-04 - M2 - validated - commit `ddeab9c` - shell SvelteKit/Vite, import WGSL et build datasets portes.
- 2026-06-04 - M3.1 - in_progress - commit `465e71d` - scripts dataset raccordes au module TypeScript documente; pipeline CSV complet non valide.
- 2026-06-07 - M3.1 - validated - commit `0bd9ca0` - tests d'integration du pipeline lossless, invariance a l'ordre et diagnostics complets.
- 2026-06-07 - M3/M4/M8 - in_progress - commit `ff17606` - routes SvelteKit `test1/test2/test3` portees sur le pipeline moderne et pile legacy Sapper/Three/Rollup supprimee.
