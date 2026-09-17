# Tooltips détaillés pour les améliorations

## Objectif
Permettre au joueur de comprendre précisément chaque achat avant de dépenser son argent, sur ordinateur comme sur mobile.

## Modifications prévues
- Ajouter une info-bulle à chacune des six améliorations de la boutique.
- Ouvrir l’info-bulle au survol ou au clavier sur ordinateur, et par appui sur mobile.
- Afficher dans chaque info-bulle :
  - le coût exact du prochain niveau ;
  - le niveau actuel et le niveau obtenu après achat ;
  - l’effet actuel puis l’effet exact du niveau suivant ;
  - la différence chiffrée apportée par l’achat ;
  - l’impact concret sur le car wash, par exemple capacité de file, vitesse du tapis, fréquence des clients, gain moyen, pourboires ou chance de lavage premium.
- Afficher un état spécial quand le niveau maximal est atteint, sans proposer un achat supplémentaire.
- Conserver le bouton d’achat actuel et empêcher qu’un simple affichage de l’info-bulle déclenche l’achat.
- Garantir que l’info-bulle reste lisible dans la fenêtre de la boutique, sans être coupée sur petit écran.

## Détails techniques
- Centraliser les comparaisons avant/après dans le système d’améliorations afin que les chiffres correspondent exactement aux formules déjà utilisées par le jeu.
- Ajouter les libellés d’impact propres à chaque amélioration plutôt que des descriptions génériques.
- Utiliser des interactions accessibles : survol, focus clavier, appui tactile, fermeture explicite et attributs d’accessibilité.
- Vérifier les six améliorations aux niveaux normal et maximal, avec un solde suffisant ou insuffisant, sur ordinateur et mobile.
