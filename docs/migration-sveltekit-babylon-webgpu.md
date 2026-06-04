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

Le suivi operationnel des jalons, criteres d'acceptation et validations est maintenu dans `docs/migration-validation-roadmap.md`. Ce document doit etre mis a jour et committe a chaque jalon valide.

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

## Pipeline De Build Historique A Preserver

Le build Rollup historique ne se limite pas a compiler Sapper. Il execute plusieurs traitements applicatifs indispensables.

Responsabilites identifiees:

- `rollupScripts/shaderCompiler.js` compile les shaders GLSL avec `glslify`.
- `rollupScripts/shaderCompiler.js` valide les shaders en developpement via un contexte WebGL cree avec `node-gles`.
- `rollupScripts/shaderCompiler.js` supprime les commentaires et espaces inutiles des shaders compiles.
- `rollup.config.js` injecte le dictionnaire des shaders dans le code via le placeholder `__SHADERS_HERE__`.
- `rollupScripts/zipper.js` lit les dossiers de `datasets/`, transforme chaque dataset en liste `{ name, text }`, compresse le JSON avec `zlib.deflate` niveau 9, puis ecrit les resultats dans `static/datasets/`.
- `rollupScripts/zipper.js` genere aussi `static/datasets/datasets.json`.
- `rollup.config.js` copie les assets declares dans `package.json#toCopy`.
- `rollup.config.js` lance la generation Typedoc.
- `rollup.config.js` adapte certains liens HTML de documentation.
- `rollup.config.js` lance la preparation/compression CSS.

La migration SvelteKit/Vite doit donc evaluer explicitement ces responsabilites. Il ne faut pas reconduire automatiquement tous les hooks historiques: certains traitements peuvent devenir inutiles parce que Vite sait importer directement des ressources texte ou binaires, avec une declaration TypeScript adaptee.

Supprimer Rollup sans analyser ces responsabilites casserait:

- le chargement dynamique des shaders;
- le chargement des datasets compresses dans l'application;
- la disponibilite des assets statiques;
- la documentation developpeur generee;
- potentiellement la preparation CSS historique.

Decision cible:

- profiter des mecanismes SvelteKit/Vite pour integrer les shaders directement dans le code;
- importer les fichiers WGSL/GLSL comme modules sources texte;
- ajouter les declarations TypeScript necessaires pour les extensions shader;
- supprimer l'injection globale `__SHADERS_HERE__`;
- eviter un nouveau hook shader tant que les imports Vite suffisent;
- creer des scripts Node independants du bundler uniquement pour les traitements encore necessaires, notamment les datasets;
- creer un plugin Vite seulement si les imports natifs ou les scripts dedies ne couvrent pas le besoin;
- eviter de cacher des traitements metier dans la configuration SvelteKit;
- rendre la generation des datasets testable par commande dediee.

Exemple de direction possible pour WGSL:

```ts
import rawConesShader from './raw-cones.wgsl?raw';
```

Avec une declaration de type:

```ts
declare module '*.wgsl?raw' {
	const source: string;
	export default source;
}
```

La meme approche sera appliquee aux fichiers GLSL historiques si le pipeline WebGL2 temporaire reste necessaire.

Scripts cibles indicatifs, seulement pour les traitements qui restent necessaires:

```text
scripts/
  build-datasets.ts
  build-docs.ts
  build-static-assets.ts
```

Commandes cibles indicatives:

```bash
pnpm build:datasets
pnpm build:docs
pnpm build:assets
pnpm build:pre
```

Le passage futur a WGSL/WebGPU ne supprime pas immediatement ce besoin. Pendant la migration, il faudra prendre en charge a la fois:

- les shaders GLSL historiques tant que des passes WebGL2 existent;
- les shaders WGSL WebGPU pour les nouvelles passes compute.

Decision pour `M2.1`:

