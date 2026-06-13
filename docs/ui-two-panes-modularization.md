# Plan De Modularisation De L Interface En Deux Pans

## Objectif

Structurer l application en deux pans UI clairement separes afin de rendre le code
plus modulaire, reusable et maintenable sans casser les contrats metier deja
valides dans la migration.

L inventaire des shaders a produire est considere comme complet pour ce plan.
La modularisation n ajoute pas de nouvelle portee shader. Elle reorganise la
presentation et l orchestration de l existant.

## Les Deux Pans

### 1. Workspace

But:
- analyser la conformite des datasets;
- benchmarker le traitement selon le profil compute retenu;
- comparer CPU, WebGL2 et WebGPU;
- exposer les diagnostics de validation;
- piloter les tests visuels et techniques autour du pipeline de migration.

Responsabilites:
- chargement et selection de dataset;
- inspection de manifests et de tranches de preparation;
- benchmarks par etape et par profil;
- comparaison des sorties et ecarts;
- tests visuels de la chaine 3D finale et de la carte 2D;
- outillage de diagnostic pour la migration.

### 2. Application Operationnelle

But:
- servir l usage metier quotidien;
- charger un dataset et afficher l ecran principal de rendu;
- faire evoluer l annee sans recalcul inutile;
- permettre la selection de villes;
- executer des requetes metier sur les villes;
- produire des extractions pour rendu differe, export ou traitement externe.
- afficher une scene Babylon.js plein ecran;
- superposer des menus de controle visibles au survol;
- offrir un premier niveau d interaction inspire du code historique:
  orbite, zoom, picking de ville, inspection.

Responsabilites:
- rendu 3D principal;
- navigation temporelle fluide;
- requeteur humain sur arbre AST;
- ajustement du rendu final;
- affichage des couches metier calculees en provenances du compute partage
  (frontieres, cones finaux, courbes) sans recopier la logique de calcul;
- export vers des outils externes comme Blender;
- reutilisation des memes donnees preparees et du meme orchestrateur compute.
- chrome UI en surimpression plutot qu interface pleine page.

## Couche Partagee

Les deux pans doivent consommer les memes briques de fond:
- `PreparedDataset`;
- orchestrateur compute multi-profil;
- moteur de requete AST;
- invalidation des precomputes;
- exports et diagnostics structures;
- contrats de buffers GPU/CPU.

Ils ne doivent pas partager la meme page racine ni la meme logique d assemblage
UI.

## Structure Cible

```text
src/routes/
  workspace/
  app/

src/lib/features/
  workspace/
  app/

src/lib/shared-ui/
  panels/
  tables/
  selectors/
  diagnostics/
  layout/
```

Principes:
- les routes restent minces;
- la logique d etat et d orchestration vit dans `src/lib/features/*`;
- les composants visuels generiques sont centralises dans `src/lib/shared-ui/*`;
- les composants de domaine applicatif restent petits et reutilisables.
- la scene Babylon occupe tout le viewport;
- les menus de controle apparaissent au passage de la souris;
- les interactions clavier/souris restent concentrees dans la couche app,
  jamais dans le compute.
- la premiere coque Babylon de `app` doit rester mince et pilotable via un
  controleur de scene dedie, pas via un gros `+page.svelte`.
- les geometries calculees reelles doivent arriver dans la scene via un
  contrat explicite de couches metier, pas via un transfert d etat implicite.
- les marqueurs de villes, les couches metier et les adaptations Babylon
  restent dans des modules distincts pour garder le client lisible.

## Regles De Maintenabilite

- eviter les pages Svelte monolithiques;
- extraire l orchestration de donnees dans des modules TypeScript dedies;
- isoler les panneaux repetitifs en composants reutilisables;
- garder les composants de requete recursifs decoupes par responsabilite;
- preferer plusieurs petits fichiers a un unique `+page.svelte` massif;
- documenter chaque extraction qui change le contrat d usage.

## Ordre Recommande

1. refactoriser `src/routes/workspace/+page.svelte` en composants plus petits;
2. extraire les panneaux de resume, diagnostics et benchmark dans `src/lib/features/workspace`;
3. definir la coque applicative operationnelle `src/routes/app`;
4. creer une couche de composants partages pour les panneaux, tableaux et selections;
5. refactoriser `QueryNodeEditor.svelte` si necessaire pour reutiliser ses sous-parties;
6. garder les pages de test comme vues fines de validation, pas comme containers d orchestration.

## Jalon Associe

Ce plan est rattache au sous-jalon `M9.0` de la roadmap de migration.
Il prepare l integration interactive complete sans confondre:
- validation et benchmark d un cote;
- usage operationnel de l autre.

## Resultat Attendu

A la fin de ce chantier:
- `workspace` reste la surface d analyse et de comparaison;
- l application operationnelle dispose d une coque plus lisible et reutilisable;
- les blocs visuels communs sont factorises;
- les fichiers Svelte restent de taille raisonnable;
- l ajout de nouveaux panneaux ou de nouveaux profils compute devient localise.
