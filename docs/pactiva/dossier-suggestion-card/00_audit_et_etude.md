# Carte de suggestion C1→C5 — audit, étude (3 options/aspect) & recommandation

> Cible : `SuggestionCard` (dans `TriageQueue`/`TriageQueueView`), qui explique le choix du
> moteur C1→C5 et propose des annotations (unitaires/multiples). Reproche : peu lisible,
> on ne comprend pas « pourquoi cette recommandation », et les alternatives sont obscures.

---

## 1. Audit (état des lieux)

**La donnée est riche, la présentation est pauvre.** `TriageResult` fournit déjà :
`level`, `action`, `labelMode`, `disagreementType`, `labels[]` (avec `support` = nb de
juges), `candidates[]` (alternatives), `boundary{type,support}`, `override`, et surtout
`explanation{context, decision, logic}` (le *pourquoi* déterministe). `TRIAGE_LEVEL_META`
donne `label/color/icon/meaning/action`.

**Défauts constatés (`SuggestionCard.tsx`)** :
1. **Codes bruts** : `ThemeChip` affiche `{label}` = le CODE (`LIMITATION_LIABILITY`), pas
   le libellé humain « Limitation de responsabilité ». Illisible (`SuggestionCard.tsx:17-39`).
2. **« Pourquoi » noyé** : `explanation.logic` en `text-[11px] text-ink-muted` et `context`
   en `text-[10px] text-ink-muted/80` — minuscule, gris pâle, aplati sous la décision
   (`:120-122`). Pourtant c'est LA réponse à « pourquoi cette reco ».
3. **Glyphes Unicode hétérogènes** : niveaux ●◐⧉◑⚖ + `✓ ◻ ▮ ┄ ⇅ − → ↺` — incohérent avec
   l'app (lucide partout), pas « premium ».
4. **Hiérarchie plate** : badge + bouton + chips + 2 lignes grises + boutons d'action, sans
   les 3 temps explicites du moteur (juges → décision → règle).
