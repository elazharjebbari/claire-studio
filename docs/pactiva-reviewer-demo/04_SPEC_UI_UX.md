# 04 — Spécification UI / UX

> Maquettes ASCII : `04a_wireframes.txt`. Textes anglais (source unique) : `04b_contenus-en.md`. Charte : `docs/pactiva/charte-graphique.md` (public = clair, navy, or rare ; Inter / Outfit ; lucide).

## 1. Parcours du reviewer

1. Arrive sur `pactiva.legal` depuis le PDF. Voit en une seconde : le titre du papier, trois actions (*Try the classifier*, *Download the data*, *Open the platform*), l'empreinte du jeu de données.
2. Clique *Try the classifier* (ancre). Choisit un onglet : **Paste text** (zone de texte, compteur de caractères et de phrases estimées), **Upload .txt** (dépôt ou sélecteur, lecture locale, aperçu des 3 premières lignes), **CLAUDETTE contract** (liste des 17 contrats hold-out avec nombre de phrases ; mention « unseen by the model »).
3. Clique *Classify*. Le bouton passe en `pending` (spinner, désactivé) ; une ligne d'état indique la position dans la file puis la progression (`Loading model… / Classifying 212 sentences…`). Durée typique 10–20 s.
4. Le **visualiseur** s'ouvre sous le panneau : à gauche le document (une ligne par phrase, rail de couleur du thème prédit, chip thème + confiance, marque de frontière quand le thème change) ; à droite la **table des matières** (segments thématiques, clic = défilement), la **légende** avec comptes, le commutateur **T11 / T20** (T11 par défaut, le modèle prédit T11 ; pour un contrat CLAUDETTE, le gold T20 est projeté en T11 pour la comparaison).
5. Pour un contrat CLAUDETTE : colonnes supplémentaires par phrase — **Gold** (chip), **A1 A2 A3** (trois pastilles), **Judges** (quatre pastilles) — et un bandeau de résumé : exactitude et κ du modèle contre le gold sur ce document, exactitude des quatre juges. Un filtre « show disagreements only » isole les phrases où modèle ≠ gold ou où les annotateurs divergent.
6. *Export this result* : JSON et CSV du résultat courant (côté navigateur ; pour un contrat CLAUDETTE, l'export omet le texte des phrases et le dit).
7. Descend vers **What we release** (huit cartes), **Key figures** (tableau généré, chaque ligne avec « how computed » dépliable et lien vers le fichier), **Protocol** et **Codebook** (dépliables), **The platform** (liens), pied de page (citation, contact, licence).

## 2. Écrans et composants

| Zone | Composant | Type | Notes |
|---|---|---|---|
| En-tête | `Logo`, nav (Try · Data · Figures · Platform · Français) | serveur | `Français` → `/presentation` |
| Héros | titre du papier, auteurs sans e-mail, sous-titre, 3 boutons, ligne d'empreinte | serveur | boutons `Button` primary / outline |
| Panneau d'essai | `DemoPanel` (onglets, garde-fous, bouton `Classify`) | client | onglets accessibles (`role=tablist`), compteur `aria-live=polite` |
| Visualiseur | `ResultsViewer` = `DocumentPane` + `SideRail` | client | `DocumentPane` : liste virtualisée si > 250 phrases ; `SideRail` collant |
| Ligne de phrase | `SentenceRow` (index, rail, texte, chip, confiance, colonnes de comparaison) | client pur | rail = `getThemeToken(code)` en `style` (variable CSS), pas d'hex |
| Frontière | `ClauseBoundary` (ligne fine + libellé du nouveau segment) | pur | apparaît quand le thème prédit change |
| Comparaison | `ComparisonCells` (Gold, A1–A3, Judges) | pur | pastille colorée + tooltip libellé ; icône ≠ quand différent du modèle |
| Résumé | `Summary` (exactitude, κ, phrases, juges) | pur | chiffres calculés par l'API, affichés tels quels |
| Téléchargements | `DownloadsGrid` (8 cartes) | serveur | nom, description, taille, SHA-256 abrégé, aperçu dépliable |
| Chiffres clés | `KeyFigures` | serveur | tableau + `Disclosure` « how computed » |
| Protocole / codebook | `Disclosure` | serveur | texte de `04b_contenus-en.md` |
| Plateforme | cartes de liens | serveur | projets publics, connexion, GitHub |

## 3. États et messages

| Situation | Comportement |
|---|---|
| Zone vide | bouton désactivé, aide « Paste an English contract (up to 60,000 characters) » |
| Texte trop long | compteur en `text-danger`, bouton désactivé, message |
| Texte non anglais | message immédiat côté client, confirmé par l'API (400 `not_english`) |
| Quota atteint (429) | bandeau « You have reached the hourly limit for this demo; the data and figures below remain available » |
| File pleine (503) | « Three requests are already waiting; please retry in a minute » + bouton `Retry` |
| Échec (`failed`) | bouton en état `error` (reste cliquable), message court, pas de trace technique |
| Aucun JavaScript | le panneau affiche un texte statique ; téléchargements et chiffres restent lisibles |
| Réduction des animations | `prefers-reduced-motion` : pas de défilement animé ni de fondu |

## 4. Accessibilité (non négociable)

- Contraste AA sur tous les textes (jetons `ink`, `ink-muted` sur `bg`, `panel`) ; la couleur du thème n'est **jamais** le seul porteur d'information (libellé toujours présent).
- Navigation clavier complète : onglets, liste des contrats (listbox), lignes de phrases focalisables, TOC cliquable au clavier, `skip-link` vers le visualiseur.
- `aria-live` pour l'état du job ; `role=status` pour le résumé.
- Zones de texte et fichiers : libellés explicites, erreurs associées par `aria-describedby`.
- e2e axe sur `/` (tags wcag2a/aa, 2.1) ajouté à `e2e/a11y.spec.ts`.

## 5. Responsive

- ≥ 1024 px : document 2/3, rail 1/3 (collant). 640–1024 px : rail replié en accordéon au-dessus du document. < 640 px : colonnes de comparaison réduites aux pastilles, texte en pleine largeur, TOC en menu déroulant.

## 6. Ton et libellés

Anglais sobre, phrases courtes, aucun superlatif. Le modèle est présenté par ce qu'il est : « Legal-BERT fine-tuned with the paper's recipe on the 33 design contracts; the 17 contracts below were never seen during training. » Les chiffres sont accompagnés de leur provenance.
