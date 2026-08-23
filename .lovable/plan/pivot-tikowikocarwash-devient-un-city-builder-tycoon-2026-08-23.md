# Pivot : TikowikoCarWash devient un city-builder / tycoon

On abandonne la ville générée automatiquement pour un jeu où le joueur construit lui-même son réseau routier autour d'un car wash abandonné qu'il relance.

## Première étape proposée : le mode construction de routes

C'est la brique qui conditionne tout le reste (économie, maisons, habitants). On la livre seule, complète et jouable, avant toute logique d'argent.

### Ce qu'on obtient à la fin de cette étape

- Terrain vierge : collines/montagnes en arrière-plan, lac, ciel conservés. La ville actuelle (grille de rues, immeubles, mobilier, trafic généré) est retirée.
- Le car wash à l'abandon reste en place sur sa parcelle, avec **une seule route principale** qui part de la station et file vers les reliefs (les voitures arriveront de là).
- Une **grille de construction** visible (cases de 6 unités, comme les tuiles Kenney actuelles) avec surbrillance de la case survolée.
- Une **palette de construction** en bas de l'écran : route droite, virage, carrefour en T, carrefour 4 voies, plus une gomme pour supprimer.
- Pose au clic (glisser pour tracer une suite de tuiles), rotation à la touche `R` ou via un bouton, aperçu fantôme translucide avant pose, blocage sur les cases occupées (car wash, lac, route principale).
- **Raccordement automatique** : quand deux tuiles se touchent, la bonne variante est choisie (une droite devient un T si on branche dessus, etc.).
- Mobilier de carrefour : une fois un carrefour posé, on peut y déposer feux tricolores et lampadaires depuis la même palette (ils s'accrochent aux coins de la case).
- Bascule **Construction / Jeu** : en mode Jeu la grille disparaît et les voitures existantes circulent sur le réseau tracé par le joueur.
- Sauvegarde : le plan de ville (liste de tuiles + mobilier) est inclus dans la sauvegarde Drive déjà en place, et rechargé au démarrage.

### Étapes suivantes (pour info, pas dans cette livraison)

2. Réouverture du car wash : nom personnalisé + choix de la couleur du bâtiment, écran d'intro.
3. Économie : chaque voiture lavée rapporte, compteur d'argent, coût des tuiles de route.
4. Maisons constructibles → habitants → emplois → revenus.
5. Commerces et croissance organique de la ville.

## Détails techniques

Le composant `src/components/CarWashScene.tsx` fait ~2000 lignes ; on le découpe pour rendre le pivot maintenable :

- `src/game/grid.ts` — conversion monde↔case, taille de tuile, cases réservées.
- `src/game/catalog.ts` — catalogue des pièces constructibles (clé du modèle Kenney, empreinte, connexions N/E/S/O, mobilier compatible).
- `src/game/cityState.ts` — état du plan : `Map<"x,z", { piece, rot, props[] }>`, actions poser/supprimer/pivoter, sérialisation pour Drive.
- `src/game/buildController.ts` — raycast sur un plan sol, case survolée, aperçu fantôme, gestion clic/glisser, recalcul des raccords voisins.
- `src/game/scene/` — extraction de l'existant qu'on garde : ciel, reliefs, lac, car wash, tunnel, voitures et animation du lavage.
- `src/components/CarWashScene.tsx` — orchestration Three.js + HUD React (palette, bascule mode, boutons Drive déjà présents).

Ce qui est **supprimé** : génération de la grille de rues, immeubles procéduraux et leur teinte pastel, mobilier automatique aux intersections, trafic de ville pré-généré (la logique de conduite est conservée, elle suivra le réseau construit).

Ce qui est **conservé intact** : modèles Kenney (`kenney-pack.glb`), tunnel Meshy, animation des rouleaux/tapis, rotation des roues, sauvegarde Google Drive, cadrage mobile.

Le trafic reposera sur un graphe déduit des tuiles posées : chaque tuile expose ses connexions, les voitures choisissent une sortie au hasard aux carrefours et respectent les feux posés par le joueur. S'il n'existe aucune route reliée au car wash, aucune voiture n'arrive — c'est le premier objectif implicite du joueur.
