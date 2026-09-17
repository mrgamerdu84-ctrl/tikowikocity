# Confirmation sécurisée des achats d’améliorations

## Objectif
Afficher un récapitulatif avant chaque achat et garantir qu’une amélioration ne puisse être facturée qu’une seule fois.

## Modifications prévues
- Remplacer l’achat immédiat par l’ouverture d’une fenêtre de confirmation lorsque le joueur clique sur le prix d’une amélioration.
- Afficher dans cette fenêtre :
  - le nom de l’amélioration ;
  - le niveau actuel et le niveau obtenu ;
  - le coût exact ;
  - le solde actuel ;
  - le solde restant après achat ;
  - l’effet principal obtenu au prochain niveau.
- Proposer deux actions claires : « Annuler » et « Confirmer l’achat ».
- Recalculer le niveau, le prix et le solde au moment de la confirmation pour éviter d’utiliser des informations devenues anciennes.
- Fermer proprement la fiche d’information ouverte lorsqu’une confirmation commence.

## Protection contre les doubles achats
- Ajouter un verrou immédiat partagé par tous les boutons d’achat, actif dès la première confirmation validée.
- Désactiver les boutons pendant le traitement et afficher un libellé d’attente sur l’action concernée.
- Ignorer toute seconde validation reçue pendant le verrou, même si elle provient d’un double clic très rapide.
- Libérer le verrou uniquement après la mise à jour du solde, du niveau, de l’historique et de la sauvegarde locale.
- Si le solde est devenu insuffisant ou si le niveau maximal a été atteint entre-temps, annuler sans débit et afficher l’explication.

## Vérification
- Tester l’annulation sans modification du solde ni du niveau.
- Tester un achat confirmé et contrôler le solde annoncé puis obtenu.
- Simuler plusieurs clics rapides et confirmer qu’un seul débit et un seul niveau sont appliqués.
- Tester un solde insuffisant et un niveau maximal.
- Vérifier la fenêtre et les boutons sur ordinateur, clavier et mobile.
