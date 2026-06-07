# Strategie De Tests De Migration

Ce document definit la strategie de tests cible pour la migration SvelteKit, Babylon.js et WebGPU.

Il ne fige pas encore tous les attendus metier definitifs. Il precise les niveaux de verification necessaires pour accompagner la migration et comparer progressivement les implementations CPU et GPU.

## Objectifs Haut Niveau

La strategie de tests doit garantir:

- la non-regression des invariants deja compris dans le projet historique;
- la tracabilite des decisions de migration;
- la comparaison entre les profils CPU, WebGL2 et WebGPU;
- la mesure de leurs performances par phase et pour le pipeline complet;
- la verification stricte des unites internes en systeme international;
- la validation des contrats de buffers consommes par les shaders;
- la capacite a tester des datasets reduits et reproductibles;
- la distinction entre caracterisation de l'existant et validation d'un comportement attendu.

## Principes

### Cible De Runner De Tests

La migration de la pile de tests vise a standardiser:

- `Vitest` pour les tests unitaires, d'integration et de conformance CPU;
- `Playwright` pour les tests E2E et de rendu interactif;
- `tsx --test` comme pont temporaire tant que la migration des scripts n'est
  pas terminee.

`node:test` reste compatible a court terme, mais il n'est plus la cible finale
de la migration.

### Reference CPU Avant Les Profils Graphiques

Toute passe de calcul WebGL2 ou WebGPU doit avoir une implementation CPU de
reference lorsque c'est raisonnable.

La CPU n'est pas la cible de performance. Elle sert a:

- exprimer l'algorithme de maniere lisible;
- produire des resultats deterministes;
- tester les cas limites;
- comparer les buffers produits par WebGPU avec tolerance numerique;
- diagnostiquer les erreurs sans dependance au runtime GPU.

### Tests De Contrat Avant Tests De Rendu

Les tests doivent d'abord verifier les contrats de donnees:

- structure des tables inspectees;
- ordre des villes;
- index denses;
- strides de buffers;
- unites internes;
- tailles de buffers;
- diagnostics attendus.

Les tests visuels ou de rendu viennent ensuite. Ils ne doivent pas etre la premiere ligne de defense.

### Caracterisation Et Validation Sont Separees

La caracterisation enregistre ce que le code ou les datasets produisent actuellement.

La validation verifie ce que le projet decide comme comportement attendu.

Exemple:

- un rapport de caracterisation peut dire qu'un fichier contient certaines colonnes;
- un test de validation doit dire quelles colonnes caracteristiques sont obligatoires pour reconnaitre un type de table.

### Unites SI Par Defaut

Les tests doivent refuser les ambiguïtés d'unites:

- longitude et latitude internes en radians;
- distances internes en metres;
- angles d'azimut en radians;
- ECEF en metres;
- conversions degres -> radians uniquement aux frontieres d'import ou d'interface humaine.

### Invariants Scientifiques De L'Angle Alpha

Les tests numeriques doivent verifier le contrat documente dans
`docs/scientific-model-alpha-and-dynamic-cones.md`:

- `alpha = atan(sqrt((maximumSpeed / ambientSpeed)^2 - 1))`;
- `cos(alpha) = ambientSpeed / maximumSpeed`;
- une vitesse plus elevee produit un alpha plus faible;
- une vitesse egale a `maximumSpeed` produit `alpha = 0`;
- `roadAlpha` est la pente par defaut;
- le minimum alpha selectionne le mode terrestre actif le plus rapide;
- aucun alpha local ne depasse `roadAlpha` a cause d'une liaison plus lente;
- les listes dynamiques utilisent `offset + count`, jamais des bornes
  inclusives ambigues.

## Niveaux De Tests

### Niveau 0: Validations Techniques

But: verifier que le socle technique compile et se construit.

Commandes actuelles:

```sh
npm run build
npm run validate
```

Etat actuel:

- `npm run build` est la validation bloquante principale;
- `npm run validate` reste affecte par le code legacy non encore porte et ne peut pas encore etre bloquant globalement.

Evolution cible:

- rendre `npm run validate` bloquant lorsque le legacy aura ete isole ou porte;
- migrer la commande `npm test` vers Vitest pour les tests automatises CPU;
- ajouter une commande separee pour les tests WebGPU et les comparaisons de
  conformance lorsque l'environnement le permettra;
