# Contrat IHM Du Projet Web Et Rust

## But

Ce document fixe la repartition cible des controles visibles dans l application
web actuelle et dans la future implementation Rust, en partant de l inventaire
historique `dat.gui` de la branche principale.

Objectifs:

- repartir les controles dans des surfaces naturelles et lisibles;
- separer l usage quotidien de la calibration avancee;
- conserver une UX simple pour l application operationnelle;
- fournir une base de migration lisible pour le front web actuel et pour une
  implementation Rust future;
- eviter de reconstruire un panneau monolithique a la `dat.gui`.

## Principes De Conception

- Un controle ne change pas de place sans changer de responsabilite.
- Un controle de donnees, de calcul et de rendu ne doivent pas partager le meme
  regroupement visuel si leurs effets sont differents.
- Les controles qui impactent le precalcul vivent dans `workspace`.
- Les controles qui impactent surtout la lecture et la navigation vivent dans
  `app`.
- Les controles fins de calibration restent dans des panneaux avances, caches
  par defaut ou regroupes dans `workspace`.
- Les mutations structurelles declenchent une invalidation explicite.
- Les mutations purement visuelles re-renderisent seulement la scene.
- Les actions export/import restent des boutons explicites.

## Surfaces Cibles

### 1. `app`

Surface operationnelle quotidienne.

Elle doit rester simple:

- choix du dataset;
- choix de l annee;
- selection de la ville;
- navigation camera;
- affichage et bascule des couches metier;
- commandes de rendu simples et naturelles;
- export rapide si necessaire.

### 2. `workspace`

Surface d analyse, de benchmark et de validation.

Elle contient:

- inspection des datasets;
- comparaison des profils compute;
- comparaison des strategies d intersection;
- replays de bancs synthetiques;
- calibration geometrique et projetee;
- essais visuels techniques;
- export/import de jeux d analyse.

### 3. `advanced`

Surface de calibration avancee.

Elle regroupe les controles:

- de projection;
- de lumiere;
- de formes geometriques fines;
- de transparence;
- de densite d echantillonnage;
- de texte et labels;
- de maillage pays.

Cette surface peut etre affichee dans `workspace` et, quand cela a du sens, en
mode avance dans `app`.

## Contrat D Interaction

### Types De Controles

- `select`: choix discret parmi des options;
- `slider`: variation continue ou semi-continue;
- `checkbox`: bascule binaire;
- `color`: couleur hexadécimale ou triplet;
- `button`: action ponctuelle;
- `text`: saisie / import JSON;
- `toggle-group`: ensemble de boutons exclusifs;
- `range`: intervalle numerique borne;
- `file`: import / export fichier;
- `search`: selection d une entite a partir d une liste;
- `radio`: selection exclusive de mode.

### Regles De Recalcul

- changement de dataset:
  - invalide le snapshot de travail;
  - relance le chargement complet;
  - preserve les preferences d interface si elles sont encore compatibles.
- changement d annee:
  - relance le calcul interactionnel;
  - ne relit pas le dataset;
  - ne reconstruit pas le graphe de base.
- changement de ville:
  - re-centre la vue;
  - ne relance pas le precalcul.
- changement de profil compute ou de strategie:
  - reexecute le pipeline de benchmark / validation;
  - conserve le snapshot dataset.
- changement purement visuel:
  - met a jour la scene;
  - ne modifie pas le precalcul.

### Regles D Ergonomie

- Les panneaux `app` doivent apparaitre au survol ou via un geste explicite.
- Les panneaux `workspace` peuvent rester visibles plus longtemps car ils
  servent a l analyse.
- Les sous-groupes doivent porter un titre court et stable.
- Un sous-groupe ne doit pas contenir plus d une dizaine de controles visibles
  si un decoupage plus clair est possible.
- Les noms de champs doivent privilegier le vocabulaire metier plutot que les
  noms techniques historiques.
- Les valeurs par defaut doivent provenir du snapshot ou du dataset, pas d un
  chiffre arbitraire dans la vue.

## Inventaire Exhaustif Et Distribution

