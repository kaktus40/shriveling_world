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

## Vue D'Ensemble Des Jalons

| Jalon | Statut | Objectif |
| --- | --- | --- |
| M0 | validated | Branche propre et documentation initiale |
| M1 | todo | Baseline de regression et fixtures |
| M2 | todo | Migration SvelteKit/Vite minimale |
| M3 | todo | Extraction du domaine metier |
| M4 | todo | Architecture explicite de precalcul |
| M5 | todo | Rendu Babylon.js minimal |
| M6 | todo | Framework WebGPU compute minimal |
| M7 | todo | Portage WGSL des passes existantes |
| M8 | todo | Nouveau pipeline d'intersections |
| M9 | todo | Integration interactive complete |
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

## M1: Baseline De Regression Et Fixtures

Statut: `todo`

Objectif:

Securiser le modele existant avant toute migration technique. Cette etape doit produire des donnees de reference permettant de verifier que les transformations futures ne cassent pas le modele sans le signaler.

Travail attendu:

- choisir un dataset minimal et un dataset realiste de reference;
- creer une structure de fixtures dediee;
- ajouter un test runner adapte a l'etat initial du projet;
- tester la lecture des CSV;
- tester la reconnaissance des fichiers par en-tetes;
- tester le `Merger`;
- produire des snapshots JSON lisibles pour les sorties de reference.

Datasets proposes:

- dataset minimal: `datasets/19` ou une fixture reduite extraite de `datasets/tests` si disponible;
- dataset realiste: `datasets/World_1M`, `datasets/Europe_1M` ou `datasets/Germany_22` selon le temps d'execution;
- dataset de non-regression frontieres: GeoJSON le plus petit possible couvrant plusieurs polygones.

Sorties a figer:

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

Fichiers attendus:

```text
tests/
  fixtures/
    minimal/
    reference/
  golden/
    merger-minimal.json
    merger-reference.json
  merger.test.ts
```

Commandes de validation attendues:

```bash
pnpm test
pnpm build
```

Critere d'acceptation:

- les tests passent sur le code historique;
- les snapshots sont versionnes;
- les tolerances numeriques sont explicites;
- aucune migration SvelteKit/Babylon/WebGPU n'est incluse dans ce jalon.

Validation:

- A renseigner apres implementation.

## M2: Migration SvelteKit Et Vite Minimale

Statut: `todo`

Objectif:

Remplacer le socle Sapper/Rollup par SvelteKit/Vite sans modifier le modele scientifique ni les algorithmes.

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

Validation:

- A renseigner apres implementation.

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

Critere d'acceptation:

- un test WebGPU simple passe quand WebGPU est disponible;
- un skip explicite existe quand WebGPU est indisponible;
- le framework compute ne depend pas de Babylon;
- le framework compute ne depend pas de SvelteKit.

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