- importer WGSL/GLSL directement avec Vite/SvelteKit;
- conserver un compilateur `glslify` seulement pour les shaders GLSL qui utilisent encore ses directives;
- ne pas introduire d'equivalent `glslify` pour WGSL tant qu'un besoin concret d'assemblage n'est pas demontre;
- organiser d'abord les kernels WGSL en fichiers explicites, importes comme sources texte;
- evaluer un preprocesseur WGSL seulement si la factorisation manuelle devient un probleme mesurable;
- valider les WGSL par creation de `GPUShaderModule` et lecture de `getCompilationInfo()`;
- prevoir une validation native Rust/wgpu/Naga lorsque le backend desktop natif sera introduit;
- supprimer l'injection `__SHADERS_HERE__` au profit d'import modules explicites;
- conserver un script de compression datasets tant que les datasets doivent etre servis sous forme deflatee.

Alternatives a evaluer pour les datasets:

- continuer a generer des fichiers deflates comme le pipeline historique;
- servir des fichiers JSON/CSV non precompresses et laisser le serveur ou l'hebergeur appliquer gzip/brotli;
- produire un format applicatif plus adapte au futur precalcul, par exemple JSON compacte, NDJSON ou buffers binaires;
- en client lourd Tauri, permettre le chargement direct de dossiers datasets locaux sans zip prealable.

Decision provisoire:

- garder la compression datasets comme script separe pour compatibilite;
- ne pas coupler cette compression a Vite ni au pipeline shader;
- reevaluer le format de distribution des datasets apres definition du pipeline de precalcul.

## Principe D'Architecture Cible

L'architecture cible doit separer clairement cinq couches:

1. `data`: lecture, validation, normalisation et fusion des fichiers CSV/GeoJSON.
2. `precompute`: preparation des structures stables qui alimentent les calculs interactifs.
3. `compute`: kernels WebGPU et orchestration des passes intensives.
4. `render`: affichage Babylon.js, materiaux, camera, interaction et export.
5. `ui`: application SvelteKit, stores, controles utilisateur, chargement des datasets.

Le point majeur est la distinction entre precalcul et calcul interactif.

## Contrat Dataset Et Aggregation Des Donnees

Le contrat dataset est structurel.

Un fichier est identifie par la presence de colonnes caracteristiques, jamais par son nom. Les noms de fichiers restent utiles pour les diagnostics, mais ne doivent pas piloter le chargement.

Les fichiers peuvent contenir des colonnes supplementaires. Ces colonnes sont des enrichissements utilisateur:

- elles doivent etre conservees;
- elles ne sont pas contractualisees;
- leur nom n'est pas presume;
- leur type metier n'est pas presume;
- leur unite n'est pas presumee;
- le coeur de calcul ne doit pas les interpreter directement.

La migration doit donc separer:

1. colonnes caracteristiques, utilisees pour reconnaitre, typer et relier les fichiers;
2. colonnes libres, conservees sans perte pour requetes, filtres, coloration, extrusion ou enrichissements futurs.

### Inspection Des Fichiers

La premiere etape du pipeline data devient `DatasetInspection`.

Entree:

```ts
interface SourceFile {
  name: string;
  text: string;
}
```

Sortie indicative:

```ts
type DatasetFileKind =
  | 'cities'
  | 'cityLinkedAttributes'
  | 'transportNetwork'
  | 'transportModes'
  | 'transportModeSpeeds'
  | 'geojson'
  | 'unknown';

interface InspectedDatasetFile {
  originalName: string;
  kind: DatasetFileKind;
  confidence: number;
  headers: string[];
  requiredHeadersFound: string[];
  missingHeaders: string[];
  extraHeaders: string[];
  errors: string[];
}
```

Les signatures minimales des fichiers sont declarees explicitement et doivent etre validees avant implementation.

Exemple indicatif:

```ts
interface FileSignature {
  kind: DatasetFileKind;
  requiredColumns: string[];
  unique?: boolean;
}
```

