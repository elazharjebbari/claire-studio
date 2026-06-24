# Charte design GOLD

SYSTÈME DE DESIGN — ancré sur les tokens réels du socle (globals.css / tailwind / design-tokens.json), ZÉRO hex en dur.

A) COULEURS (tokens existants réutilisés)
- Surfaces : --surface-bg (canvas), --surface-bg-elevated (cartouche de conflit), --surface-panel / --surface-panel-muted (panneaux), --surface-reading (fil contrat), --surface-border, --surface-text / --surface-text-muted. Classes Tailwind correspondantes déjà en place : bg-reading, bg-elevated, bg-panel, bg-panel-muted, bg-accent, border-accent, border-ink-muted, text-ink, text-ink-muted, text-muted.
- Marque : --brand-gold (réservé aux accents GOLD : titre du module, médaille top-1 du classement, liseré d'un gold finalisé). Usage parcimonieux pour ne pas saturer.
- Sémantiques existantes : --sem-success (accord/résolu), --sem-warning (conflit/en cours), --sem-danger (divergence forte/humain≠LLM signal fort), --sem-info (auto-résolvable/LLM). On NE crée pas de nouveaux hex : on mappe les états GOLD sur ces 4 tokens.
- Thèmes de clauses : getThemeToken(code).color (hydraté par le schéma projet) pour le fond des articles ; readableTextColor pour le texte des chips (AA garanti). hexToRgbChannels pour les opacités.
- NOUVEAUX tokens d'intensité à ajouter (dans design-tokens.json + charte) : --gold-sev-1/2/3 (accord absolu / peu risqué / risqué) et opacités de fond d'article (strict ~0.33, majoritaire ~0.22, split = pas de fond + bordure). Et migration des hex en dur de ComparePanel STATUS_COLOR (#34D399/#FBBF24/#64748B) vers --sem-success/warning + neutre.

B) ENCODAGE DU STATUT — JAMAIS la couleur seule (a11y AA)
Combinaison redondante : couleur de token + MOTIF de rail (uni=strict, hachure=majoritaire, plein vif=split) + badge texte + icône. Le rail de consensus (dérivé de ModelBoundaryRail) code le statut par segment ; le fond du bloc porte l'intensité ; le badge porte le libellé. Trois canaux indépendants → lecture sûre pour daltoniens et lecteurs d'écran.

C) TYPOGRAPHIE (juridique)
- Corps du contrat : --font-reading (leading-reading, max-w-reading) — lecture longue confortable, métaphore document.
- Titres d'articles / numérotation juridique (Art. N.M) : --font-display, poids medium.
- Données denses (votes, kappa, %, compteurs) : --font-mono pour l'alignement chiffré dans les cartes de vote et matrices.
- Hiérarchie : catégorie EN AVANT (chip coloré + label), corps gris discret pour les blocs calmes, contraste accru sur les conflits.

D) ESPACEMENTS & DENSITÉ
- Deux densités : LECTURE (articles d'accord, 1 ligne compacte, beaucoup d'air) vs DÉCISION (cartouches denses, votes serrés mais lisibles). Densité mémorisée par document.
- Grille de la table cockpit : virtualisée, lignes 40–44px, padding cohérent avec les pages admin existantes.
- Cartes de vote : gouttière régulière, chips primaire pleins / secondaires en contour pointillé.

E) ANIMATIONS
Sobres, courtes (~120–200ms), easing doux ; réutilisent la classe de transition des panneaux InspectorPanel. Re-parcage du curseur = scroll amorti. Disclosure d'articles = hauteur animée discrète. prefers-reduced-motion respecté (transitions désactivées).

F) ÉTATS ACCORD / MAJORITÉ / DIVERGENCE (modèle visuel)
- Accord absolu (strict) : fond thème opacité ~0.33, rail uni --sem-success, badge « 5/5 », repliable en article 1 ligne, bouton 1 clic.
- Majorité : fond ~0.22 + liseré, rail hachuré --sem-warning, badge « 3/4 », non replié.
- Divergence (split) : pas de fond thème, bordure d'alerte --sem-danger, rail plein vif, badge « split » + badge « humain ≠ LLM » si signal fort. Conflits jamais repliés.
- Multi-label : couche primaire (fond) et couche secondaire (chips en contour) calculées et affichées SÉPARÉMENT ; un bloc peut être strict en primaire et split en secondaire (deux statuts indépendants, jamais d'empilement de teintes).
- Votes humains vs LLM : LLM en teinte désaturée + icône, jamais comptés dans le statut primaire de consensus humain.

G) AVATARS & TEMPS RÉEL
Avatars d'arbitres/annotateurs via common.identity (user_color + display_name), texte lisible via readableTextColor. Badge verrou « Arbitré par X » et status-dot en cours alimentés par la présence.

H) A11y TRANSVERSE
role=grid (table cockpit) avec navigation clavier complète ; radiogroup/aria-checked sur la carte de vote (comme InspectorJudgeCompare) ; section role=group aria-label par cartouche de conflit ; ordre de lecture DOM = ordre du document ; focus visible partout ; aria-describedby sur curseurs de pondération ; cibles tactiles ≥ 24px.