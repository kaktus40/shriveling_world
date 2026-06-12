# Architecture Du Precalcul Statique Des Villes

## Statut

Cette decision d'architecture est validee pour guider le remplacement de
`prepareStaticTownGeometry` de la branche `toBabylon`.

Le precalcul statique regroupe les invariants geometriques qui ne dependent ni
de l'annee affichee, ni de la representation finale. Il est recalcule lorsque
le dataset, le modele geodesique, le nombre de secteurs ou la strategie de
selection des voisins change.

## Principes Directeurs

### Trois profils conformes

Le pipeline expose trois implementations d'un meme contrat:

- le profil `WebGPU` maximise les calculs intensifs et constitue la cible de
  production pour les plateformes compatibles;
- le profil `WebGL2` constitue le fallback accelere de WebGPU et permet de
  conserver une execution massivement parallele sur les plateformes sans
  WebGPU;
- le profil `CPU` constitue la reference fonctionnelle, le dernier fallback et
  l'oracle des tests de conformite;

Les trois profils doivent produire les memes buffers, avec les memes strides,
unites, conventions d'indexation et tolerances numeriques. Le choix du profil
est porte par une strategie injectee. L'utilisateur peut forcer explicitement
`CPU` ou `WebGL2` si le profil est disponible; `WebGPU` reste la cible
preferee quand la plateforme le permet. Les fonctions metier ne doivent pas
multiplier les tests conditionnels par profil.

L'implementation de migration a deja commence dans `src/lib/compute/core` et
`src/lib/compute/cpu/backend.ts`, avec un backend CPU de reference et un
selecteur de profil capable de remonter les decisions de forçage ou de
fallback. Les futurs backends WebGL2 et WebGPU doivent reutiliser le meme
contrat de buffers et la meme logique de benchmark par etape.

La chaine de repli par defaut est:

```text
WebGPU -> WebGL2 -> CPU
```

Un choix explicite de `WebGL2` utilise `WebGL2 -> CPU`. Un choix explicite de
`CPU` ne tente aucun backend graphique.

Les mesures de benchmark doivent rester comparables par etape et par profil,
depuis les donnees d'entree jusqu'aux buffers de sortie, afin de pouvoir
evaluer separatement les couts d'ingestion, de preparation et de calcul.

Babylon.js n'intervient pas dans ces calculs. Il consomme uniquement les
buffers finaux necessaires au rendu.

### Architecture orientee donnees

Les grands tableaux compacts sont la source de verite. Les objets ville, paire,
voisin ou courbe sont des vues legeres qui conservent un index et lisent les
valeurs dans les tableaux partages.

Cette regle evite:

- la duplication des coordonnees et invariants dans de nombreux objets;
- les allocations dans les boucles intensives;
- la divergence entre donnees CPU, buffers WebGPU et donnees de rendu.

Les getters metier internes retournent les unites SI. Une conversion en degres
est autorisee uniquement dans un getter ou adaptateur destine a un humain.

## Ordre Stable Des Villes

L'ingestion CSV produit un ordre stable des villes et une table
`cityCode -> cityIndex`. Cet ordre est un contrat transversal utilise par tous
les buffers:

- `cityNed2EcefMatrices`;
- invariants des paires;
- association ville vers contour GeoJSON;
- limites par azimut;
- voisins retenus;
- arêtes et courbes.

Un changement d'ordre invalide tous les precalculs derives. Aucun kernel ne
doit reconstruire ou trier localement cet ordre.

## Contrats De Buffers

Tous les angles sont en radians et toutes les positions ECEF sont en metres.
Les strides sont exprimes en nombre de scalaires, jamais en octets.

### Invariants Par Ville

`cityNed2EcefMatrices: Float32Array`

- stride: `16`;
- index: `cityIndex * 16`;
- disposition: matrice colonne-major compatible WGSL;
- colonnes `0`, `1`, `2`: axes `North`, `East`, `Down`;
- colonne `3`: position ECEF de la ville en metres.

Le n-vector de la ville est derivable de la matrice par normalisation de la
position ECEF ou par negation de l'axe `Down`. Il ne doit donc pas etre
duplique par defaut dans un autre buffer.

### Invariants Des Paires Ordonnees

`cityPairInvariants: Float32Array`

- stride: `4`;
- index de paire: `pairIndex = cityAIndex * cityCount + cityBIndex`;
- disposition:
  `[forwardAzimuthRadians, reverseAzimuthRadians, angularDistanceRadians, 0]`;
- le quatrieme scalaire est reserve pour conserver un alignement `vec4<f32>`.

`cityPairSectorIndexes: Uint32Array`

- stride: `1`;
- meme `pairIndex`;
- valeur:
  `floor(forwardAzimuthRadians * sectorCount / TWO_PI)`;
- `sectorCount` est un parametre explicite et strictement positif.

Les paires diagonales `A == B` sont conservees pour garder une indexation
directe. Elles doivent etre ignorees par les reductions de voisinage.

### Voisins Pour Les Intersections

`overlapCandidates: Uint32Array`

