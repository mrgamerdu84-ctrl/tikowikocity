# Personnage jouable et interactions dans la ville

## Expérience de jeu
- Transformer le mode « Marcher » existant en véritable exploration avec un personnage visible, orienté et animé pendant ses déplacements.
- Garder les commandes clavier et le joystick mobile, avec caméra de suivi fluide et limites de déplacement dans la ville.
- Détecter automatiquement l’objet le plus proche : car wash, maison, parc, parking, fontaine, aire de jeux ou mobilier.
- Afficher une action contextuelle à proximité, utilisable avec `E` sur ordinateur ou un bouton tactile.

## Dialogues et réactions
- Ouvrir une bulle de dialogue compacte sans masquer la ville, avec le nom du lieu, une réaction du personnage et une action adaptée.
- Prévoir des réactions différentes selon l’état réel du jeu : station active ou arrêtée, solde, lavages, niveau des maisons et type de décor.
- Permettre notamment d’inspecter le car wash, d’activer ses machines depuis l’entrée, de saluer les habitants et d’observer les bâtiments et aménagements.
- Fermer le dialogue avec Échap, le bouton de fermeture ou en s’éloignant.

## Sauvegarde et compatibilité
- Conserver la position du personnage, déjà sauvegardée, et ajouter sa dernière interaction si elle doit être restaurée sans bloquer le jeu.
- Ne pas modifier l’économie, les règles de construction ni la sauvegarde Drive existantes.
- Vérifier le déplacement, les interactions et les dialogues sur ordinateur et mobile, sans superposition avec les menus.

## Détails techniques
- Étendre le contrôleur du personnage avec état de mouvement, détection de proximité et verrouillage temporaire pendant un dialogue.
- Construire les zones interactives à partir des coordonnées du car wash et du plan dynamique des maisons/décors afin qu’elles suivent les créations du joueur.
- Mettre à jour l’interface React à faible fréquence seulement lors d’un changement de cible, pas à chaque image.