Les colonnes libres ne doivent jamais etre ajoutees a ces signatures pour des raisons de confort applicatif. Si une colonne est ajoutee a une signature, elle devient une contrainte de compatibilite dataset.

Les signatures doivent etre appliquees du plus specifique au plus generique.

Un CSV non reconnu comme type primaire mais contenant `cityCode` est classe comme `cityLinkedAttributes`.

Cette famille couvre le fichier historiquement appele `population.csv`, mais ne se limite pas a la population:

- la seule colonne caracteristique est `cityCode`;
- toutes les autres colonnes sont libres;
- plusieurs fichiers `cityLinkedAttributes` peuvent coexister;
- chaque ligne est rattachee a la ville de meme `cityCode`;
- les lignes sans ville correspondante sont conservees dans les diagnostics;
- ces fichiers ne doivent pas etre obligatoires pour construire le reseau de transport de base.

### Conservation Lossless

Chaque ligne parse doit conserver la ligne source complete.

Forme cible:

```ts
interface SourceRecord {
  sourceFileName: string;
  sourceKind: DatasetFileKind;
  rowIndex: number;
  characteristic: Record<string, unknown>;
  extra: Record<string, unknown>;
  raw: Record<string, unknown>;
}
```

Les calculs utilisent `characteristic`.

Les requetes utilisateur et enrichissements utilisent `raw` ou `extra` via un mapping explicite.

### Independance De L'Ordre Des Fichiers

L'ordre d'arrivee des fichiers n'est pas connu.

Le pipeline data ne doit donc jamais dependre de l'ordre fourni par:

- un drag and drop;
- une archive;
- un dossier local;
- le dataset compresse de l'application;
- un tri alphabetique;
- un ordre aleatoire.

Le flux obligatoire est:

1. collecter tous les fichiers;
2. inspecter les en-tetes de tous les fichiers;
3. resoudre un `DatasetManifest` global;
4. parser completement les fichiers classifies;
5. assembler le reseau.

Aucune jointure et aucun nettoyage ne doivent etre executes avant la resolution du manifest.

Forme cible:

```ts
interface DatasetManifest {
  primary: {
    cities: InspectedDatasetFile;
    transportNetwork: InspectedDatasetFile;
    transportModes: InspectedDatasetFile;
    transportModeSpeeds: InspectedDatasetFile;
  };
  cityLinkedAttributes: InspectedDatasetFile[];
  geojson: InspectedDatasetFile[];
  unknown: InspectedDatasetFile[];
  diagnostics: DatasetDiagnostic[];
}
```

### Mecanisme D'Aggregation Propose

L'aggregation historique dans `Merger` enrichit des objets par mutations successives. Ce fonctionnement est difficile a tester, difficile a diagnostiquer et favorise les dependances implicites entre donnees, rendu et calcul.

Le mecanisme cible est une aggregation par index et references stables:

1. resolution globale du `DatasetManifest`;
2. parse lossless des fichiers classifies;
3. normalisation technique des colonnes caracteristiques;
4. creation d'index:
   - `cityByCode`;
   - `modeByCode`;
   - `speedByModeAndYear`;
   - `edgesByOrigin`;
   - `edgesByDestination`;
   - index des records libres rattaches aux villes par `cityCode`;
5. creation d'entites reseau qui referencent les records sources;
6. production de diagnostics avant tout calcul intensif.

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
    latitude: number;
    longitude: number;
    radius: number;
  };
  source: SourceRecord;
  linkedRecords: Record<string, SourceRecord[]>;
  inEdgeIds: number[];
  outEdgeIds: number[];
}

