# Evaluation Differee Du Moteur De Rendu

## Statut

La selection definitive du moteur de rendu est differee jusqu'a ce que le
pipeline produise des buffers finaux suffisamment stables pour permettre une
comparaison representative.

Les deux candidats prioritaires sont:

- Babylon.js, moteur de rendu complet fournissant scene, camera, interactions
  et picking;
- luma.gl, couche GPU plus basse et orientee visualisation de grands volumes de
  donnees.

Three.js reste une reference historique utile, mais n'est pas retenu comme
candidat prioritaire pour la nouvelle architecture.

## Separation Architecturale

Le moteur de rendu ne participe pas aux calculs amont. Il consomme uniquement
les buffers geometriques finaux produits par les profils CPU, WebGL2 ou WebGPU.

```text
Ingestion et preparation
  -> framework de calcul CPU / WebGL2 / WebGPU
  -> buffers geometriques finaux
  -> adaptateur de rendu
  -> Babylon.js ou luma.gl
```

Les domaines `data`, `precompute` et `compute` ne doivent importer aucun type
propre a un moteur de rendu.

## Condition De Declenchement

Le prototype comparatif ne doit commencer que lorsque les conditions suivantes
sont reunies:

- les contrats des buffers pays sont stabilises;
- les contrats des buffers villes sont stabilises;
- un buffer final representatif de cones est disponible;
- un buffer final representatif de courbes est disponible;
- le changement d'annee peut mettre a jour les buffers sans relancer
  l'ingestion;
- les datasets reduits Europe et Monde peuvent alimenter le pipeline;
- les mesures compute sont separees des mesures de rendu.

Avant ces conditions, une comparaison mesurerait surtout du code temporaire et
risquerait de figer prematurement l'architecture.

## Prototype Comparatif

Chaque candidat doit recevoir strictement les memes buffers, styles, camera et
scenarios utilisateur.

Le prototype minimal doit afficher:

- le mesh pays;
- les villes;
- un volume representatif de cones transparents;
- les courbes;
- une selection par picking;
- une mise a jour des buffers lors d'un changement d'annee.

Le code specifique aux candidats doit rester derriere une interface commune:

```ts
interface RenderBackend {
  initialize(canvas: HTMLCanvasElement): Promise<void>;
  setCountryBuffers(buffers: CountryRenderBuffers): void;
  setCityBuffers(buffers: CityRenderBuffers): void;
  setConeBuffers(buffers: ConeRenderBuffers): void;
  setCurveBuffers(buffers: CurveRenderBuffers): void;
  render(frame: RenderFrame): void;
  pick(x: number, y: number): Promise<PickResult | null>;
  dispose(): void;
}
```

## Criteres De Comparaison

### Performance

- temps d'initialisation du renderer;
- temps d'upload initial des buffers;
- temps de mise a jour lors d'un changement d'annee;
- temps CPU par frame;
- temps GPU par frame lorsque mesurable;
- images par seconde;
- consommation memoire CPU et GPU;
- cout du picking.

### Qualite Et Capacites

- rendu correct des cones transparents;
- rendu correct et stable des courbes;
- profondeur et ordre de transparence;
- precision du picking;
- gestion de grands index et buffers;
- camera et interactions;
- comportement WebGPU et WebGL2;
- qualite sur les plateformes cibles web, Linux et Windows.

### Cout D'Ingenierie

- quantite de code specifique au renderer;
- facilite de liaison avec les buffers finaux;
- controle disponible sur les vertex/index buffers;
- capacite de diagnostic;
- stabilite de l'API;
- taille du bundle;
- maintenance et documentation de la bibliotheque.

## Regle De Decision

Babylon.js n'est pas selectionne parce qu'il fournit des capacites compute:
ces capacites restent hors du renderer du projet.

Le choix final privilegie le candidat qui affiche les buffers finaux avec les
meilleures performances et le plus faible cout de maintenance, sans introduire
de dependance du domaine ou du framework de calcul envers le renderer.

Les resultats du prototype, l'environnement de mesure et la decision finale
devront etre ajoutes a ce document.
