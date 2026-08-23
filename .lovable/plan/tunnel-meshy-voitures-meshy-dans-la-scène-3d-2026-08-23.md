# Tunnel Meshy + voitures Meshy dans la scène 3D

Objectif : remplacer le tunnel actuel par le modèle Meshy détaillé et remplacer les voitures Kenney par les 5 véhicules Meshy, tout en gardant la page rapide à charger.

## Le problème à résoudre

Les 5 véhicules Meshy sont livrés en FBX avec des textures 4K non compressées : environ 110 Mo par voiture, soit ~570 Mo au total. Tel quel c'est inutilisable sur le web. Ils doivent être convertis et compressés avant intégration. Le tunnel (GLB, 1,1 Mo) est déjà exploitable.

## Étapes

1. **Conversion FBX → GLB** des 5 modèles (4 voitures + le lavage cartoon), en réunissant chaque maillage avec ses 4 textures (couleur, normal, metallic, roughness).
2. **Compression** de chaque GLB :
   - textures redimensionnées en 1024 px (512 px pour normal/metallic/roughness) et converties en WebP,
   - géométrie simplifiée et compressée (Draco/meshopt),
   - fusion metallic + roughness en une seule texture.
   Cible : moins de 2 Mo par véhicule, idéalement ~1 Mo.
3. **Hébergement CDN** : chaque GLB compressé est publié via Lovable Assets (aucun binaire lourd dans le dépôt), avec un pointeur `.asset.json` dans `src/assets`.
4. **Intégration dans la scène** (`src/components/CarWashScene.tsx`) :
   - chargement des GLB via `GLTFLoader` (+ décodeur Draco/meshopt),
   - le tunnel Meshy remplace le tunnel construit en primitives ; les brosses, la mousse et l'éclairage sont recalés sur ses dimensions réelles,
   - les 4 voitures Meshy alimentent le spawn aléatoire, normalisées (échelle, orientation, roues au sol) via une boîte englobante,
   - chargement progressif : la scène s'affiche immédiatement, les véhicules apparaissent au fur et à mesure, avec un indicateur de chargement discret en français.
5. **Vérification** : build, contrôle du poids total téléchargé et test visuel de la page sur mobile et desktop.

## Points techniques

- Conversion via `FBX2glTF` puis optimisation avec `@gltf-transform/cli` (resize, webp, draco, `metalRough`), exécutés dans le bac à sable ; les binaires intermédiaires restent hors du dépôt.
- Si un FBX résiste à la conversion automatique, repli sur un chargement `FBXLoader` du modèle réduit, ou conservation du véhicule Kenney correspondant pour ce slot, avec mention explicite du modèle concerné.
- Les modèles Kenney restent en place pour les routes, bâtiments et décor.
- Aucun changement de charte graphique : les tokens `--ink`, `--splash`, `--sunny` et les dégradés de ciel définis dans `src/styles.css` sont conservés.