- stride: `1`;
- disposition dense:
  `cityIndex * neighborLimit + candidateIndex`;
- contient le `cityIndex` du voisin;
- les emplacements inutilises portent une sentinelle documentee.

`overlapCandidateCounts: Uint32Array`

- stride: `1`;
- une valeur par ville;
- indique le nombre valide d'elements dans la zone dense correspondante.

La strategie initiale reproduit le comportement historique: repartition par
secteur, priorite aux villes les plus proches dans chaque secteur, redistribution
des places inutilisees, puis ordre final par azimut. Toute evolution de cette
strategie devra etre caracterisee separement, car elle peut changer le resultat
des intersections de cones.

La reference CPU est implementee dans
`src/lib/domain/precompute/cpu/overlap-cpu.ts`. Contrairement au tableau historique
`townOverlaps`, elle ne duplique pas les azimuts aller/retour et la demi-distance:
ces informations sont lues depuis `cityPairInvariants` avec le couple
`(cityIndex, neighborCityIndex)`.

`OverlapCandidateView` fournit cet acces sans recopier les valeurs dans les
objets metier.

### Courbes Limitees Aux Arêtes Connues

Les points de controle ne sont pas calcules pour les `N x N` paires. Ils sont
calcules uniquement pour les arêtes connues du reseau.

`curveEdgePairs: Uint32Array`

- stride: `2`;
- disposition: `[originCityIndex, destinationCityIndex]`;
- une entree par arête connue hors mode `Road`;
- une premiere implementation peut conserver plusieurs entrees geometriquement
  identiques lorsqu'elles correspondent a plusieurs modes ou arcs.

`curveControlPointsEcef: Float32Array`

- stride: `16`;
- disposition:
  `[Ax, Ay, Az, 1, Px, Py, Pz, 1, Qx, Qy, Qz, 1, Bx, By, Bz, 1]`;
- `A` et `B`: depart et arrivee;
- `P` et `Q`: points intermediaires definissant la courbe;
- toutes les positions sont ECEF en metres;
- les groupes de quatre scalaires permettent une lecture directe en
  `vec4<f32>` par WGSL et Babylon.js.

Cette strategie ramene le calcul des controles de courbes de `O(N²)` a `O(E)`,
ou `E` est le nombre d'arêtes connues. Elle est simple a implementer puisque
chaque invocation lit directement un couple d'indices de `curveEdgePairs`.

La reference CPU reproduit la construction historique:

- `M` est le midpoint normalise entre `A` et `B`;
- `P` est le midpoint normalise entre `A` et `M`;
- `Q` est le midpoint normalise entre `M` et `B`.

Une arête reliant deux villes antipodales est rejetee: son midpoint n'est pas
defini sans choisir arbitrairement un grand cercle. Une regle metier explicite
sera necessaire avant de supporter ce cas.

## Interface Commune Des Backends

Le contrat cible est conceptuellement le suivant:

```ts
interface StaticTownPrecomputeOptions {
  sectorCount: number;
  neighborLimit: number;
}

interface StaticTownPrecompute {
  cityCount: number;
  cityNed2EcefMatrices: Float32Array;
  cityPairInvariants: Float32Array;
  cityPairSectorIndexes: Uint32Array;
  overlapCandidates: Uint32Array;
  overlapCandidateCounts: Uint32Array;
  curveEdgePairs: Uint32Array;
  curveControlPointsEcef: Float32Array;
}

interface StaticTownPrecomputeBackend {
  readonly profile: 'webgpu' | 'webgl2' | 'cpu';
  compute(
    dataset: PreparedDataset,
    options: StaticTownPrecomputeOptions
  ): Promise<StaticTownPrecompute>;
  benchmark(
    dataset: PreparedDataset,
    options: StaticTownPrecomputeOptions,
    benchmarkOptions?: ComputeBenchmarkOptions
  ): Promise<StaticTownBenchmarkReport>;
}
```

L'orchestrateur selectionne le premier backend disponible et initialise avec
succes dans la chaine de repli demandee. Une erreur d'execution peut provoquer
un repli vers le profil suivant apres liberation des ressources du backend en
echec.

Les noms finaux pourront evoluer pendant l'implementation, mais les
responsabilites, unites et dispositions de buffers constituent le contrat a
preserver.

## Mesure Des Performances

Chaque backend doit mesurer les memes phases et le pipeline complet. Les
rapports utilisent des noms de phases stables afin de comparer CPU, WebGL2 et
WebGPU sur les memes datasets et options.

Chaque phase expose au minimum le temps bout-en-bout `wallClock`. Les backends
WebGL2 et WebGPU ajoutent un temps `device` lorsque les extensions ou timestamp
queries necessaires sont disponibles. Les rapports conservent minimum,
mediane, percentile 95 et maximum apres echauffement.

Les benchmarks distinguent l'execution chaude des couts d'initialisation,
compilation, upload et readback. Aucun seuil de vitesse dependant de la machine
n'est impose dans les tests unitaires.

## Profil CPU

Le profil CPU est implemente en fonctions pures et decoupe en phases testables:

