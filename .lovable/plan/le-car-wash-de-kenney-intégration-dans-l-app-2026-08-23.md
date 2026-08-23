# Le Car Wash de Kenney — intégration dans l'app

Objectif : la scène 3D interactive devient la page d'accueil de l'application, en français.

## Ce que ça donne

- En ouvrant l'app : la scène 3D du car wash en plein écran, avec le ciel dégradé bleu, l'écran de chargement « Préparation du savon... », le titre en haut à gauche et les deux boutons « 🚗 Envoyer une voiture » et « 🎥 Vue cinéma ».
- Commandes identiques : glisser pour tourner, molette pour zoomer, clic droit pour déplacer.
- Textes de l'interface conservés en français.

## Détails techniques

1. **Assets 3D** : les modèles GLB encodés en base64 dans le HTML (~2,5 Mo) sont extraits dans un fichier de données séparé publié via Lovable Assets, chargé à la demande côté navigateur — le bundle de la page reste léger.
2. **Dépendance** : installation de `three` (0.160.x) en local plutôt que via l'importmap CDN, avec `GLTFLoader` et `OrbitControls` depuis `three/examples/jsm`.
3. **Composant** : `src/components/CarWashScene.tsx` — client-only (`<ClientOnly>` + import dynamique) pour éviter tout accès à `window` pendant le rendu serveur. Il reprend tel quel la logique du fichier fourni : mise en place de la scène/lumières, sol et routes, bâtiment du tunnel, animation du lavage, mousse et gouttes, et boucle de rendu. Nettoyage du renderer et du `resize` au démontage.
4. **Page** : `src/routes/index.tsx` remplace le placeholder, rend la scène plein écran et le HUD/boutons en JSX, avec `head()` : titre « Le Car Wash de Kenney », description en français, og:title/og:description, og:type et twitter:card.
5. **Styles** : le CSS inline du fichier d'origine est converti en classes Tailwind + tokens du design system (bleu ciel / cyan / jaune), sans couleurs codées en dur dans les composants.
6. **Licence** : mention CC0 Kenney (kenney.nl) discrète en bas de page.

## Hors périmètre

Les trois zips de kits Kenney fournis ne sont pas intégrés : la scène utilise déjà les modèles embarqués. Ils pourront servir plus tard si tu veux ajouter d'autres véhicules ou décors.
