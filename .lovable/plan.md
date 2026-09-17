# Croissance autonome de TikowikoCity

## Objectif
Faire vivre et grandir la ville sans intervention obligatoire du joueur : le trafic alimente le car wash, les lavages rapportent automatiquement, les logements accueillent des habitants visibles et les bénéfices financent progressivement de nouveaux quartiers.

## Mise en œuvre
- Ajouter un gestionnaire de croissance autonome, cadencé et indépendant du nombre d’images affichées.
- Utiliser une part raisonnable de la trésorerie pour construire gratuitement les routes nécessaires, puis poser ou améliorer des maisons sur des emplacements valides proches de ces routes.
- Conserver une réserve d’argent pour les améliorations manuelles et ralentir la croissance quand la ville est déjà développée.
- Faire apparaître les piétons d’abord aux maisons occupées, puis leur donner des destinations de quartier et des retours à domicile.
- Maintenir un flux automatique de voitures de ville vers le tunnel, avec file limitée, lavage complet, paiement unique et retour sur la route.
- Ajouter des événements lisibles dans l’historique pour les nouvelles maisons, les arrivées d’habitants et les bénéfices automatiques importants.
- Sauvegarder l’état et les compteurs d’automatisation afin qu’un rechargement ne réinitialise pas la croissance.

## Détails techniques
- Étendre l’état de progression sauvegardé avec le prochain cycle de croissance et ses compteurs, en gardant une migration compatible avec les anciennes sauvegardes.
- Modifier le plan de ville uniquement par ses méthodes existantes, puis rafraîchir maisons, routes et destinations piétonnes ensemble.
- Garder les limites mobiles actuelles pour les habitants et les voitures, sans créer de nouvelle boucle d’animation.
- Vérifier ordinateur et mobile : croissance visible, habitants sortant des maisons, voitures lavées, argent et sauvegarde mis à jour, sans erreur ni superposition d’interface.
