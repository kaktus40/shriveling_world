# Architecture Du Moteur De Requetes

Ce document decrit la direction retenue pour le moteur de requetes utilisateur
de la migration.

## Reference UX

Le projet `/home/abdou/Desktop/VoitureBDD2` a servi de reference pour le
principe d'edition des requetes:

- une feuille represente un filtre simple;
- un noeud represente un groupe logique `AND` ou `OR`;
- l'utilisateur manipule un arbre visuel, pas une syntaxe texte;
- l'arbre peut etre imbrique recursivement.

Le principe est conserve pour `shriveling_world_migration`.

## IHM Cible

L'edition de requetes doit etre exposee dans l'IHM sous la forme d'un arbre
visuel recursif.

Attentes fonctionnelles:

- chaque feuille edite un filtre atomique;
- chaque groupe porte un operateur logique `AND` ou `OR`;
- l'utilisateur peut imbriquer des groupes sans limite de principe;
- l'interface montre en permanence la structure courante de l'AST;
- l'interface permet d'ajouter, supprimer et reordonner les noeuds;
- l'IHM affiche les diagnostics de validation de l'arbre;
- l'IHM peut declencher l'execution du filtre dans le `Worker`;
- la premiere implementation cible doit s'integrer dans `/workspace`.

Principes de rendu:

- la representation visuelle reste lisible par un humain avant d'etre dense;
- les panneaux de selection des champs, comparateurs et valeurs restent proches
  du noeud edite;
- l'arbre doit pouvoir etre inspecte sans ouvrir le format serialise;
- les resultats de requete doivent pouvoir etre compares au panneau de
  construction.

Cette IHM ne remplace pas le moteur. Elle n'en est que la projection visuelle.

## Difference D'Architecture

La migration ne reprend pas certains choix techniques de `VoitureBDD2`:

- pas de `new Function(...)` comme contrat principal du moteur;
- pas de reconstruction du modele depuis le DOM;
- pas de couplage fort entre structure HTML et evaluation.

Le nouveau moteur repose sur:

- un AST explicite et serialisable;
- un evaluateur pur et testable;
- une execution hors thread UI dans un `Worker`;
- un futur editeur recursif Svelte alimente par le meme AST.

## AST Retenu

Le moteur manipule un arbre serialisable du type:

```ts
type TComparatorString =
  | '<'
  | '<='
  | '>'
  | '>='
  | '='
  | '<>'
  | 'empty'
  | 'not empty'
  | 'in';

interface QueryLeaf {
  nodeType: 'filter';
  fieldKey: string;
  comparator: TComparatorString;
  value: string | number | boolean | null;
}

interface QueryGroup {
  nodeType: 'group';
  type: 'AND' | 'OR';
  filters: QueryNode[];
}

type QueryNode = QueryLeaf | QueryGroup;
```

Ce choix reprend la lisibilite humaine de `VoitureBDD2` tout en restant
independant de l'IHM.

## Execution Hors Thread

Le systeme parallele est conserve.

Motivation:

- ne pas bloquer l'IHM;
- permettre des requetes complexes sur plusieurs milliers de villes;
- garder une architecture compatible avec d'autres executeurs plus tard.

Direction retenue:

1. l'IHM construit un AST;
2. l'AST est envoye a un `Worker`;
3. le `Worker` evalue la requete sur un snapshot serialisable du dataset;
4. le `Worker` renvoie les ids ou indexes des villes correspondantes.

## Pourquoi Pas `new Function` Comme Base

Le projet historique utilisait `new Function(...)` pour executer rapidement des
predicats dans un contexte parallele.

Ce besoin de parallelisme reste valide, mais la migration fait le choix
suivant:

- le contrat principal est un evaluateur interprete;
- l'AST reste la source de verite;
- une compilation AST -> fonction specialisee pourra etre evaluee plus tard,
  uniquement comme optimisation interne du `Worker`.

Donc:

- oui au `Worker`;
- oui a un moteur optimisable;
- non a une dependance structurelle de l'application a `eval` ou `new Function`.

## Snapshot De Requete

Le `Worker` ne doit pas reparser le dataset brut.

Le moteur de requete consomme un snapshot applicatif derive du `workspace`:

- catalogue de champs queryables;
- type inferre de chaque champ;
- valeurs par ville;
- ids techniques permettant de revenir aux villes du dataset prepare.

Les champs restent libres:

- le coeur ne presuppose pas qu'une colonne signifie "population" ou "surface";
- l'application peut toutefois exposer des champs humains et, plus tard, des
  mappings semantiques.

## Premiere Semantique Retenue

Pour les champs multi-valeurs rattaches a une ville:

- un predicat est considere vrai si au moins une valeur de la ville satisfait
  ce predicat.

Pour les comparateurs:

- les comparateurs de `VoitureBDD2` sont conserves dans un premier temps pour
  garder une logique lisible par l'humain;
- `in` sera interprete comme une recherche textuelle sur des tokens, pas comme
  une syntaxe SQL.

## Phasage

1. moteur AST pur;
2. snapshot serialisable par ville;
3. `Worker` de requete;
4. tests unitaires et integration;
5. editeur recursif dans `/workspace` avec representation visuelle de l'arbre;
6. benchmark du moteur interprete;
7. eventuelle optimisation compilee dans le `Worker`.