Le tableau suivant reprend les controles historiques de `dat.gui`, leur
destination cible et leur comportement attendu.

### A. Navigation, Scene Et Selection

| Controle historique | Destination cible | Interaction attendue | Statut |
| --- | --- | --- | --- |
| dataset | `app` > `Data` | selection immediate du dataset; recharge du snapshot; reset des selections invalides | repris |
| year | `app` > `Navigation` | changement d annee sans relecture du dataset; mise a jour du rendu et du calcul interactif | repris |
| city selection | `app` > `Navigation` | selection d une ville par liste et par picking; recentrage de la camera | repris |
| show cities name | `app` > `Display` | bascule d affichage des labels de villes; ne declenche pas de recalcul | a reprendre |
| taille du texte | `app` > `Display` / `advanced` | ajuste l echelle des labels; met a jour uniquement les meshes texte | a reprendre |
| text color | `app` > `Display` / `advanced` | change la couleur des labels; rendu immediat | a reprendre |
| camera mode (`orbit`, `inspect`, `free`) | `app` > `Navigation` | selection exclusive de mode; keyboard shortcuts synchrones | repris |
| zoom souris / `+/-` | `app` > `Navigation` | zoom immediat dans les bornes de la camera | repris |
| picking de ville | `app` > `Navigation` | clic sur un marqueur de ville; selection et focus de la ville | repris |
| reset scene | `app` > `Navigation` | remet la scene a l etat selectionne par le snapshot | repris |

### B. Lumiere Et Atmosphere

| Controle historique | Destination cible | Interaction attendue | Statut |
| --- | --- | --- | --- |
| light color | `advanced` > `Scene` | modifie la couleur de la lumiere principale en direct | a reprendre |
| ambient color | `advanced` > `Scene` | modifie la couleur ambiante de la scene | a reprendre |
| light intensity | `advanced` > `Scene` | modifie l intensite de la lumiere principale; rendu immediat | a reprendre |
| ambient intensity | `advanced` > `Scene` | modifie l intensite hemispherique | a reprendre |
| light position x/y/z | `advanced` > `Scene` | deplace la source lumineuse; update de la scene | a reprendre |
| shadow map size width/height | `advanced` > `Scene` | ajuste la resolution des ombres si elles sont actives | a reprendre |
| shadow camera near/far | `advanced` > `Scene` | ajuste le frustum des ombres; pas de recalcul metier | a reprendre |

### C. Projection Et Repere

| Controle historique | Destination cible | Interaction attendue | Statut |
| --- | --- | --- | --- |
| z coefficient | `workspace` > `Projection` / `advanced` | parametre de calibration; met a jour la transformation sans relire les donnees | a reprendre |
| longitude de reference | `workspace` > `Projection` | change le meridien de reference; peut invalider les couches dependantes de projection | a reprendre |
| latitude de reference | `workspace` > `Projection` | change le parallele / reference; recalcul des transforms projetees | a reprendre |
| hauteur de reference | `workspace` > `Projection` | change l altitude de reference; recalcul des transforms projetees | a reprendre |
| standard parallel 1 | `workspace` > `Projection` | ajuste la projection conique; recalcul immediat des donnees projetees | a reprendre |
| standard parallel 2 | `workspace` > `Projection` | ajuste la projection conique; recalcul immediat des donnees projetees | a reprendre |
| projection initiale | `workspace` > `Projection` | selection du mode de projection de depart | a reprendre |
| projection finale | `workspace` > `Projection` | selection du mode de projection cible | a reprendre |
| percent transition | `workspace` > `Projection` | interpolation entre deux representations; recalcule la geometrie visible | a reprendre |
| orthographic / perspective swap | `app` > `Display` ou `workspace` > `Projection` | bascule de camera / representation selon le contexte | a reprendre |

### D. Cotes Cones

