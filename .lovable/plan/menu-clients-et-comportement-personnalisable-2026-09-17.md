# Menu Clients et comportement personnalisable

## Objectif
Ajouter un menu « Clients » qui permet de régler leur fréquence d’arrivée, le montant payé et le temps passé dans le tunnel, tout en montrant clairement les améliorations qui modifient ces résultats.

## Mise en œuvre
- Ajouter « Clients » au tableau de bord principal, sans superposer ce menu aux autres fenêtres.
- Proposer trois réglages simples avec curseurs et valeurs lisibles : fréquence, montant payé et durée du lavage.
- Afficher pour chaque réglage la valeur finale réellement utilisée par le jeu, après combinaison du choix du joueur, des habitants, de l’état des rouleaux et des améliorations.
- Relier les réglages au trafic automatique, au revenu de chaque lavage et à la vitesse du tapis dans le tunnel.
- Ajouter un résumé des améliorations influentes : Rouleaux rapides et Parking pour les arrivées/durée, Qualité, Décoration et Équipe pour le montant, File d’attente pour le nombre de clients acceptés.
- Fournir un bouton de remise aux valeurs équilibrées.
- Sauvegarder les réglages avec la partie et restaurer les anciennes sauvegardes avec les valeurs par défaut.

## Détails techniques
- Utiliser des multiplicateurs bornés pour éviter les cadences impossibles ou une économie déséquilibrée.
- Appliquer le même calcul dans l’aperçu du menu et dans la boucle réelle du jeu.
- Vérifier ordinateur et mobile : ouverture/fermeture, curseurs, valeurs finales, sauvegarde après rechargement et absence d’erreurs.