interface BaseEdge {
  id: number;
  characteristic: {
    cityCodeOri: number;
    cityCodeDes: number;
    transportModeCode: number;
  };
  source: SourceRecord;
  originCityId?: number;
  destinationCityId?: number;
  transportModeId?: number;
  derived: {
    distCrowKM?: number;
  };
}
```

Avantages par rapport au `Merger` historique:

- pas de perte des colonnes source;
- diagnostics plus precis;
- assemblage testable sans renderer;
- references stables vers les lignes sources;
- separation claire entre donnees brutes, reseau de base et precalcul;
- compatibilite avec un futur moteur de requetes utilisateur.

Implementation `M3.1`:

- `scripts/dataset-inspection.mjs` inspecte et resout le manifest global;
- `scripts/dataset-assembly.mjs` assemble un reseau de base lossless;
- l'assembleur accepte directement une liste `{ name, text }[]` pour rester compatible avec un ordre d'arrivee non determine;
- les scripts de fixtures et de caracterisation utilisent ce pipeline sans modifier le `Merger` applicatif.

### Alignement Avec Les Interfaces `toBabylon`

La branche `toBabylon` contient une formalisation importante dans:

```text
/home/abdou/workspace/shriveling_world/src/application/merger/index.d.ts
```

Ces interfaces doivent servir de reference pour la migration, en particulier:

- `ICity`;
- `IEdge`;
- `ITranspMode`;
- `ITransportModeSpeed`;
- `ILookupCurvesAndCityGraph`;
- `IStaticTownHelper`;
- `IDynamicTownPreGeometry`;
- `IMergerData`.

La migration ne doit pas ignorer ces types. Elle doit les repositionner dans un pipeline plus separe:

```text
Source files
  -> DatasetInspection
  -> BaseNetworkAssembly
  -> DatasetPreparation
  -> Compute/Render
```

Correspondance cible:

| Interfaces `toBabylon` | Niveau migration | Role |
| --- | --- | --- |
| `ICity`, `IEdge`, `ITranspMode`, `ITransportModeSpeed` | `BaseNetwork` / `SourceRecord` | Donnees sources assemblees, conservees sans perte. |
| `ItransportDict`, `ISpeedPerTranspModePerYear`, `IMaxSpeedPerYear`, `ITerrestrialMinAlphaPerYear` | `PreparedNetwork` / `PreparedSpeedTimeline` | Structures derivees du reseau pour une preparation stable. |
| `IStaticTownHelper` | `PreparedStaticNetwork` | Donnees statiques de voisinage, referentiels et buffers derivables du dataset. |
| `IDynamicTownPreGeometry` | `PreparedDynamicNetworkByYear` | Donnees dependantes de l'annee ou d'une selection dynamique. |
| `ILookupCurvesAndCityGraph` | sortie de preparation ou compatibilite temporaire | Forme historique utile pour comparer le portage. |
| `IMergerData` | `PreparedDataset` ou `PreparedMergerData` | Conteneur de sortie de preparation, pas sortie directe de l'assemblage lossless. |

Decision:

- `BaseNetwork` reste le niveau lossless et requetable.
- `IMergerData` inspire le niveau prepare, mais ne doit pas absorber les donnees sources libres.
- Le portage TypeScript devra definir des types de domaine compatibles avec les intentions de `toBabylon`, plutot que repartir de noms de structures sans rapport.
- Les noms finaux peuvent evoluer, mais la separation entre source lossless, preparation statique et preparation dynamique doit rester explicite.

### Mapping Semantique Pour Les Requetes

Les requetes utilisateur peuvent porter sur des concepts comme:

- population a une annee donnee;
- surface;
- categorie administrative;
- tout autre enrichissement ajoute par un utilisateur.

Le coeur ne doit pas connaitre les noms de colonnes associes a ces concepts.

Le flux cible est:

1. le systeme decouvre les champs disponibles;
2. l'utilisateur ou un profil dataset associe un champ source a un concept;
3. le moteur de requete utilise ce mapping;
4. le reseau enrichi est filtre sans supposer le nom original de la colonne.

Exemple conceptuel:

```ts
interface UserFieldMapping {
  id: string;
  label: string;
  entity: 'city' | 'edge' | 'transportMode' | 'linkedRecord';
  sourceKind: DatasetFileKind;
  sourceColumn: string;
  type: 'number' | 'string' | 'boolean' | 'date' | 'unknown';
  unit?: string;
}
```

La requete "villes avec plus de X habitants en 1950 et une surface superieure a 10 km2" devient une requete sur deux mappings choisis, pas sur deux noms de colonnes imposes par le code.

## Strategie Web Et Client Lourd

Decision d'architecture validee:

```text
UI commune:
  SvelteKit

