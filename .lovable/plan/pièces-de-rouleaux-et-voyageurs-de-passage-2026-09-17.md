# Pièces de rouleaux et voyageurs de passage

## Objectif
Faire évoluer l’entretien du car wash avec le niveau des rouleaux, rendre son état immédiatement lisible et ajouter une clientèle de passage sans alourdir la ville sur mobile.

## Pièces de rechange
- Utiliser le niveau actuel de l’amélioration **Rouleaux rapides** comme niveau technique des rouleaux.
- Donner une offre distincte aux deux vendeurs :
  - **pièces de base** : prix modéré, réparation à 100 %, usure normale de 4 points par lavage ;
  - **pièces de qualité** : prix nettement supérieur, réparation à 100 %, usure réduite à 2 points par lavage.
- Faire augmenter les deux prix à chaque niveau de rouleaux, avec un écart premium toujours visible et des montants compatibles avec l’économie actuelle.
- Afficher chez chaque vendeur le type de pièce, son prix actuel et sa durabilité avant l’achat.
- Mémoriser la qualité de pièce installée dans les sauvegardes locales et Drive, avec migration des anciennes parties vers les pièces de base.

## État des rouleaux dans Gestion
- Remplacer l’indication minimale actuelle par une zone d’état complète : barre colorée, pourcentage d’usure, seuil critique et qualité réelle du lavage.
- Afficher le niveau des rouleaux, la qualité des pièces installées et la perte éventuelle de qualité liée à l’usure.
- Utiliser des états lisibles : bon état, entretien conseillé, seuil critique à 35 %.

## Journal de la ville
- Ajouter une catégorie dédiée **Pièces et entretien**.
- Enregistrer chaque achat avec le vendeur, le type de pièce, le niveau des rouleaux, le montant dépensé, le solde restant et le gain de qualité du lavage obtenu.
- Conserver ces événements après sauvegarde et restauration, sans reclasser les anciennes entrées.

## Voyageurs simulés
- Ajouter un flux léger de voyageurs traversant la ville, sans créer de nouveaux personnages ni véhicules visibles.
- Calculer leur passage à partir des routes et parkings présents ; une proportion variable cherche une voiture propre et rejoint la demande du car wash.
- Ajouter ce bonus au rythme d’arrivée existant tout en respectant la capacité de file, les réglages Clients et le plafond de trafic mobile.
- Afficher dans **Clients** le nombre estimé de voyageurs de passage, la part recherchant un lavage et leur bonus de fréquentation.
- Recalculer ce flux depuis la ville restaurée ; seule une éventuelle phase temporelle nécessaire à la continuité sera sauvegardée.

## Vérification
- Tester les cinq niveaux de rouleaux, les deux qualités de pièces, l’achat avec solde suffisant ou insuffisant, l’usure après plusieurs lavages et la restauration de sauvegarde.
- Vérifier que le journal contient le montant et le gain de qualité exacts.
- Comparer une petite ville et une ville développée pour confirmer que routes et parkings augmentent les voyageurs et les clients sans dépasser la file autorisée.
- Contrôler les panneaux Gestion et Clients sur mobile et ordinateur, puis valider le fonctionnement d’un lavage automatique complet.
