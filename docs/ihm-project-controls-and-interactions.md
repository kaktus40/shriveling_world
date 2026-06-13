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
- Les controles qui impactent surtout la lecture, la navigation et la lecture
  des couches vivent dans `app`.
- La calibration avancee n est pas une surface autonome. Elle est repartie
  entre `workspace` et `app` selon l effet du controle.
- Les modules visibles dans `app` s ouvrent par icone de bord d ecran; le nom du
  module apparait au survol de l icone, puis le panneau s ouvre au clic.
- Les changements structurels declenchent une invalidation explicite.
- Les changements purement visuels re-renderisent seulement la scene.
- Les actions export/import restent des boutons explicites.
- Le changement de precision de calcul peut remettre en cause tous les calculs
  derives et doit etre traite comme un recalcul complet.

## Surfaces Cibles

### 1. `app`

Surface operationnelle quotidienne.

Elle doit rester simple:

- visible depuis l index principal comme point d entree produit;
- choix du dataset;
- choix de l annee via un slider horizontal pleine largeur en haut de l ecran;
- selection de la ville;
- navigation camera;
- affichage et bascule des couches metier;
- requeteur de surface pour accentuer ou masquer des cones;
- outils de mesure surimprimes;
- export rapide si necessaire.

### 2. `workspace`

Surface d analyse, de benchmark et de validation.

Elle contient:

- reste inactive au demarrage tant qu aucun dataset n est selectionne;
- inspection des datasets;
- comparaison des profils compute;
- comparaison des strategies d intersection;
- replays de bancs synthetiques;
- calibration geometrique et projetee;
- essais visuels techniques;
- export/import de jeux d analyse;
- reglages structuraux qui peuvent forcer un recalcul complet.

### 3. Calibration Avancee Integree

La calibration avancee n est pas une surface autonome.
Elle est repartie entre `workspace` et `app`:

- `workspace` porte les parametres structurels, les benchmarks et les bancs
  d analyse;
- `app` porte les parametres perceptibles par l utilisateur final;
- les sous-groupes avances restent visibles comme sections repliables dans les
  deux surfaces si cela ameliore la lisibilite.

## Contrat D Interaction

### Types De Controles

- `select`: choix discret parmi des options;
- `slider`: variation continue ou semi-continue;
- `checkbox`: bascule binaire;
- `color`: couleur hexadecimale ou triplet;
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
  - relance le calcul interactionnel via un slider;
  - ne relit pas le dataset;
  - ne reconstruit pas le graphe de base.
- changement du pourcentage de projection:
  - relance la transformation de projection;
  - ne relit pas le dataset;
  - doit etre expose comme slider continu ou discret lisible.
- changement de ville:
  - re-centre la vue;
  - ne relance pas le precalcul.
- changement de precision:
  - peut remettre en cause tous les calculs derives;
  - force un recalcul complet des couches dependantes;
  - n est pas un simple changement visuel.
- changement de profil compute ou de strategie:
  - reexecute le pipeline de benchmark / validation;
  - conserve le snapshot dataset.
- changement purement visuel:
  - met a jour la scene;
  - ne modifie pas le precalcul.

### Regles D Ergonomie

- Les panneaux `app` doivent etre exposes par un dock d icones de bord d ecran.
- Le survol affiche le nom du module; le clic ouvre le panneau correspondant.
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
| year | `app` > `Navigation` | slider horizontal pleine largeur place en haut; visible au survol; changement fluide sans relecture du dataset; mise a jour du rendu et du calcul interactif | repris |
| city selection | `app` > `Navigation` | selection d une ville par liste et par picking; recentrage de la camera | repris |
| show cities name | `app` > `Layers` | bascule d affichage des labels de villes; ne declenche pas de recalcul | repris |
| taille du texte | `app` > `Display` | ajuste l echelle des labels; met a jour uniquement les meshes texte | a reprendre |
| text color | `app` > `Display` | change la couleur des labels; rendu immediat | a reprendre |
| camera mode (`orbit`, `inspect`, `free`) | `app` > `Navigation` | selection exclusive de mode; keyboard shortcuts synchrones | repris |
| zoom souris / `+/-` | `app` > `Navigation` | zoom immediat dans les bornes de la camera | repris |
| picking de ville | `app` > `Navigation` | clic sur un marqueur de ville; selection et focus de la ville | repris |
| reset scene | `app` > `Navigation` | remet la scene a l etat selectionne par le snapshot | repris |
| center viewport on city | `app` > `Tools` | recentrage local autour d une ville avec conservation du repere de la ville | repris |
| rotate around local vertical axis | `app` > `Tools` | rotation autour de l axe vertical local, lisible et reversible | repris |

### B. Lumiere Et Atmosphere

