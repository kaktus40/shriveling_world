# Audit Du Pipeline De Build Historique

Ce document couvre le jalon `M2.1`: evaluation des hooks Rollup applicatifs avant la migration Sapper/Rollup vers SvelteKit/Vite.

La regle de migration est de ne pas recopier les hooks Rollup par reflexe. Chaque traitement est classe selon l'une des decisions suivantes:

- `supprime`
- `remplace par Vite`
- `remplace par script`
- `conserve temporairement`

## Synthese Des Decisions

| Traitement historique | Fichiers | Decision cible | Raison |
| --- | --- | --- | --- |
| Injection `__SHADERS_HERE__` | `rollup.config.js`, `src/application/shaders.ts` | remplace par Vite | Les shaders doivent etre importes explicitement comme modules texte, pas injectes globalement. |
| Compilation GLSL avec `glslify` | `rollupScripts/shaderCompiler.js` | conserve temporairement | Les GLSL historiques utilisent vraiment `#pragma glslify`. A supprimer quand WebGL2/GLSL disparait. |
| Validation GLSL avec `node-gles` | `rollupScripts/shaderCompiler.js` | conserve temporairement ou supprime | Utile tant que GLSL reste actif, mais ne doit pas bloquer la migration SvelteKit si fragile. |
| Import WGSL | nouveau pipeline WebGPU | remplace par Vite | Les WGSL seront importes avec `?raw` et declarations TypeScript. |
| Validation WGSL | nouveau pipeline WebGPU | remplace par validation WebGPU/Naga | La validation est indispensable, mais elle ne doit pas etre confondue avec l'assemblage de fichiers. |
| Preprocesseur WGSL type `glslify` | aucun | supprime par defaut | Aucun besoin d'assemblage prouve. A evaluer seulement si la duplication WGSL devient problematique. |
| Compression datasets deflate | `rollupScripts/zipper.js` | remplace par script | Le format est applicatif: l'app fetch puis `pako.inflate`. Ce n'est pas juste une compression HTTP. |
| Generation `datasets.json` | `rollupScripts/zipper.js` | remplace par script | L'UI depend de cette liste pour presenter les datasets. |
| Copie assets `package.json#toCopy` | `rollup.config.js`, `package.json` | a evaluer | Une partie peut etre remplacee par `static/` SvelteKit, le reste par script. |
| Typedoc | `rollup.config.js` | remplace par script | La documentation ne doit pas etre cachee dans le build applicatif. |
| Rewriting HTML docs | `rollup.config.js` | a evaluer | Peut devenir inutile avec SvelteKit ou un build docs separe. |
| CSS preparation | `rollupScripts/cssPreparation.js` | a evaluer | Probablement remplace par Vite/PostCSS/Tailwind ou supprime si obsolète. |
| Lint auto-fix dans build | `rollup.config.js` | supprime | Un build ne doit pas modifier le code source. Lint doit etre une commande separee. |

## Shaders GLSL Historiques

### Etat Actuel

Le pipeline actuel:

1. `rollupScripts/shaderCompiler.js` trouve les fichiers `src/application/shaders/**/*.frag` et `*.vert`.
2. Il compile chaque fichier avec `glslify`.
3. Il supprime commentaires et espaces.
4. En developpement, il tente de compiler les shaders avec `node-gles`.
5. `rollup.config.js` remplace le placeholder `__SHADERS_HERE__` dans `src/application/shaders.ts` par le dictionnaire JSON compile.
6. Le code applicatif appelle `getShader(name, typo)`.

Usages constates:

- `src/application/shaders/coneMeshShader.frag` importe `polar2Cartographic.glsl` et `displayConversions.glsl`.
- `src/application/shaders/lineMeshShader.frag` importe `displayConversions.glsl`.
- `src/application/shaders/countryMeshShader.frag` importe `displayConversions.glsl`.
- `src/application/shaders/displayConversions.glsl` exporte `transit`.
- `src/application/shaders/polar2Cartographic.glsl` exporte `project`.
- `src/application/cone/coneMeshShader.ts` appelle `getShader('coneMeshShader', 'fragment')`.
- `src/application/cone/curveMeshShader.ts` appelle `getShader('lineMeshShader', 'fragment')`.
- `src/application/country/countryMeshShader.ts` appelle `getShader('countryMeshShader', 'fragment')`.