Web:
  SvelteKit + Babylon.js + WebGPU orchestre en TypeScript

Desktop:
  Tauri + le meme frontend SvelteKit

Kernels GPU:
  WGSL commun

Rust:
  backend Tauri, acces systeme, packaging desktop
  backend compute natif wgpu possible dans un second temps
```

Cette strategie correspond a l'option hybride:

- commencer par une application web moderne;
- garder une seule interface utilisateur;
- embarquer cette interface dans un client lourd Linux/Windows avec Tauri;
- ecrire les kernels intensifs en WGSL pour maximiser la portabilite;
- orchestrer WebGPU en TypeScript dans le navigateur;
- garder la possibilite d'ajouter un backend Rust/wgpu natif si la webview desktop ou le backend TypeScript/WebGPU ne suffit pas.

Ce choix evite une reecriture immediate en Rust tout en preservant une trajectoire vers un client lourd robuste.

### Role De TypeScript

TypeScript reste le langage principal pour:

- l'interface SvelteKit;
- l'orchestration du pipeline web;
- les stores et controles utilisateur;
- le chargement des datasets;
- le pipeline de build;
- le premier backend WebGPU;
- les tests applicatifs.

### Role De WGSL

WGSL devient le langage commun des calculs GPU intensifs.

Les kernels WGSL doivent etre concus comme des actifs portables:

- utilisables par WebGPU cote navigateur;
- reutilisables par un backend Rust/wgpu natif;
- versionnes separement;
- testes par comparaison numerique;
- independants du renderer.

### Role De Rust Et Tauri

Rust est introduit via Tauri, pas comme reecriture globale initiale.

Rust sert d'abord a:

- packager l'application en client lourd Linux/Windows;
- fournir un acces systeme controle;
- gerer les fichiers locaux;
- gerer les exports;
- executer eventuellement des traitements offline;
- fournir une base pour un backend compute natif futur.

Un backend Rust/wgpu natif devient pertinent si:

- la webview ne fournit pas WebGPU de maniere fiable;
- les performances desktop exigent un acces GPU natif;
- certains calculs CPU/precalcul deviennent trop couteux en TypeScript;
- le partage de logique metier via WASM devient rentable.

### Role De Deno

Deno n'est pas retenu comme socle principal.

Il peut rester une option pour des scripts autonomes, mais la migration cible:

- `pnpm` et Node pour SvelteKit/Vite;
- Tauri/Rust pour le client lourd;
- WGSL pour le compute intensif.

L'introduction de Deno dans le chemin principal ajouterait un runtime supplementaire sans resoudre directement le besoin de client lourd graphique.

### Frontiere A Respecter

L'architecture doit rester compatible avec deux backends compute:

```text
ComputeBackend
  WebGpuBrowserBackend   // TypeScript + navigateur
  WgpuNativeBackend      // Rust + wgpu, futur