| Controle historique | Destination cible | Interaction attendue | Statut |
| --- | --- | --- | --- |
| coneStep | `workspace` > `Cones` | pas angulaire de balayage; relance les calculs de cones si la resolution change | repris conceptuellement, UI a finaliser |
| discriminant | `workspace` > `Cones` > `Advanced` | seuil ou variation de forme; impact scientifique direct | a reprendre |
| with limits | `workspace` > `Cones` / `app` > `Layers` | active ou non la limitation par les frontieres; peut refaire le calcul des cones finaux | repris conceptuellement, UI a finaliser |
| conesShape | `workspace` > `Cones` | choix de la forme de cone; impacte la generation geometrique | a reprendre |
| cones color | `app` > `Display` / `workspace` > `Preview` | change la couleur de la couche cones; rendu immediat | a reprendre |
| cones transparency | `app` > `Display` / `workspace` > `Preview` | change l opacite des cones; rendu immediat | a reprendre |
| transport type | `workspace` > `Cones` | filtre ou selection de mode de transport; reconstruit la couche si necessaire | a reprendre |
| cone opacity | `app` > `Display` | opacite de la couche cones | a reprendre |
| cone discriminant (historique material) | `workspace` > `Cones` > `Advanced` | parametre de calibration; conserve une signification explicite | a reprendre |

### E. Cotes Courbes

| Controle historique | Destination cible | Interaction attendue | Statut |
| --- | --- | --- | --- |
| curve color | `app` > `Display` / `workspace` > `Preview` | change la couleur de la couche courbes; rendu immediat | a reprendre |
| curve transparency | `app` > `Display` / `workspace` > `Preview` | change l opacite des courbes | a reprendre |
| pointsPerCurve | `workspace` > `Curves` | densite d echantillonnage; relance la geometrie de courbes | repris conceptuellement, UI a finaliser |
| curvesPosition | `workspace` > `Curves` / `app` > `Display` | position relative des courbes par rapport au cone; recalcule la geometrie finale | repris conceptuellement, UI a finaliser |

### F. Cotes Pays

| Controle historique | Destination cible | Interaction attendue | Statut |
| --- | --- | --- | --- |
| countries show | `app` > `Layers` / `workspace` > `Preview` | active ou desactive la couche pays | a reprendre |
| countries opacity | `app` > `Display` / `workspace` > `Preview` | change la transparence du maillage pays | a reprendre |
| countries extruded | `workspace` > `Countries` | change l extrusion / relief; peut reclencher la preparation de maillage | a reprendre |
| export country | `workspace` > `Export` / `advanced` | export de la geometrie pays ou du conteneur de rendu | a reprendre |

### G. Cotes Requete Et Donnees

| Controle historique | Destination cible | Interaction attendue | Statut |
| --- | --- | --- | --- |
| transport mode / transport type | `workspace` > `Query` / `Analysis` | selection du mode ou du filtre de transport; alimente le requeteur AST | a reprendre |
| query tree editor | `workspace` et `app` > `Query` | edition recursive de l AST; insertion, suppression, deplacement de noeuds | repris |
| query snapshot fields | `workspace` > `Query` | liste des champs disponibles dans le snapshot; lecture seule | repris |
| query execution result | `workspace` > `Query` | resultat de l execution; lecture seule et benchmarkable | repris |

### H. Export, Debug Et Validation

| Controle historique | Destination cible | Interaction attendue | Statut |
| --- | --- | --- | --- |
| export country / scene export | `workspace` > `Export` | export explicite de la geometrie ou d un sous-ensemble; ne change pas la scene | a reprendre |
| replay import/export | `workspace` > `Analysis` | import et export du banc synthetique et du sweep alpha-aware | repris |
| benchmark profile selection | `workspace` > `Benchmark` | selection du profil compute a mesurer; change la source de benchmark | repris |
| intersection strategy selection | `workspace` > `Benchmark` | selection de la strategie cone/cone; compare les variantes | repris |
| synthetic dataset generator | `workspace` > `Analysis` | genere des villes libres et des listes azimut/alpha; peut etre rejoue | repris |

## Distribution Recommandee Par Surface

### `app`

Regrouper:

- `Data`:
  - dataset;
  - annee;
  - ville;
  - import rapide si present.
