# Persistance fiable de la partie

## Objectif
Retrouver exactement le solde, le nombre de lavages, les niveaux des six améliorations et le journal après un rechargement ou une fermeture rapide de la page.

## Modifications prévues
- Conserver ces quatre éléments dans la sauvegarde locale versionnée déjà utilisée par la ville.
- Déclencher une sauvegarde immédiatement après chaque lavage, achat d’amélioration ou nouvelle entrée du journal, au lieu de dépendre uniquement de l’enregistrement périodique actuel.
- Enregistrer également quand l’application passe en arrière-plan, ce qui sécurise mieux les parties sur téléphone et dans l’APK.
- Restaurer les données avant de rendre la partie jouable, puis synchroniser les valeurs affichées et celles utilisées par le car wash.
- Valider les données chargées et appliquer des valeurs sûres si une ancienne sauvegarde est partielle ou abîmée, sans effacer les autres éléments valides de la ville.
- Garder la sauvegarde Google Drive compatible avec le même état complet.

## Vérification
- Créer une partie, effectuer des lavages et acheter plusieurs améliorations.
- Contrôler le solde, le compteur, les niveaux et les événements du journal.
- Recharger immédiatement la page puis vérifier que les quatre valeurs sont identiques.
- Refaire le test sur écran mobile et vérifier qu’aucune erreur n’apparaît.