### Decision

Pour la migration SvelteKit/Vite:

- supprimer l'injection globale `__SHADERS_HERE__`;
- remplacer `getShader()` par des imports explicites au moment du portage;
- conserver temporairement `glslify` uniquement si les passes GLSL/WebGL2 historiques restent necessaires;
- ne pas investir dans une nouvelle architecture GLSL si les passes sont rapidement remplacees par WGSL/WebGPU.

Exemple cible temporaire GLSL:

```ts
import coneMeshFragment from './shaders/coneMeshShader.frag?raw';
```

Si `#pragma glslify` reste necessaire, deux options existent:

- precompiler les GLSL via un script `build:glsl` temporaire;
- utiliser un plugin Vite dedie temporaire.

La premiere option est preferee pour eviter de cacher du comportement metier dans Vite.

## Shaders WGSL Futurs

### Decision

Les shaders WGSL seront d'abord traites comme des sources texte importees par Vite:

```ts
import rawConesShader from './raw-cones.wgsl?raw';
```

Declaration TypeScript attendue:

```ts
declare module '*.wgsl?raw' {
	const source: string;
	export default source;
}
```

Il n'y aura pas d'equivalent `glslify` pour WGSL par defaut.

Cette decision concerne l'assemblage des fichiers, pas la validation. La validation WGSL reste obligatoire.

### Validation WGSL

Le besoin historique couvert en partie par `glslify` et `node-gles` etait double:

- assembler les morceaux de GLSL;
- verifier que les shaders produits etaient valides.

Pour WGSL, ces deux responsabilites doivent etre separees.

Strategie de validation cible:

1. Importer les fichiers WGSL via Vite avec `?raw`.
2. Creer un `GPUShaderModule` pour chaque shader.
3. Appeler `shaderModule.getCompilationInfo()`.
4. Echouer en dev/test si des messages de type `error` sont retournes.
5. Plus tard, ajouter une validation native Rust/wgpu/Naga pour le client lourd si necessaire.

API indicative cote TypeScript:

```ts
export async function validateWgslShader(device: GPUDevice, label: string, source: string): Promise<void> {
	const module = device.createShaderModule({ label, code: source });
	const info = await module.getCompilationInfo();
	const errors = info.messages.filter((message) => message.type === 'error');
	if (errors.length > 0) {
		throw new Error(formatWgslCompilationMessages(label, errors));
	}
}
```

Validation minimale attendue pendant `M6`:

- un shader WGSL valide passe;
- un shader WGSL invalide produit une erreur lisible;
- les messages indiquent au moins fichier/label, ligne et message compilateur quand disponibles.

Validation future cote Rust:

- utiliser le chemin `wgpu`/`naga` pour valider les memes sources WGSL dans le backend natif;
- conserver les kernels WGSL dans un format partageable entre TypeScript/WebGPU et Rust/wgpu;
- comparer les diagnostics quand ils different entre navigateur et backend natif.

Un preprocesseur WGSL ne sera evalue que si:

- plusieurs kernels dupliquent des blocs importants;
- les imports explicites Vite deviennent insuffisants;
- la factorisation manuelle nuit clairement a la maintenance;
- le futur backend Rust/wgpu peut consommer le meme format preprocessé.

## Datasets Compresses

### Etat Actuel

`rollupScripts/zipper.js`:

- parcourt chaque dossier de `datasets/`;
- lit tous les fichiers directs du dossier;
- produit un tableau JSON `{ name, text }[]`;
- compresse ce JSON avec `zlib.createDeflate({ level: 9 })`;
- ecrit le resultat dans `static/datasets/<datasetName>`;
- genere `static/datasets/datasets.json`.

L'application:

- fetch `datasets/datasets.json`;
- affiche les noms de datasets;
- fetch `datasets/<name>`;
- lit le contenu comme `ArrayBuffer`;
- transforme en `Uint8Array`;
- decompresse avec `pako.inflate`;
- parse le JSON en `IListFile[]`;
- reinjecte les fichiers dans l'application.

Conclusion: ce n'est pas seulement une optimisation de transfert. C'est un format applicatif de distribution des datasets.

### Decision Court Terme

Conserver un script de bundling datasets equivalent:

```text
scripts/build-datasets.*
```

