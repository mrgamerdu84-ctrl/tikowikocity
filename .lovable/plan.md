# Sauvegardes, événements et pilotage du car wash

## Résultat attendu
- Ajouter dans Gestion un espace **Sauvegarde** avec deux actions immédiates : **Sauvegarder maintenant** et **Charger la sauvegarde**. Le chargement demande confirmation avant de remplacer la partie en cours et affiche la date de la sauvegarde disponible.
- Rendre l’interface mobile plus compacte : bouton **← Retour** visible dans les panneaux, cartes et listes moins hautes, zones défilantes adaptées aux petits écrans et bouton tactile **E** toujours visible près d’une interaction, sans chevaucher le joystick.
- Ajouter un menu **Car wash** détaillé avec revenus par lavage, temps moyen, satisfaction, état des rouleaux et impact chiffré des améliorations.
- Enrichir le journal avec un onglet **Rentabilité** : revenus, dépenses, profit net, temps de jeu et comparaison des périodes de 30 minutes.

## Événements urbains
- Créer un système d’événements aléatoires persistants avec annonce, durée restante et historique :
  - **Fête de quartier** : davantage de trafic et de clients, satisfaction renforcée.
  - **Grève** : trafic et fréquentation réduits temporairement.
  - **Nouveau bâtiment** : construction automatique gratuite d’un bâtiment adapté sur une case disponible.
- Les fêtes et grèves durent aléatoirement entre **5 et 8 minutes**, avec un temps calme entre deux événements.
- Appliquer leurs multiplicateurs au rythme réel d’arrivée des voitures et aux statistiques du car wash, sans dépasser les limites de circulation existantes sur mobile.

## Données et calculs
- Étendre la sauvegarde versionnée pour conserver temps de jeu cumulé, événement actif, historique des événements, mesures de lavage et périodes financières.
- Enregistrer pour chaque lavage son revenu, sa durée estimée et sa satisfaction calculée depuis la qualité des rouleaux, les pièces et les améliorations.
- Classer chaque mouvement du journal comme revenu, dépense ou neutre afin de produire des totaux fiables sans dépendre de libellés textuels.
- Agréger les résultats par tranche de **30 minutes de jeu** et conserver les anciens totaux même lorsque la liste visible du journal est limitée.
- Restaurer les anciennes sauvegardes avec des valeurs sûres, sans perdre les créations existantes.

## Vérification
- Tester sauvegarde manuelle, modification de partie, puis chargement et restauration exacte.
- Tester fête, grève et construction gratuite, y compris sauvegarde/reprise en cours d’événement.
- Vérifier que les revenus, dépenses, profit, durée et évolutions correspondent aux opérations du journal.
- Vérifier Gestion, Car wash, Journal et interaction E sur mobile 392×722 et ordinateur, sans chevauchement ni erreur.