- introduire Playwright pour les tests E2E et de rendu interactif lorsque la
  couche UI sera suffisamment stable.

### Niveau 1: Caracterisation Dataset

But: conserver une photographie des datasets et des fixtures reduites.

Actuel:

```sh
npm run characterize:datasets
```

Ce niveau doit verifier:

- detection des fichiers independamment de leur nom;
- classification par colonnes caracteristiques;
- presence des fichiers primaires attendus;
- conservation des fichiers d'enrichissement;
- diagnostics sur les fichiers inconnus ou ambigus.

Ce niveau ne doit pas presumer les colonnes metier libres ajoutees par les utilisateurs.

### Niveau 2: Tests Unitaires CPU Purs

But: tester les fonctions pures sans DOM, SvelteKit, Babylon.js, WebGL ou WebGPU.

Modules concernes actuellement:

- `src/lib/domain/data`;
- `src/lib/domain/geojson`;
- `src/lib/shared`.

Exemples de tests:

- conversion degres -> radians a la frontiere GeoJSON;
- ouverture de rings GeoJSON;
- densification de contour;
- point dans polygone;
- generation des points internes Fibonacci;
- conversion lon/lat radians vers n-vector;
- construction de `NED2ECEF`;
- calcul de grand cercle;
- test d'azimut dans un intervalle continu.

Runner recommande:

- `Vitest` comme cible finale pour les tests unitaires et d'integration;
- `node:test` seulement comme solution de transition si un sous-ensemble du
  code doit encore rester independant du runner principal.

Raison du choix initial:

- integration naturelle avec SvelteKit et Vite;
- support plus adapte aux fixtures, aux snapshots et a la structure multi-
  projets de la migration;
- execution rapide;
- compatible avec TypeScript;
- meilleur alignement avec les besoins futurs de conformance CPU/GPU.

### Niveau 3: Tests De Contrat De Buffers

But: verifier que les buffers produits ont le format attendu par les calculs CPU puis WGSL.

Contrats a verifier:

- `countryContourBuffer`: stride 2, `[longitudeRadians, latitudeRadians]`;
- `countryContourNVectorBuffer`: stride 4, `[x, y, z, padding]`;
- `countryContourOffsets`: offset par contour;
- `countryContourSizes`: taille par contour;
- `cityContourIndexes`: index par ordre de ville;
- `townCountryIndexes`: index par `cityId` lorsque necessaire;
- `cityNed2EcefMatrices`: stride 16, column-major;
- `cityPairInvariants`: stride 4, azimuts aller/retour et distance angulaire;
- `cityPairSectorIndexes`: stride 1;
- `overlapCandidates`: indices de villes, ordre par azimut;
- `overlapCandidateCounts`: nombre de voisins retenus par ville;
- `curveEdgePairs`: stride 2, arêtes connues dans l'ordre prepare;
- `curveControlPointsEcef`: stride 16, quatre points alignes `[A, P, Q, B]` en
  ECEF metres;
- `azimuthIntervals`: stride 2, `[minRadians, maxRadians]`;
- `townBoundaryAngular`: stride 4;
- `townBoundaryEcef`: stride 4.

Ces tests doivent rester indépendants du rendu.

### Niveau 4: Tests De Reference CPU Des Limites

But: figer des cas geometriques simples pour la fonction CPU qui remplacera `boundaryAlgebre.frag`.

Cas minimaux a couvrir:

- carre avec ville au centre;
- carre avec ville excentree;
- polygone non carre;
- polygone concave simple;
- ville proche d'une frontiere;
- ville hors contour;
- plusieurs villes dans le meme contour;
- plusieurs contours;
- `cityId` different de l'ordre ville;
- intervalles d'azimut continus avec bornes negatives, par exemple `[-1 deg, 1 deg]` converti en radians.

Invariants a verifier:

- `validIntersection = 1` quand une intersection est attendue;
- `validIntersection = 0` quand aucune intersection exploitable n'existe;
- distance angulaire positive pour une ville strictement a l'interieur;
- coordonnees de sortie en radians;
- ECEF en metres;
- intersection sur ou tres proche du contour attendu;
- diagnostics presents pour les villes sans contour.

Ces tests ne doivent pas chercher une exactitude geodesique parfaite pour des polygones artificiels. Ils doivent verifier les invariants robustes et la coherence CPU/GPU future.

