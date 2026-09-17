# Fréquentation, niveaux de quartier et caméra libre

## Objectif
Rendre visible l’effet immédiat de chaque construction sur les clients du car wash, organiser la croissance en niveaux payants et permettre d’explorer toute la ville, tout en restaurant exactement le quartier sauvegardé.

## Mise en œuvre
- Ajouter au tableau de gestion une jauge de fréquentation actualisée en direct, avec le bonus total et le détail des maisons, habitants, routes, parkings et voyageurs.
- Définir des niveaux de quartier progressifs avec coût, conditions, constructions débloquées et bonus de fréquentation propre à chaque niveau.
- Appliquer les déblocages au menu Construction et à la croissance automatique, avec indication claire du niveau actuel et du prochain palier.
- Ajouter un mode caméra libre permanent : rotation, déplacement et zoom à la souris, au tactile et avec commandes visibles sur mobile, avec des limites couvrant tout le quartier.
- Conserver les modes marche, construction et cinéma sans conflit avec la caméra libre.
- Étendre la sauvegarde versionnée avec le niveau du quartier et la position/cible/zoom de la caméra ; restaurer routes, bâtiments, maisons et parkings avant de recalculer la fréquentation.
- Ajouter des tests ciblés des calculs de niveaux/fréquentation, puis vérifier sauvegarde-rechargement et caméra sur mobile et ordinateur.

## Détails techniques
- Centraliser les niveaux et leurs bonus dans un module de progression dédié.
- Continuer d’utiliser les collections sérialisées de `CityPlan` comme source exacte du quartier.
- Brancher le multiplicateur de niveau au calcul existant des arrivées afin que la jauge corresponde au trafic réel.
- Utiliser les contrôles orbitaux existants avec limites de distance, déplacement latéral et gestes tactiles plutôt qu’un second système concurrent.