1. `computeCityInvariantsCpu` construit `cityNed2EcefMatrices`.
2. `computeCityPairInvariantsCpu` calcule les azimuts, distances et secteurs
   pour toutes les paires ordonnees.
3. `selectOverlapCandidatesCpu` applique les reductions et la redistribution
   des quotas par secteur.
4. `computeCurveControlPointsCpu` calcule `[A, P, Q, B]` uniquement pour
   `curveEdgePairs`.

Ce profil doit rester disponible meme apres le portage WebGPU. Il permet les
tests Node.js, le diagnostic des kernels et l'execution sur une plateforme sans
WebGPU, avec une limite de taille de dataset explicite si necessaire.

Pendant cette phase de migration, seul le profil CPU est implemente. Il doit
stabiliser l'ensemble des contrats et comportements avant le debut des profils
WebGL2 et WebGPU.

Etat d'implementation:

- `computeCityInvariantsCpu`: implemente;
- `computeCityPairInvariantsCpu`: implemente;
- `selectOverlapCandidatesCpu`: implemente;
- `buildCurveEdgePairsCpu`: implemente;
- `computeCurveControlPointsCpu`: implemente.

## Profil WebGL2

Le profil WebGL2 reprend le principe de pseudo-compute deja employe dans
`toBabylon`: textures de donnees, fragment shaders, framebuffer et lecture des
sorties. Il ne doit toutefois pas reutiliser les anciens contrats de textures.
Il produit les memes buffers logiques que les profils CPU et WebGPU.

Ce backend est maintenu comme fallback accelere, pas comme architecture de
reference. Ses contraintes de taille de textures, formats flottants et
extensions disponibles doivent etre detectees avant son activation.

## Profil WebGPU

Le profil GPU utilise plusieurs dispatchs specialises dans une meme phase
d'orchestration WebGPU. Un dispatch monolithique rendrait les reductions,
barrieres et tests plus difficiles sans apporter de gain structurel.

### Dispatch 1: Invariants Des Villes

- grille: une invocation par `cityIndex`;
- entree: longitude/latitude en radians dans l'ordre stable des villes;
- sortie: `cityNed2EcefMatrices`.

Cette sortie est reutilisee par les dispatchs de paires, le raycast GeoJSON,
les cones et les courbes.

### Dispatch 2: Invariants Des Paires

- grille: `global_invocation_id.x = cityAIndex`,
  `global_invocation_id.y = cityBIndex`;
- entrees: `cityNed2EcefMatrices`, `cityCount`, `sectorCount`;
- sorties: `cityPairInvariants`, `cityPairSectorIndexes`.

Le shader derive les positions et n-vectors depuis les matrices. Il ne recoit
pas une copie supplementaire des coordonnees des villes.

### Dispatchs 3 Et 4: Reductions Des Voisins

- entree: invariants et secteurs des paires;
- traitement: selection des plus proches par secteur, redistribution des
  places libres, tri final par azimut;
- sorties: `overlapCandidates`, `overlapCandidateCounts`.

La reduction peut necessiter plusieurs dispatchs et buffers temporaires. Le
contrat de sortie reste identique au profil CPU.

### Dispatch 5: Controles Des Courbes

- grille: une invocation par entree de `curveEdgePairs`;
- entrees: `curveEdgePairs`, `cityNed2EcefMatrices`;
- sortie: `curveControlPointsEcef`.

Le calcul est volontairement limite aux arêtes connues. Aucun buffer
`N x N` de points P/Q n'est produit.

## Vues Et Getters

Les vues donnent une API lisible sans devenir une deuxieme source de verite:

```ts
class CityView {
  constructor(
    readonly cityIndex: number,
    private readonly cityNed2EcefMatrices: Float32Array
  ) {}

  get ecefXMeters(): number {
    return this.cityNed2EcefMatrices[this.cityIndex * 16 + 12];
  }
}
```

Les getters intensifs doivent retourner des scalaires ou ecrire dans un objet
fourni par l'appelant. Ils ne doivent pas creer de tableaux temporaires a
chaque lecture.

## Validation Attendue

Pour chaque phase, les tests de conformite executent le profil CPU puis les
profils WebGL2 et WebGPU disponibles avec les memes entrees, puis comparent:

- tailles, strides et indexations;
- matrices NED/ECEF;
- azimuts et distances angulaires avec tolerance explicite;
- indices de secteurs, qui doivent etre identiques;
- listes et comptes de voisins;
- points `[A, P, Q, B]` des arêtes connues.

Les jeux de test doivent inclure au minimum:

- une ville seule;
- deux villes;
- villes proches de l'antimeridien;
- villes proches des poles;
- azimuts situes sur une limite de secteur;
- secteurs vides necessitant une redistribution;
- arêtes orientees dans les deux sens;
- plusieurs arcs ou modes partageant le meme couple de villes.

## Hors Perimetre De Cette Decision

- les invariants dynamiques dependants de l'annee;
- la generation finale des sommets des cones et courbes;
- le rendu Babylon.js;
- une eventuelle deduplication des controles de courbes partages entre modes;
- le remplacement de la strategie historique de selection des voisins.