5. **Texte de la phrase ABSENT** : on trie sans voir la clause concernée (la vue n'affiche
   que « phrase #index »). Impossible de juger « pourquoi » sans le texte.
6. **Confiance non visualisée** : `labels[].support`, `boundary.support`, l'accord N-way ne
   sont pas montrés (pas de jauge/votes) — seul le texte `context` les mentionne, en gris.
7. **Alternatives obscures** : C4 « → Choisir CODE », C5/open = boutons de CODES, sans
   distinction *unitaire* vs *multiple*, sans libellé ni support, et C5 n'offre pas
   explicitement « créer un multi » (pourtant dans `meta.action`).
8. **Couleurs** : chip primaire en **fond plein couleur de thème** → risque de conflit
   visuel avec le code couleur du **niveau** (mélange des familles, charte).

→ La refonte est **présentationnelle** (frontend) : zéro changement moteur/backend.

---

## 2. Étude — 3 options par aspect (forces / faiblesses / pertinence / usage-friendly)

### Aspect A — Structure du « pourquoi » (context / decision / logic)
- **A1. Trois sections étiquetées empilées** : « Ce que disent les juges » (context),
  « Décision » (set+frontière), « Pourquoi ce niveau » (logic), chacune avec titre + icône.
  - *Forces* : map 1:1 sur la donnée du moteur ; ultra-lisible ; pédagogique. *Faiblesses* :
    plus haut. *Pertinence* : ★★★ — répond exactement à « pourquoi ». *Usage* : excellent.
- **A2. Une phrase de synthèse + détail repliable** : un résumé en gras + « détails » qui
  déplie context/logic.
  - *Forces* : compact. *Faiblesses* : cache le « pourquoi » (un clic de plus) → contredit
    le besoin. *Pertinence* : ★★. *Usage* : moyen.
- **A3. Tooltip au survol du badge** : la logique en info-bulle.
  - *Forces* : minimal. *Faiblesses* : caché, non tactile, illisible à froid. *Pertinence* :
    ★. *Usage* : faible.
- **→ Reco : A1** (3 sections étiquetées, icônes lucide, contrastes lisibles).

### Aspect B — Affichage des thèmes
- **B1. Puce couleur + libellé humain + rôle (primaire/secondaire)** via `getThemeToken`.
  - *Forces* : lisible, cohérent avec l'app. *Pertinence* : ★★★. *Usage* : excellent.
- **B2. Code + libellé** (« LTD · Limitation de responsabilité »).
  - *Forces* : traçable. *Faiblesses* : verbeux/redondant. *Pertinence* : ★★. *Usage* : moyen.
- **B3. Code seul stylé** (statu quo amélioré).
  - *Forces* : compact. *Faiblesses* : illisible pour non-initiés (le reproche actuel).
    *Pertinence* : ★. *Usage* : faible.
- **→ Reco : B1** (puce couleur + libellé ; primaire = chip plein discret, secondaire =
  contour pointillé ; rôle explicite).

### Aspect C — Icônes & encodage du niveau
- **C1. Lucide par niveau** (C1 ShieldCheck, C2 Check, C3 Layers, C4 AlertTriangle,
  C5 Scale) + badge teinté `${color}` + libellé.
  - *Forces* : premium, cohérent, daltonien-safe (icône+texte). *Pertinence* : ★★★.
- **C2. Garder les glyphes Unicode**.
  - *Faiblesses* : incohérent, le reproche. *Pertinence* : ★.
- **C3. Pastille couleur seule**.
  - *Faiblesses* : couleur seule (charte interdit), peu parlant. *Pertinence* : ★.
- **→ Reco : C1** (lucide + libellé + couleur ; jamais la couleur seule).

### Aspect D — Confiance / votes des juges
- **D1. Mini-récap des votes** (puces juges → thème, ex. « Claude·Codex → LTD, Mistral →
  WARRANTY ») dérivé du `context`, + jauge d'accord (n/N).
  - *Forces* : montre concrètement « pourquoi », confiance lisible. *Pertinence* : ★★★.
- **D2. Texte `context` mis en valeur seul** (sans visualisation).
  - *Forces* : simple. *Faiblesses* : moins parlant qu'une viz. *Pertinence* : ★★.
- **D3. Score % opaque**.
  - *Faiblesses* : faux sentiment de précision, non interprétable. *Pertinence* : ★.
- **→ Reco : D1** (récap votes + jauge d'accord ; alimenté par le moteur, pas un LLM).
  *(Nécessite d'exposer les votes par juge depuis `useTriage` — ajout mineur.)*

### Aspect E — Annotations alternatives (unitaires / multiples)
- **E1. Section « Alternatives » dédiée** : chaque candidat = chip libellé + support +
  bouton « Choisir (primaire) » ; plus « + Faire un multi-label » (ouvre le set) ; et pour
  C3, permuter / retirer 2ⁿᵈ. Séparée visuellement de la décision recommandée.
  - *Forces* : distingue clairement *unitaire* (choisir 1) vs *multiple* (composer un set) ;
    libellés + support ; actions nommées. *Pertinence* : ★★★. *Usage* : excellent.
- **E2. Menu déroulant « autres choix »**.
  - *Forces* : compact. *Faiblesses* : cache les options, friction. *Pertinence* : ★★.
- **E3. Statu quo** (boutons de codes en vrac).
  - *Faiblesses* : illisible, pas de notion unitaire/multiple. *Pertinence* : ★.
- **→ Reco : E1** (section Alternatives lisible : candidats en libellés + support, choisir
  unitaire OU composer un multi, actions C3/C4/C5 nommées).

### Aspect F — Contexte : texte de la phrase
- **F1. Afficher le TEXTE de la phrase en tête de carte** (cité, tronqué + dépliable).
  - *Forces* : on voit ce qu'on décide → « pourquoi » devient évident. *Pertinence* : ★★★.
- **F2. Seulement le n° de phrase** (statu quo).
  - *Faiblesses* : on décide à l'aveugle. *Pertinence* : ★.
- **F3. Surligner la phrase dans le document seulement**.
  - *Forces* : déjà le cas (focus). *Faiblesses* : aller-retour œil. *Pertinence* : ★★.
- **→ Reco : F1 + F3** (texte en tête de carte ET focus document — déjà là).

### Aspect G — Layout, densité, couleurs (charte)
- **G1. Carte structurée à sections + séparateurs, espaces réguliers, largeur file
  élargie au besoin** ; couleur de NIVEAU réservée au badge/liseré, couleur de THÈME aux
  puces (familles séparées).
  - *Forces* : pro, respire, charte respectée. *Pertinence* : ★★★.
- **G2. Compactage maximal** (tout petit).
  - *Faiblesses* : le reproche actuel. *Pertinence* : ★.
- **G3. Carte pleine page**.
  - *Faiblesses* : disproportionné pour une file. *Pertinence* : ★.
- **→ Reco : G1** (liseré gauche couleur de niveau, sections espacées, `text-xs`/`text-[13px]`
  lisibles, zéro hex en dur hors tokens).

---

## 3. Recommandation finale (UI/UX irréprochable)

Carte refondue, du haut vers le bas :
1. **En-tête** : badge **niveau** (icône lucide + `C# · Label`, teinté `meta.color`) +
   **action primaire** nommée (Accepter/Confirmer/Valider le set/Garder majorité). Liseré
   gauche de la carte dans la couleur du niveau.
2. **Texte de la phrase** (cité, `border-l`, tronqué + « voir plus ») — *ce qu'on décide*.
3. **Ce que disent les juges** (icône Users) : récap votes (puces juge→thème) + **jauge
   d'accord** n/N + frontière (support).
4. **Décision recommandée** (icône Sparkles/Check) : puces de thèmes en **libellés** (primaire
   plein discret + secondaire pointillé) + type de frontière.
5. **Pourquoi ce niveau** (icône Info) : `explanation.logic` en texte **lisible** (pas gris
   pâle), une ligne.
6. **Alternatives** (icône Shuffle, repliable si nombreuses) : candidats en libellés +
   support → « Choisir » (unitaire) ; « + Multi-label » (composer) ; C3 permuter/retirer 2ⁿᵈ ;
   override → annuler. Distinction nette *unitaire* vs *multiple*.
7. Tout en **lucide**, libellés humains, contrastes AA, couleur+texte (jamais couleur seule),
   `prefers-reduced-motion` ok, zéro hex en dur hors tokens.

Détails techniques, data, archi, plan de dev/exécution & tests : `01_technique_runbook.md`.