La sortie devra rester compatible avec le chargeur historique tant que l'UI et le pipeline data ne sont pas remplaces.

Implementation `M2`:

- `scripts/build-datasets.mjs` remplace le hook Rollup `rollupScripts/zipper.js`.
- La commande `npm run build:datasets` genere `static/datasets/<datasetName>` et `static/datasets/datasets.json`.
- La commande `npm run build` execute `npm run build:datasets` avant `vite build`.
- Le format reste volontairement compatible avec le chargeur historique: tableau JSON `{ name, text }[]` compresse avec `zlib.deflate` niveau 9.
- `static/` reste ignore par Git parce que ces fichiers sont des artefacts generes.

### Alternatives A Evaluer Plus Tard

- Servir les CSV/GeoJSON directement et laisser l'hebergeur appliquer gzip/brotli.
- Produire un JSON compacte non deflate, puis s'appuyer sur compression HTTP.
- Produire un format de precalcul applicatif, plus proche des buffers qui alimenteront WebGPU.
- En client lourd Tauri, permettre le chargement direct d'un dossier dataset local.

Decision: ne pas changer le format dataset avant la definition du nouveau pipeline de precalcul.

## Assets Statiques

### Etat Actuel

`package.json#toCopy` declare:

- `src/toStatic/` vers `static/`;
- `markdown/assets/` vers `static/assets/`;
- `node_modules/bulma/css/bulma.css` vers `static/bulma.css`.

### Decision

Pour SvelteKit:

- deplacer les assets applicatifs stables dans `static/` quand c'est naturel;
- eviter de copier depuis `node_modules` si une import CSS Vite suffit;
- conserver un script `build:assets` seulement pour les copies non couvertes par Vite/SvelteKit.

## Documentation Developpeur

### Etat Actuel

Rollup lance `typedoc` pendant le build applicatif, puis deplace/reecrit certains fichiers HTML.

### Decision

Sortir la generation de documentation du build applicatif:

```bash
pnpm build:docs
```

La documentation ne doit pas etre une condition implicite du build de l'application, sauf en CI dediee.

## CSS Preparation

### Etat Actuel

`rollupScripts/cssPreparation.js` combine:

- PurgeCSS;
- PostCSS;
- autoprefixer;
- cssnano;
- suppression de commentaires.

### Decision

A reevaluer pendant la migration SvelteKit:

- si l'UI est reconstruite, ce script devient probablement obsolete;
- si Tailwind est adopte, son pipeline remplace une partie du besoin;
- Vite/PostCSS couvre deja une partie des transformations;
- la purge agressive doit etre evitee tant que les classes dynamiques ne sont pas inventoriees.

## Lint Dans Le Build

### Etat Actuel

Le hook Rollup lance:

```bash
eslint src --ext .ts --fix
```

### Decision

Supprimer ce comportement du build.

Le lint peut rester une commande separee, mais un build ne doit pas modifier le code source.

## Actions Pour M2

Avant ou pendant la migration SvelteKit:

- ajouter les declarations TypeScript pour `*.wgsl?raw`, puis `*.glsl?raw` si necessaire;
- prouver un import WGSL minimal dans Vite;
- creer un script `build:datasets` compatible avec le format actuel;
- ne pas migrer `glslify` tant que les passes GLSL ne sont pas explicitement conservees;
- remplacer l'injection `__SHADERS_HERE__` seulement au moment ou les modules concernes sont portes;
- documenter tout traitement Rollup supprime.

Etat `M2`:

- import WGSL minimal prouve avec `src/lib/compute/kernels/city-ned2ecef.wgsl?raw`;
- declarations TypeScript shader ajoutees dans `src/vite-env.d.ts`;
- compression datasets portee dans `scripts/build-datasets.mjs`;
- service worker Sapper supprime;
- Typedoc, CSS preparation et copie d'assets restent a reevaluer dans un jalon ulterieur.

## Validation M2.1

Ce jalon est valide lorsque:

- chaque traitement Rollup historique a une decision cible documentee;
- les shaders WGSL ont une strategie d'import claire;
- les shaders GLSL historiques ont une strategie temporaire claire;
- les datasets compresses ont une strategie de compatibilite claire;
- le build futur ne contient plus de hook qui modifie le code source implicitement.