| Controle historique | Destination cible | Interaction attendue | Statut |
| --- | --- | --- | --- |
| light color | `workspace` > `Scene` ou `app` > `Display` si utile | modifie la couleur de la lumiere principale en direct | a reprendre |
| ambient color | `workspace` > `Scene` ou `app` > `Display` si utile | modifie la couleur ambiante de la scene | a reprendre |
| light intensity | `workspace` > `Scene` | modifie l intensite de la lumiere principale; rendu immediat | a reprendre |
| ambient intensity | `workspace` > `Scene` | modifie l intensite hemispherique | a reprendre |
| light position x/y/z | `workspace` > `Scene` | deplace la source lumineuse; update de la scene | a reprendre |
| shadow map size width/height | `workspace` > `Scene` | ajuste la resolution des ombres si elles sont actives | a reprendre |
| shadow camera near/far | `workspace` > `Scene` | ajuste le frustum des ombres; pas de recalcul metier | a reprendre |

### C. Projection Et Repere

| Controle historique | Destination cible | Interaction attendue | Statut |
| --- | --- | --- | --- |
| z coefficient | `workspace` > `Projection` | parametre de calibration; met a jour la transformation sans relire les donnees | a reprendre |
| longitude de reference | `workspace` > `Projection` | change le meridien de reference; peut invalider les couches dependantes de projection | a reprendre |
| latitude de reference | `workspace` > `Projection` | change le parallele / reference; recalcul des transforms projetees | a reprendre |
| hauteur de reference | `workspace` > `Projection` | change l altitude de reference; recalcul des transforms projetees | a reprendre |
| standard parallel 1 | `workspace` > `Projection` | ajuste la projection conique; recalcul immediat des donnees projetees | a reprendre |
| standard parallel 2 | `workspace` > `Projection` | ajuste la projection conique; recalcul immediat des donnees projetees | a reprendre |
| projection initiale | `workspace` > `Projection` | selection du mode de projection de depart | a reprendre |
| projection finale | `workspace` > `Projection` | selection du mode de projection cible | a reprendre |
| percent transition | `app` > `Display` ou `workspace` > `Projection` | variateur vertical sur le bord droit de l ecran; prend toute la hauteur; select de projection a chaque extremite; interpolation visible entre deux projections, dont la projection 3D du globe | a reprendre |
| orthographic / perspective swap | `app` > `Display` ou `workspace` > `Projection` | bascule de projection selon le contexte; le globe 3D compte aussi comme une projection | a reprendre |

### D. Cotes Cones

| Controle historique | Destination cible | Interaction attendue | Statut |
| --- | --- | --- | --- |
| coneStep | `workspace` > `Cones` | pas angulaire de balayage; relance les calculs de cones si la resolution change | repris conceptuellement, UI a finaliser |
| discriminant | `workspace` > `Cones` | seuil ou variation de forme; impact scientifique direct | a reprendre |
| with limits | `workspace` > `Cones` / `app` > `Layers` | active ou non la limitation par les frontieres; peut refaire le calcul des cones finaux | repris conceptuellement, UI a finaliser |
| conesShape | `workspace` > `Cones` | choix de la forme de cone; impacte la generation geometrique | a reprendre |
| cones color | `app` > `Display` / `workspace` > `Preview` | change la couleur de la couche cones; rendu immediat | a reprendre |
| cones transparency | `app` > `Display` / `workspace` > `Preview` | change l opacite des cones; rendu immediat | a reprendre |
| transport type | `workspace` > `Cones` | filtre ou selection de mode de transport; reconstruit la couche si necessaire | a reprendre |
| cone opacity | `app` > `Display` | opacite de la couche cones | a reprendre |
| cone discriminant (historique material) | `workspace` > `Cones` | parametre de calibration; conserve une signification explicite | a reprendre |

### E. Cotes Courbes

| Controle historique | Destination cible | Interaction attendue | Statut |
| --- | --- | --- | --- |
| curve color | `app` > `Display` / `workspace` > `Preview` | change la couleur de la couche courbes; rendu immediat | a reprendre |
| curve transparency | `app` > `Display` / `workspace` > `Preview` | change l opacite des courbes | a reprendre |
| pointsPerCurve | `workspace` > `Curves` | slider de densite; relance la geometrie de courbes | repris conceptuellement, UI a finaliser |
| curvesPosition | `workspace` > `Curves` / `app` > `Display` | position relative des courbes par rapport au cone; recalcule la geometrie finale | repris conceptuellement, UI a finaliser |

### F. Cotes Pays

| Controle historique | Destination cible | Interaction attendue | Statut |
| --- | --- | --- | --- |
| countries show | `app` > `Layers` / `workspace` > `Preview` | active ou desactive la couche pays | a reprendre |
| countries opacity | `app` > `Display` / `workspace` > `Preview` | change la transparence du maillage pays | a reprendre |
| countries extruded | `workspace` > `Countries` | change l extrusion / relief; peut reclencher la preparation de maillage | a reprendre |
| export country | `workspace` > `Export` | export de la geometrie pays ou du conteneur de rendu | a reprendre |

### G. Cotes Requete Et Donnees