```

Le reste de l'application doit dependre d'une interface stable, pas d'une implementation specifique.

API indicative:

```ts
interface ComputeBackend {
  prepareStaticBuffers(prepared: PreparedDataset): Promise<PreparedGpuResources>;
  computeFrame(input: InteractiveComputeInput): Promise<ComputedFrame>;
  dispose(): Promise<void>;
}
```

Cette interface doit permettre:

- le backend WebGPU TypeScript comme implementation initiale;
- un backend Rust/wgpu natif ulterieur;
- des tests avec backend CPU simplifie si necessaire.

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

## Phase 1: Caracterisation Initiale Et Fixtures

Objectif: preparer un socle reproductible avant de changer le traitement et le rendu.

Le nouveau pipeline de traitement et le rendu final vont evoluer. Cette phase ne doit donc pas figer les sorties historiques comme des attendus definitifs. Elle doit produire des fixtures et des rapports d'observation pour faciliter les decisions futures.

Actions:

- Creer des datasets reduits fictifs ou derives pour tests rapides.
- Selectionner des datasets realistes de reference.
- Ajouter des scripts de caracterisation sur la lecture CSV/GeoJSON.
- Observer le comportement historique du `Merger`.
- Relever, sans les transformer en golden tests bloquants:
  - nombre de villes;
  - nombre de modes;
  - nombre d'arcs;
  - detection du mode `Road`;
  - span temporel;
  - vitesses interpolees;
  - alphas par annee;
  - nombre de cones et courbes produits par l'ancien pipeline.
- Reporter les observations dans des fichiers lisibles.

Livrables:

- fixtures de test;
- rapports de caracterisation;
- commandes de caracterisation reproductibles.

Strategie de datasets retenue:

- `World_1M` sert de reference globale reduite, avec environ 500 villes dispersees sur le globe;
- `Europe_1M` sert de reference europeenne rapide, avec environ 50 villes;
- les fixtures rapides sont generees en prenant les 30 premieres villes du fichier classe `cities` par inspection de schema;
- les populations et le reseau de transport sont filtres sur ces villes;
- les modes, vitesses et GeoJSON sont conserves pour garder un contexte coherent;
- des datasets fictifs analytiques pourront etre ajoutes pour les cas geometriques precis.

Critere de validation:

- les fixtures sont reproductibles;
- les observations historiques sont disponibles;
- aucun attendu scientifique cible n'est fige avant validation explicite.

## Phase 2: Migration SvelteKit Et Vite

Objectif: moderniser le socle web sans modifier le modele scientifique.

Etat du jalon `M2`: valide sur build applicatif.

Actions:

- Remplacer Sapper par SvelteKit.
- Remplacer Rollup par Vite.
- Mettre a jour TypeScript, ESLint et Prettier.
- Choisir un seul gestionnaire de paquets.
- Deplacer les assets publics dans `static/`.
- Recréer les routes necessaires:
  - application;
  - documentation;
  - pages de test visuel;
  - chargement de dataset.
- Conserver temporairement Three.js si necessaire pour limiter le risque.

Decisions prises pendant `M2`:

- `npm` est conserve temporairement pour limiter le perimetre du jalon.
- `package-lock.json` doit etre versionne tant que `npm` reste le gestionnaire de paquets.
- SvelteKit utilise `@sveltejs/adapter-static` pour produire un build embarquable plus tard dans Tauri.
- Les routes SvelteKit minimales sont creees avec `src/app.html`, `src/routes/+layout.*` et `src/routes/+page.svelte`.
- Un kernel WGSL minimal est importe via Vite avec `?raw` pour prouver le mecanisme cible.
- Les declarations TypeScript `*.wgsl?raw`, `*.glsl?raw`, `*.frag?raw` et `*.vert?raw` sont ajoutees.
- Le service worker Sapper legacy est supprime; une strategie service worker SvelteKit sera reintroduite seulement quand le cache des datasets sera clarifie.
- Le bundling des datasets compresses est sorti de Rollup et repris par `scripts/build-datasets.mjs`.

Livrables:

- application SvelteKit qui demarre;
- build de production fonctionnel;
- chargement de dataset fonctionnel;
- tests existants toujours verts.

Critere de validation:

```bash
npm install
npm run characterize:datasets
npm run build
npm run validate
```

Resultat de validation:

- `npm run build` passe.
- `npm run validate` echoue encore sur le code legacy Sapper/Three non porte.
- Cette dette est acceptee temporairement: elle doit etre retiree par portage progressif, pas cachee par une configuration TypeScript moins stricte.

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
