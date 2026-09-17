# Ville évolutive, déplacement et vie de quartier

## Objectif

Faire évoluer TikowikoCity en un jeu plus vivant : le joueur peut parcourir la ville puis passer en vue construction, le développement se débloque grâce aux revenus et aux bâtiments posés, le car wash gagne en présence visuelle, et des habitants ont de vraies destinations.

## Ce qui sera ajouté

### 1. Se déplacer et construire partout
- Ajouter un **mode personnage à pied** en mode Jeu, avec déplacement clavier et commandes tactiles mobiles.
- Caméra douce qui suit le personnage, sans perturber la circulation ni le car wash.
- Conserver la **caméra libre actuelle en mode Construction**, avec déplacement, rotation et zoom pour atteindre toutes les parcelles.
- Ajouter une transition claire entre **Jouer**, **Construire** et **Caméra libre**.
- Corriger le recadrage après rotation du téléphone afin que la ville reste visible et manipulable.

### 2. Progression mixte de la ville
- Remplacer la progression uniquement fondée sur l’argent par des paliers combinant : revenus, nombre de routes, maisons, habitants et améliorations du car wash.
- Étendre les chantiers progressifs : nouveaux tronçons, maisons, parcs, parkings, éclairages et petits commerces.
- Afficher le prochain objectif de développement et sa progression sans masquer la vue.
- Garder la priorité aux choix du joueur : aucun chantier automatique ne remplacera une construction existante.
- Journaliser les nouveaux quartiers et bâtiments débloqués, puis les inclure dans la sauvegarde locale et Drive.

### 3. Car wash mieux éclairé et signalé
- Ajouter un éclairage fonctionnel autour de l’entrée, de la sortie, du parking et du panneau.
- Améliorer le panneau du car wash : nom du joueur, enseigne lisible de jour comme de nuit et éclairage activé au crépuscule.
- Ajouter quelques éléments débloqués par les améliorations existantes : lampes supplémentaires, panneau plus qualitatif et décoration du parking.
- Intégrer ces ajouts au cycle jour/nuit et aux réglages de personnalisation déjà sauvegardés.

### 4. Piétons avec vie de quartier
- Intégrer des personnages 3D légers et animés, adaptés au style visuel actuel.
- Générer un réseau piéton depuis les routes et bâtiments construits : trottoirs, entrées de maisons, parcs, commerces et car wash.
- Faire sortir les habitants des maisons et leur attribuer une destination réelle ; ils marchent, attendent avant de traverser, visitent leur destination puis rentrent.
- Éviter les routes hors passages autorisés et tenir compte des voitures aux traversées.
- Limiter et recycler les personnages visibles selon l’appareil pour conserver une animation fluide sur mobile.

### 5. Sauvegarde et stabilité
- Sauvegarder les nouveaux déblocages, la progression, la personnalisation du panneau et la position du joueur.
- Restaurer les anciennes sauvegardes sans perte grâce à une migration de version.
- Découper les nouveaux systèmes en modules séparés plutôt que d’alourdir davantage la scène principale.
- Tester sur ordinateur et mobile : construction, marche, changement de mode, trafic, piétons, cycle nocturne, sauvegarde et chargement.

## Détails techniques

- Étendre le système de progression actuel avec des conditions cumulables plutôt qu’une simple liste de seuils monétaires.
- Créer un contrôleur joueur séparé, avec collisions simples contre les bâtiments, le lac et le car wash.
- Construire un graphe piéton dérivé du plan de ville, distinct du graphe routier des voitures.
- Utiliser des personnages GLB animés et un nombre adaptatif d’habitants actifs ; mutualiser matériaux et animations pour limiter les appels de rendu.
- Ajouter les nouveaux champs au schéma de sauvegarde, à la collecte, à la restauration et aux contrôles de compatibilité.
- Préserver le tracé de routes, l’économie, les voitures, le lavage et les menus existants.
