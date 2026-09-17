# Vendeurs de pièces et usure des rouleaux

## Objectif
Ajouter des vendeurs visibles dans la rue auprès desquels le personnage peut acheter des pièces de rechange. Les rouleaux s’usent avec les lavages, ce qui réduit progressivement la qualité et les revenus jusqu’à leur réparation.

## Mise en œuvre
- Installer plusieurs petits stands de vendeurs sur les trottoirs, avec un vendeur issu des personnages déjà utilisés dans la ville et des pièces mécaniques visibles.
- Ajouter les vendeurs aux interactions à pied : approche, dialogue, prix, état actuel des rouleaux et effet annoncé avant achat.
- Faire baisser l’état des rouleaux après chaque lavage, avec un plancher raisonnable pour que la station reste rentable.
- Appliquer l’état réel des rouleaux au montant du lavage : des rouleaux usés réduisent la qualité et donc le revenu ; une réparation restaure immédiatement 100 %.
- Débiter le coût une seule fois, bloquer l’achat si le solde est insuffisant ou si les rouleaux sont déjà neufs, puis journaliser la réparation.
- Afficher l’état des rouleaux dans les commandes du car wash afin que le joueur sache quand chercher un vendeur.
- Sauvegarder l’état des rouleaux avec la ville et restaurer les anciennes sauvegardes à 100 % par défaut.

## Détails techniques
- Étendre le contexte d’interaction avec les coordonnées fixes des vendeurs, leur prix et l’état des rouleaux.
- Garder les vendeurs statiques et peu nombreux pour préserver les performances mobiles.
- Utiliser le calcul de récompense existant, puis appliquer un multiplicateur de qualité lié à l’usure avant de créditer le lavage.
- Vérifier ordinateur et mobile : vendeurs visibles, achat et refus corrects, solde débité, rouleaux réparés, revenu réduit en cas d’usure, sauvegarde restaurée et aucune erreur.