### Niveau 5: Tests De Conformite CPU/WebGL2/WebGPU

But: comparer les sorties WebGL2 et WebGPU avec la reference CPU.

Principe:

1. Construire les memes entrees compactes pour CPU et GPU.
2. Executer la reference CPU.
3. Executer les passes WebGL2 et WebGPU disponibles.
4. Comparer les buffers avec tolerance.

Comparaisons:

- `townBoundaryAngular`;
- `townBoundaryEcef`;
- futurs buffers de cones bruts;
- intersections cone/cone;
- clipping par frontiere;
- courbes finales.

Tolerance initiale proposee:

- angles: `1e-5` radians pour les premiers tests;
- ECEF: tolerance relative ou absolue a definir selon l'echelle;
- flags et index: egalite stricte.

La tolerance devra etre resserree ou justifiee apres caracterisation des kernels WGSL.

### Niveau 5.1: Benchmarks Des Profils De Calcul

But: mesurer la vitesse de computation des profils CPU, WebGL2 et WebGPU pour
chaque phase equivalente et pour le pipeline complet.

Les benchmarks sont separes des tests unitaires:

- les tests unitaires verifient que les rapports contiennent les phases,
  scopes et statistiques attendus;
- les benchmarks enregistrent les performances reelles sans imposer de seuil
  bloquant dependant de la machine;
- des budgets de regression pourront etre introduits plus tard sur une machine
  de reference et un environnement controle.

Chaque rapport doit contenir:

- le profil utilise;
- les caracteristiques utiles de l'environnement;
- le dataset et le nombre de villes/arêtes;
- le nombre de secteurs et les autres parametres de calcul;
- le nombre d'iterations d'echauffement et de mesure;
- pour chaque phase: minimum, mediane, percentile 95 et maximum;
- une mesure `total` couvrant le pipeline complet.

Scopes temporels:

- `wallClock`: temps bout-en-bout observe par l'application;
- `device`: temps GPU obtenu par timestamp queries lorsqu'elles sont
  disponibles;
- l'absence de timestamp queries doit etre explicite et ne doit pas invalider
  la mesure `wallClock`.

Pour WebGL2 et WebGPU, le rapport doit distinguer clairement:

- initialisation du backend et compilation des shaders;
- upload des entrees;
- execution des passes;
- readback eventuel;
- execution chaude sans recompilation.

La comparaison principale des calculs recurrents utilise l'execution chaude.
Une mesure bout-en-bout incluant initialisation et transferts reste necessaire
pour evaluer le temps reel de chargement d'un dataset.

Les premiers noms de phases stables sont:

- `city-invariants`;
- `city-pair-invariants`;
- `overlap-reduction`;
- `curve-controls`;
- `total`.

Ils seront completes par le raycast des limites et les passes de cones au fur
et a mesure de leur implementation.

### Niveau 6: Tests D'Integration Pipeline

But: verifier l'enchainement complet sur fixtures reduites.

Scenarios:

- charger fixture Europe reduite;
- charger fixture Monde reduite;
- assembler `BaseNetwork`;
- produire `PreparedDataset`;
- produire les buffers statiques;
- changer d'annee sans relancer l'ingestion;
- changer de representation sans relancer les precalculs invariants;
- verifier que les diagnostics sont explicites.

Ces tests doivent s'appuyer sur les datasets reduits deja crees dans `tests/fixtures`.

### Niveau 7: Tests Rendu Et E2E

But: verifier que l'application integre correctement les resultats.

Ces tests seront utiles apres stabilisation Babylon.js/WebGPU.

Exemples:

- chargement de l'application;
- affichage de la scene;
- selection d'un dataset reduit;
- changement d'annee;
- changement de representation;
- presence des couches pays, villes, cones et courbes.

Runner possible:

- Playwright comme cible pour les tests E2E et de rendu.

Raison:

- les contrats de calcul ne sont pas encore stabilises;
- les tests de rendu seraient couteux et fragiles au stade actuel.

## Strategie CPU/GPU Pour Les Limites GeoJSON

La fonction CPU `computeTownBoundaryLimitsCpu` devient la reference initiale.

Le futur kernel WGSL devra consommer les memes entrees:

