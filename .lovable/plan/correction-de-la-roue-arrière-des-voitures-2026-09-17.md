# Correction de la roue arrière des voitures

## Objectif
Supprimer la roue arrière qui semble rester accrochée ou tourner autour de la voiture, tout en conservant la circulation et la rotation naturelle des autres roues.

## Diagnostic et correction
- Inspecter la hiérarchie réelle des roues sur tous les modèles de voitures chargés afin d’identifier le modèle et le nœud arrière concernés.
- Ne retenir qu’un seul pivot de rotation valide par roue, en excluant les groupes imbriqués, accessoires ou doublons dont le nom contient aussi « wheel ».
- Déterminer l’axe local de chaque roue depuis son orientation réelle plutôt que d’imposer le même axe à tous les modèles.
- Conserver la position locale de chaque roue pendant l’animation afin qu’elle tourne sur elle-même sans orbiter, se détacher ou rester accrochée au décor.
- Utiliser exactement la même animation corrigée sur les voitures en ville et celles qui traversent le tunnel de lavage.

## Vérification
- Faire circuler chaque variante de voiture suffisamment longtemps pour observer les quatre roues, les virages et les demi-tours.
- Suivre une voiture depuis la ville jusqu’au tunnel puis à son retour sur la route.
- Vérifier que les roues avant et arrière restent attachées, tournent dans le bon sens et s’arrêtent avec la voiture.
- Contrôler le résultat sur ordinateur et mobile, sans nouvelle erreur visible.
