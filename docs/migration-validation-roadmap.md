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
| M3 | todo | Extraction du domaine metier |
| M3.1 | validated | Inspection dataset et assemblage lossless du reseau |
| M4 | todo | Architecture explicite de precalcul |
| M4.1 | todo | Socle de tests CPU et contrats de buffers |
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

Resultat:

- M2 valide sur le critere build applicatif.
- Dette explicitement ouverte: validation stricte du code legacy non portee.

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
  - `./node_modules/.bin/tsc --noEmit --ignoreConfig --strict --allowJs --moduleResolution bundler --module esnext --target es2022 scripts/*.ts src/lib/domain/data/*.ts`;
  - verification de manifest identique entre ordre naturel et ordre inverse des fichiers pour `datasets/World_1M`;
  - verification d'assemblage identique entre ordre naturel et ordre inverse des fichiers pour `datasets/World_1M`;
  - `npm run build`.
- Diagnostics observes:
  - les datasets complets contiennent des arcs references vers des villes absentes du sous-ensemble de villes charge;
  - `population.csv` est correctement rattache comme `cityLinkedAttributes`, avec lignes orphelines conservees en diagnostics;
  - `datasets/World_1M/transport_mode_speed_v05.csv` contient quelques lignes historiques mal formees ou commentees dans des champs numeriques; elles sont conservees en source et signalees par diagnostics;
  - les valeurs numeriques caracteristiques invalides sans valeur exploitable sont normalisees a `null` dans les rapports JSON.
- Limite volontaire:
  - le nouveau reseau de base n'est pas encore branche dans l'application interactive;
  - `Merger` historique reste le chemin applicatif jusqu'au jalon d'extraction/portage suivant.

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

- Implementation partielle:
  - `src/lib/domain/data/types.ts`, `csv.ts`, `inspection.ts`, `assembly.ts` et `index.ts` crees;
  - code documente pour TypeDoc;
  - PapaParse retenu comme parseur CSV du domaine.
- Validations executees:
  - compilation TypeScript ciblee des fichiers `src/lib/domain/data/*.ts`;
  - `npm run build`.
- Reste a faire:
  - raccorder les scripts de caracterisation au module TypeScript ou ajouter un runner dedie;
  - ajouter des tests unitaires ciblees sur `domain/data`;
  - porter progressivement les consommateurs du `Merger`.

## M4: Architecture Explicite De Precalcul

Statut: `todo`

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
- Reste a faire:
  - produire l'equivalent WGSL de la bibliotheque de fonctions mathematiques partagees;
  - produire le buffer `cityNed2EcefMatrices` dans la phase de calcul WebGPU dediee;
  - portage WebGPU/WGSL de `boundaryAlgebre.frag`;
  - integration avec `PreparedDataset` quand la phase de precalcul reseau sera portee.

## M4.1: Socle De Tests CPU Et Contrats De Buffers

Statut: `todo`

Objectif:

Mettre en place les premiers tests automatises qui serviront de reference pour le portage GPU et pour les prochains jalons de migration.

Document de reference:

- `docs/migration-test-strategy.md`.

Travail attendu:

- ajouter une commande `npm test` ou equivalente pour les tests CPU rapides;
- choisir un runner minimal, prioritairement `node:test` execute via `tsx`;
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

- a renseigner au moment de l'implementation.

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
- 2026-06-03 - M1 - validated - commit `904e174` - fixtures reduites et caracterisation datasets ajoutees.
- 2026-06-03 - M2.1 - validated - commit `23d2ff0` - audit des hooks Rollup et decisions de migration documentes.
- 2026-06-03 - M2.1 - validated - commit `360638c` - strategie de validation WGSL documentee.
- 2026-06-04 - M2 - validated - commit `ddeab9c` - shell SvelteKit/Vite, import WGSL et build datasets portes.
- 2026-06-04 - M3.1 - validated - commit `465e71d` - scripts dataset raccordes au module TypeScript documente.