- `Navigation`:
  - camera mode;
  - zoom;
  - picking;
  - reset;
  - deplacement de selection.
- `Layers`:
  - cities names;
  - boundary;
  - final cones;
  - curves;
  - countries.
- `Display`:
  - opacite;
  - couleurs de couche;
  - taille texte;
  - bascule orthographique si maintenue.

### `workspace`

Regrouper:

- `Dataset`:
  - selection;
  - inspection;
  - chargement.
- `Benchmark`:
  - profil compute;
  - strategie d intersection;
  - sweep alpha-aware;
  - replay.
- `Projection`:
  - reference longitude / latitude / hauteur;
  - projection initiale / finale;
  - transition;
  - z coefficient.
- `Cones`:
  - coneStep;
  - discriminant;
  - with limits;
  - conesShape;
  - transport type.
- `Curves`:
  - pointsPerCurve;
  - curvesPosition;
  - curve style.
- `Countries`:
  - show;
  - opacity;
  - extrusion;
  - export.

### `advanced`

Utiliser pour:

- lumiere / ombres;
- calibration des projections;
- stylage fin des labels;
- reglages de rendu non essentiels au flux quotidien.

## Interactions Attendues Par Domaine

### Dataset

- Choisir un dataset recharge tout le snapshot.
- Si le dataset change, toutes les selections derivables sont revalidees.
- Les prefs d interface peuvent survivre, mais seulement si le nouveau snapshot
  les accepte.

### Annee

- Changer l annee met a jour le calcul interactif.
- Le dataset n est pas relu.
- L annee peut etre pilotable au clavier dans `app`.

### Ville

- La selection de ville recentre la camera.
- Le picking et la liste restent synchronises.
- La ville selectionnee devient le point d attention de la scene.

### Projections

- Toute modification geometrique de projection met a jour les couches projetees.
- Les controles de projection appartiennent a la calibration, pas au rendu brut.
- Le changement de repere doit etre visible immediatement pour que le retour
  utilisateur soit intuitif.

### Couches Metier

- Les couches boundary, cones finaux et courbes doivent pouvoir etre affichees
  ou masquees independamment.
- Les couleurs et opacites modifient seulement le rendu.
- Les couches n ont pas a recomputer les donnees si seul le style change.

### Cones Et Courbes

- Les variations de resolution, de forme et de densite d echantillonnage
  relancent les calculs derives concernes.
- Les modifications de style ne doivent pas toucher le calcul.
- Les positions de courbes peuvent changer la geometrie finale si elles
  depassent le simple style.

### Pays

- L affichage des pays doit pouvoir etre coupe sans affecter le calcul cones.
- L extrusion reste un choix de representation.
- L export pays est un acte explicite.

### Requetes

- Le requeteur reste partage entre `workspace` et `app`.
- La modification de l arbre AST ne doit pas coupler la vue au moteur de calcul.
- L execution du requeteur doit rester visible et reproductible.

## Recommandation De Mise En Oeuvre

1. Garder `app` simple et orientee usage quotidien.
2. Mettre les reglages fins dans `workspace` ou `advanced`.
3. Extraire chaque groupe de controles dans un composant Svelte dedie.
4. Garder un etat TypeScript partage par domaine, pas un grand store global.
5. Utiliser des noms stables et explicites pour faciliter la portabilite Rust.
6. Ne pas reconstruire de panneau monolithique a la `dat.gui`.

## Usage Pour Le Web Et La Migration Rust

Ce document sert de base au front web actuel et au futur portage Rust parce
qu il fixe:

- les groupes fonctionnels;
- les interactions attendues;
- les effets de bord admis;
- les surfaces de responsabilite;
- les controles a conserver, a simplifier ou a masquer.

Le front web peut donc reconstituer:

- les panneaux Svelte;
- les menus de scene;
- les controles de rendu;
- les couches metier;
- les interactions clavier / souris;
- les exports.

Le portage Rust pourra ensuite reconstituer:

- le modele d etat;
- les panneaux de controle;
- les evenements;
- les effets de recalcul;
- les exports;
- sans depender de l ancienne structure `dat.gui`.