- `cityNed2EcefMatrices`;
- `cityContourIndexes`;
- `countryContourNVectorBuffer`;
- `countryContourOffsets`;
- `countryContourSizes`;
- `azimuthIntervals`;
- constantes globales partagees.

Le test de conformite devra verifier que:

- le nombre de sorties est identique;
- les flags de validite sont identiques;
- les distances angulaires sont proches;
- les positions cartographiques sont proches modulo les discontinuites de longitude;
- les positions ECEF sont proches en metres.

## Organisation Proposee Des Tests

Structure cible:

```txt
tests/
  unit/
    shared/
    data/
    geojson/
  characterization/
  fixtures/
  conformance/
    cpu-gpu/
  integration/
```

Commandes cible:

```json
{
  "test": "vitest run tests/unit/**/*.test.ts",
  "test:characterize": "npm run characterize:datasets",
  "test:conformance": "vitest run tests/conformance/**/*.test.ts",
  "test:integration": "vitest run tests/integration/**/*.test.ts"
}
```

Les commandes exactes seront introduites progressivement pour eviter de rendre
bloquants des pans legacy non portes. Tant que la migration n'est pas terminee,
`tsx --test` peut rester en usage interne sur certains scripts transitoires.

## Priorites De Mise En Place

Priorite 1:

- tests unitaires `src/lib/shared`;
- tests unitaires `src/lib/domain/geojson`;
- tests de contrat des buffers GeoJSON;
- tests CPU des limites sur polygones simples.

Priorite 2:

- suite `npm run test:integration` implementee pour M3.1;
- chaine `SourceFile[] -> DatasetManifest -> BaseNetwork -> PreparedDataset`
  couverte sur fixture analytique et fixtures reduites Europe/Monde;
- permutation de l'ordre des fichiers avec manifest, reseau et buffers
  prepares identiques;
- conservation lossless des colonnes libres et des lignes orphelines;
- diagnostics de manifest incomplet, ambigu ou contradictoire;
- diagnostics de noms sources dupliques, identifiants dupliques, valeurs
  invalides et references absentes.

Priorite 3:

- tests de conformite CPU/GPU pour le raycast de frontiere;
- tests de conformite CPU/GPU pour les cones.

Reference CPU dynamique deja couverte:

- activation inclusive des arêtes par annee;
- arêtes sans borne temporelle;
- emission bidirectionnelle;
- exclusion des modes non terrestres et de Road;
- selection du minimum alpha par destination;
- bornage des modes plus lents par `roadAlpha`;
- tri des liens par azimut;
- continuite stricte de `offset + count`;
- generation du span historique complet;
- mesure separee d'une annee et du span complet.

Reference CPU des cones bruts deja couverte:

- formes Road, reguliere selon le mode terrestre le plus rapide et complexe;
- alpha exact dans la direction d'un lien;
- retour a Road au-dela de la zone d'influence;
- interpolation circulaire autour de `0/2 PI`;
- tolerance des bornes compatible avec les futurs calculs Float32 GPU;
- transformation NED vers ECEF en metres;
- layout `vec4<f32>` du bord brut;
- rejet des tailles, longueurs et attenuations invalides;
- benchmark distinct de la selection des alphas et de la geometrie complete.

Plan de tests des intersections a implementer:

- oracle exhaustif sur toutes les faces des seuls voisins statiques;
- verification du rayon symetrique
  `phiB0 = wrapPositive(gammaBA - wrapSigned(phiA - gammaAB))`;
- mesure de la priorite de parcours `phiB0 -> gammaBA`;
- cones complexes presentant plusieurs minima locaux;
- comparaison de l'heuristique droite/gauche avec l'oracle;
- comparaison du filtre par intervalle d'azimuts avec l'oracle;
- comparaison de la BVH circulaire avec l'oracle;
- comparaison d'une BVH circulaire a blocs fixes avec une BVH alignee sur les
  intervalles monotones d'alpha;
- verification que le signe de variation d'alpha n'est jamais utilise seul
  comme critere d'arret;
- mesure des violations de monotonie de `t` sur chaque intervalle monotone
  d'alpha;
- comparaison des lois d'attenuation interpolant `alpha`, `cos(alpha)` et
  `tan(alpha)` sans modifier la loi de production avant validation;
