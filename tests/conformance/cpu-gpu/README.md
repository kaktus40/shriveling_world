# Conformite CPU/GPU

Ce dossier recevra les tests comparant les references CPU et les kernels WebGPU definitifs.

Il est volontairement non bloquant pour l'instant:

- la reference CPU des limites GeoJSON existe;
- le kernel WGSL equivalent n'existe pas encore;
- les tests de conformite seront ajoutes lorsque les buffers GPU pourront etre produits et relus.

Contrat cible pour le raycast de frontiere:

- memes entrees compactes cote CPU et GPU;
- comparaison de `townBoundaryAngular`;
- comparaison de `townBoundaryEcef`;
- egalite stricte des flags et index;
- tolerance numerique documentee pour radians et metres.