| Controle historique | Destination cible | Interaction attendue | Statut |
| --- | --- | --- | --- |
| transport mode / transport type | `workspace` > `Query` / `Analysis` et `app` > `Query` | selection du mode ou du filtre de transport; alimente le requeteur AST et peut colorer ou accentuer des cones dans l app | a reprendre |
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

### I. Outils De Mesure Et Second Viewport

| Controle attendu | Destination cible | Interaction attendue | Statut |
| --- | --- | --- | --- |
| angle between 3 points | `app` > `Tools` | mesure immediate dans un overlay; trois points selectionnes dans la scene ou dans le second viewport | repris |
| city A / city B / Earth center plane | `app` > `Tools` | cree un plan de mesure pour visualiser un angle ou un grand cercle de reference | repris |
| second measurement viewport | `app` > `Tools` | affiche un viewport dedie a la mesure et a l inspection geometrique sans masquer la scene principale | repris |
| interactive cone emphasis by query | `app` > `Query` | le panneau requete affiche les villes matchées; cliquer un resultat recentre la ville et accentue les couches liees a la ville selectionnee | repris partiellement |

## Distribution Recommandee Par Surface

### `app`

Regrouper:

- `Data`:
  - dataset;
  - annee via slider;
  - ville.
- `Navigation`:
  - camera mode;
  - zoom;
  - picking;
  - reset;
  - deplacement de selection;
  - recentrage local;
  - rotation locale.
- `Layers`:
  - city labels;
  - boundary;
  - final cones;
  - curves;
  - countries.
- `Display`:
  - opacite;
  - couleurs de couche;
  - taille texte;
  - bascule orthographique si maintenue;
  - pourcentage de projection via variateur vertical avec select aux deux
    extremites.
- `Query`:
  - requeteur AST;
  - execution et resultat;
  - accent visuel sur les cones via la selection d un resultat.
- `Tools`:
  - mesure d angle;
  - plan de reference;
  - second viewport de mesure.

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
  - z coefficient;
  - projection 3D du globe.
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
- `Scene`:
  - lumiere;
  - ombres;
  - calibration visuelle structurale.
Le groupe `Advanced` n est plus une surface autonome:

- les reglages de precision vont dans `workspace` lorsqu ils forcent un recalcul
  complet;
- les reglages de rendu fins et les labels vont dans `app` lorsqu ils modifient
  seulement la presentation;
- les cas limites de calibration restent documentes mais distribues dans les
  deux surfaces selon leur effet reel.

## Interactions Attendues Par Domaine

### Dataset

- Choisir un dataset recharge tout le snapshot.
- Si le dataset change, toutes les selections derivables sont revalidees.
- Les prefs d interface peuvent survivre, mais seulement si le nouveau snapshot
  les accepte.

### Annee

- Changer l annee met a jour le calcul interactif via un slider.
- Le dataset n est pas relu.
- L annee peut etre pilotable au clavier dans `app`.

### Projection

- Le pourcentage de projection doit etre accessible par un variateur vertical
  place sur le bord droit de l ecran.
- Un select de projection doit etre present a chaque extremite du variateur.
- La transition entre projections doit etre lisible et progressive.
- Le changement peut relancer les couches derivees, mais ne doit pas relire le
  dataset.

### Precision

- Le changement de precision peut invalider toutes les couches calculees.
- Il doit etre traite comme une reinitialisation structurelle des couches
  dependantes.
- Il ne doit pas etre confondu avec un simple controle visuel.

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
- L extrusion reste un choix de projection / affichage.
- L export pays est un acte explicite.

### Requetes

- Le requeteur reste partage entre `workspace` et `app`.
- La modification de l arbre AST ne doit pas coupler la vue au moteur de calcul.
- L execution du requeteur doit rester visible et reproductible.
- Dans `app`, la requete peut servir a teinter, accentuer ou masquer des cones; la
  selection d un resultat doit recentrer la ville correspondante.

### Mesure

- La mesure d angle entre trois points doit etre accessible sans quitter la
  scene.
- La mesure peut utiliser un overlay ou un second viewport.
- Le plan A / B / centre de la Terre doit aider a lire les angles locaux.
- Le recentrage autour d une ville doit conserver la relation au repere local.
- La rotation autour de l axe vertical local doit etre disponible comme geste
  direct et lisible.

## Recommandation De Mise En Oeuvre

1. Garder `app` simple et orientee usage quotidien.
2. Mettre les reglages fins dans `workspace`.
3. Integrer la calibration avancee comme sous-groupes dans `workspace` et
   `app`, pas comme surface autonome.
4. Extraire chaque groupe de controles dans un composant Svelte dedie.
5. Garder un etat TypeScript partage par domaine, pas un grand store global.
6. Utiliser des noms stables et explicites pour faciliter la portabilite Rust.
7. Ne pas reconstruire de panneau monolithique a la `dat.gui`.

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
- les outils de mesure et le second viewport si necessaire;
- les exports.

Le portage Rust pourra ensuite reconstituer:

- le modele d etat;
- les panneaux de controle;
- les evenements;
- les effets de recalcul;
- les exports;
- sans depender de l ancienne structure `dat.gui`.