- cas sans support rapide dans le voisinage bilateral de `phiB0`;
- support rapide uniquement du cote du couloir `phiB0 -> gammaBA`;
- support rapide uniquement du cote oppose mais proche de `phiB0`;
- supports rapides presents des deux cotes de `phiB0`;
- support rapide eloigne produisant malgre tout le minimum global;
- Moller-Trumbore double face sur sommets, arêtes et interieur des faces;
- cas Float32 au passage `0/2 PI`;
- longueurs globales et locales de cones;
- reduction `min(rawT, coneIntersectionT, countryBoundaryT)`;
- comparaison d'une passe WebGPU fusionnee avec les fonctions CPU separees.

Reference CPU d'intersection deja couverte:

- Moller-Trumbore double face et independant de l'ordre des sommets;
- rejet des intersections derriere l'origine ou au-dela du bord brut;
- oracle limite aux voisins statiques mais exhaustif sur leurs faces;
- conservation du bord brut lorsqu'aucune face ne coupe le rayon;
- sorties de diagnostic: voisin gagnant, face gagnante et faces testees;
- validation des tailles et index des buffers partages;
- benchmark de la phase `cone-intersection-exhaustive`.
- parcours symetrique exhaustif sans elimination de faces;
- egalite stricte des distances et positions entre ordre symetrique et oracle;
- choix deterministe du voisin et de la face sur une intersection partagee;
- ordre de decouverte de la face gagnante;
- benchmark `cone-intersection-symmetric-order` avec moyenne, p95 et maximum
  de l'ordre de decouverte.
- classification circulaire des faces touchant un support
  `alpha < roadAlpha`;
- construction de la fourchette prioritaire alpha-aware avec couloir court,
  faces de bord et voisinage bilateral configurable;
- verification que chaque face apparait exactement une fois dans le parcours;
- egalite stricte entre la strategie alpha-aware exhaustive et l'oracle;
- diagnostics de taille de fourchette, faces rapides prioritaires et face
  gagnante dans ou hors fourchette;
- benchmark `cone-intersection-alpha-aware-order`.

Benchmarks obligatoires:

- duree totale et par strategie;
- moyenne et p95 des faces testees par rayon/voisin;
- moyenne et p95 des blocs visites;
- taux de rejet des voisins et blocs;
- proportion du minimum trouve entre `phiB0` et `gammaBA`;
- nombre d'intersections manquees;
- erreur maximale et p95 sur la distance `t`;
- cout de l'ecriture de `ciseledConeRimEcef`;
- cout de la fusion du clipping pays.
- cout de construction des intervalles monotones d'alpha;
- cout de construction des BVH fixe et consciente d'alpha;
- position moyenne et p95 de la face gagnante dans l'ordre de parcours;
- correlation entre le sens suggere par la variation d'alpha et la variation
  effectivement observee de `t`;
- nombre de minima locaux de `t` par intervalle monotone d'alpha;
- comparaison de forme et de performance des trois lois d'attenuation.
- sensibilite a la largeur du voisinage bilateral de `phiB0`, en radians et
  en nombre de faces;
- proportion des faces Road regroupees en blocs et proportion des supports
  rapides ajoutes a la fourchette prioritaire;
- temps de calcul cone/cone sans cache;
- temps de reutilisation d'un `coneIntersectionDistanceMeters` en cache;
- temps de reconstruction ECEF depuis le cache;
- taux de hit lors d'un scenario de navigation entre annees;
- consommation memoire pour 1, 5, 10 et toutes les annees consultees;
- verification que les benchmarks de strategies de filtration contournent le
  cache afin de rester comparables.

Plan de tests du cache d'instance:

- cache vide a la creation de l'application;
- cache indexe uniquement par annee dans le dataset courant;
- cache hit reutilisant exactement le meme `Float32Array`;
- changement de dataset vidant toutes les annees;
- activation et desactivation des limites pays sans invalidation;
- reconstruction des positions ciselees depuis sommet, direction brute et `t`;
- contrat fixe de `360` distances par ville;
- aucune persistance entre deux instances applicatives.

Priorite 4:

- tests E2E rendu Babylon.js.

## Definition De Done Pour Un Jalon De Migration

Un jalon est validable lorsque:

- les contrats modifies sont documentes;
- les tests unitaires ou caracterisations correspondants existent;
- les validations applicables passent;
- les limites connues sont documentees;
- le commit contient code, documentation et tests du jalon.
