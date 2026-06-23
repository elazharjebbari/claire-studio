# Étude de design — Survol « clause abusive » (3 options × domaine + recommandation)

> Méthode : pour chaque domaine, **3 options réellement distinctes** analysées
> (forces / faiblesses / pertinence), puis une **recommandation argumentée**. La synthèse
> unifiée est dans `02_proposition_finale.md`. Contraintes : voir `00_audit_interface.md`
> (donnée par phrase, zéro hex en dur, couleur+glyphe, CSS/Tailwind only, surface
> `bg-elevated`).

---

## Domaine 1 — Surlignage de l'évidence

Rappel : **aucun span d'évidence** en donnée. La phrase marquée = l'unité d'évidence.

**Option A — Phrase entière surlignée (vérité terrain).** Au survol, la phrase marquée
reçoit un surlignage jaune renforcé (`bg-amber-300/20` + liseré gauche `amber`), distinct
de l'overlay permanent (fond teinté catégorie). Le popover dit « passage marqué injuste ».
- *Forces* : 100 % honnête (c'est la granularité réelle) ; zéro hypothèse ; trivial.
- *Faiblesses* : peu « précis » visuellement quand la phrase est longue ; n'isole pas le
  fragment fautif.
- *Pertinence* : élevée — fidèle à CLAUDETTE, sans dette.

**Option B — Emphase heuristique intra-phrase.** Un petit moteur de mots-clés par catégorie
(`A`→/arbitrat|binding/, `TER`→/terminat|suspend/, `LTD`→/no(t)? liable|disclaim|as is/…)
souligne le fragment correspondant en jaune ; le reste de la phrase est neutre.
- *Forces* : visuellement « pointe » le passage, sensation de précision.
- *Faiblesses* : **pas de vérité terrain** → risque de faux positifs/négatifs ; maintenance
  d'un lexique ; peut induire en erreur (l'annotateur croit à une donnée vérifiée).
- *Pertinence* : moyenne — séduisant mais épistémiquement risqué seul.

**Option C — Hybride : phrase surlignée + repère indicatif étiqueté.** La phrase entière est
surlignée (jaune doux) comme évidence ; PAR-DESSUS, les mots-clés de catégorie sont
soulignés (pointillé) avec une **étiquette explicite « repère indicatif, non vérifié »**
dans le popover. Le repère est désactivable et n'apparaît que s'il matche.
- *Forces* : honnête (phrase = vérité) **et** utile (pointe un fragment) ; l'étiquette
  prévient toute confusion ; dégrade proprement (si aucun mot-clé → juste la phrase).
- *Faiblesses* : un peu plus de code (moteur + rendu `<mark>`) ; deux niveaux d'emphase à
  équilibrer visuellement.
- *Pertinence* : très élevée — concilie complétude/ergonomie et rigueur.

> **Recommandation : Option C.** La phrase surlignée porte la vérité terrain ; l'emphase
> de mots-clés (clairement étiquetée « indicatif ») apporte le confort « pointer le
> passage » demandé sans mentir sur la donnée. Surlignage jaune (`amber`) **réservé au
> survol** pour ne pas entrer en collision avec l'overlay permanent (teinte de catégorie).

---

## Domaine 2 — Déclenchement & positionnement

**Option A — Survol passif, ancré sous la marque, délai 350 ms.** Apparition au
`mouseenter` de la marque d'injustice (pas de la phrase neutre), fermeture au `mouseleave`
(120 ms de grâce). Positionné via `useAnchoredPosition` au coin bas-gauche de la marque.
- *Forces* : non-intrusif, cohérent avec `RationaleHover` ; simple.
- *Faiblesses* : on ne peut pas survoler le contenu (popover `pointer-events-none`) → pas
  de scroll/sélection dans la fiche.
- *Pertinence* : élevée pour une fiche courte.

**Option B — Survol + épinglage au clic.** Survol = aperçu passif ; **clic sur la marque** =
épingle la fiche (interactive, `role="dialog"`, Échap/clic-extérieur, focus) pour lire en
détail / scroller / cliquer une correspondance thématique.
- *Forces* : meilleur des deux mondes (aperçu rapide + lecture approfondie) ; gère les
  fiches longues (multi-catégories).
- *Faiblesses* : 2 modes à implémenter/tester ; le clic sur la phrase a déjà un sens
  (sélection de clause) → il faut cliquer la **marque** précisément, pas la phrase.
- *Pertinence* : très élevée pour une fiche « complète et détaillée ».

**Option C — Panneau latéral contextuel.** Le survol pousse l'info dans un encart fixe
(ex. sous l'inspecteur) plutôt qu'un flottant.
- *Forces* : pas de problème de positionnement/bords ; place illimitée.
- *Faiblesses* : déconnecté du point de regard (œil fait l'aller-retour) ; lourd ; casse le
  modèle « survol = info au point ».
- *Pertinence* : faible pour un outil de survol.

> **Recommandation : Option B.** Survol passif (aperçu, délai ~350 ms, ancré sous la marque)
> **+ épinglage au clic sur la marque** pour la fiche complète interactive. Le déclencheur
> est la **marque d'injustice** (scope « à proximité des clauses abusives » respecté), pas
> la phrase — pas de conflit avec la sélection de clause. Le `RationaleHover` (thème/
> rationale) reste prioritaire sur les phrases annotées non marquées ; sur une phrase
> marquée, la fiche injustice prime.

---

## Domaine 3 — Structure du contenu & hiérarchie

**Option A — Liste verticale unique.** En-tête (sévérité max + nb de catégories), puis pour
chaque catégorie une ligne (badge + libellé + niveau + définition courte), puis bloc
évidence, puis correspondances thématiques.
- *Forces* : tout visible d'un coup, scan vertical naturel ; simple.
- *Faiblesses* : peut devenir long si 3-4 catégories × définitions.
- *Pertinence* : élevée (la plupart des phrases ont 1-2 catégories).

**Option B — Onglets par catégorie.** Un onglet par catégorie présente, en aperçu pliée
seulement le badge ; le détail (définition, thème) dans l'onglet actif.
- *Forces* : compact ; bon si beaucoup de catégories.
- *Faiblesses* : cache de l'info (clics requis) → contredit « tout afficher » ; sur-ingénierie
  pour 1-2 catégories.
- *Pertinence* : moyenne.

**Option C — Carte « primaire » + chips secondaires.** La catégorie la plus sévère est
développée (définition + thème) ; les autres en chips compacts cliquables qui développent.
- *Forces* : hiérarchise par sévérité ; compact tout en gardant l'accès.
- *Faiblesses* : notion de « primaire » arbitraire si ex æquo ; interaction supplémentaire.
- *Pertinence* : élevée pour multi-catégories nombreuses.

> **Recommandation : Option A (liste), avec tri par sévérité décroissante.** « Complet et
> très détaillé » = tout visible sans clic. Ordre des sections : (1) en-tête synthèse
> (sévérité dominante + compteur) ; (2) une carte par catégorie triée par niveau ↓ (badge
> coloré + glyphe + libellé + **sens** « clause qui… » + niveau explicité) ; (3) **Évidence**
> (phrase citée + repère indicatif) ; (4) **Correspondance thématique** indicative + rappel
> « catégorie d'injustice ≠ votre thème ». Au-delà de 3 catégories, le corps scrolle (mode
> épinglé). Cap visuel : aperçu survol = en-tête + 1-2 cartes ; épinglé = tout.

---

## Domaine 4 — Couleurs & encodage de sévérité

**Option A — Couleur = catégorie, intensité/opacité = niveau.** Chaque catégorie sa teinte
(token) ; le niveau module l'alpha (0.25/0.55/0.9), comme l'overlay.
- *Forces* : cohérent avec l'overlay existant ; 8 teintes déjà définies.
- *Faiblesses* : l'alpha seul code mal la sévérité (peu lisible) ; 8 couleurs + 3 niveaux =
  charge cognitive.
- *Pertinence* : bonne pour la catégorie, insuffisante pour la sévérité seule.

**Option B — Sévérité = échelle sémantique dédiée (vert/ambre/rouge) + glyphe + libellé.**
Niveau 1 = `success`/info doux, 2 = `warning` ambre, 3 = `danger` rouge ; chacun avec un
glyphe (ShieldCheck / AlertTriangle / ShieldAlert) et le libellé (« potentiellement
injuste »…). La couleur de **catégorie** reste sur le badge de catégorie (puce + code).
- *Forces* : sévérité lisible en un coup d'œil, daltonien-safe (glyphe+texte) ; sépare
  proprement « quoi » (catégorie) de « combien grave » (niveau) ; aligné charte (familles
  séparées).
- *Faiblesses* : introduit une 2ᵉ dimension couleur → discipline requise pour ne pas
  surcharger.
- *Pertinence* : très élevée.

**Option C — Jauge de sévérité 3 segments.** Une mini-jauge ●●● (1-3 segments remplis) par
catégorie, monochrome.
- *Forces* : compacte, comparable ; daltonien-safe.
- *Faiblesses* : moins « parlante » que couleur+libellé ; n'exprime pas le sens.
- *Pertinence* : moyenne (bon complément, pas suffisant seul).

> **Recommandation : Option B + jauge (C) en complément.** Sévérité encodée par **échelle
> sémantique (vert→ambre→rouge) + glyphe + libellé**, doublée d'une **jauge 3 segments** pour
> la comparabilité. Catégorie encodée séparément (puce de couleur token + code). Surface
> popover `bg-elevated`, textes AA (`readableTextColor` pour badges pleins). Surlignage
> d'évidence en **ambre/jaune** (neutre vis-à-vis des 8 teintes de catégorie). Zéro hex en
> dur → tokens + classes sémantiques.

---

## Domaine 5 — Animation & micro-interactions

**Option A — `animate-fade-in` standard (120 ms).** Réutilise la seule keyframe maison.
- *Forces* : cohérent avec tous les hovers ; sobre ; reduced-motion déjà géré.
- *Faiblesses* : très discret (peu de « waouh »).
- *Pertinence* : élevée (cohérence > spectacle).

**Option B — Fade + slide directionnel + lift de la marque.** Fiche en fade+translateY ;
la marque survolée reçoit un léger `ring`/élévation pour lier visuellement déclencheur↔fiche.
- *Forces* : feedback clair sur le lien marque↔fiche ; reste pro.
- *Faiblesses* : un poil plus de CSS ; lift à doser pour ne pas « sauter ».
- *Pertinence* : élevée — micro-soin demandé.

**Option C — Animations riches (échelle, pulse de sévérité niveau 3).** Pulse sur le badge
niveau 3, transitions élastiques.
- *Forces* : attire l'œil sur le grave.
- *Faiblesses* : risque gadget/distrayant ; pulse permanent fatigant ; contre l'esprit sobre.
- *Pertinence* : faible.

> **Recommandation : Option B.** `animate-fade-in` (fade + translateY léger) pour la fiche +
> **ring ambre subtil sur la marque survolée** (lien visuel), transitions `transition-colors`
> sur badges/onglets. Pas de pulse permanent. Tout sous `prefers-reduced-motion` (déjà
> neutralisé globalement).

---

## Domaine 6 — Espaces, typographie & layout

**Option A — Compact dense (`text-xs`, `gap-1.5`, `p-2.5`, `w-72`).** Très ramassé.
- *Forces* : peu encombrant ; rapide à lire.
- *Faiblesses* : info riche → vite à l'étroit ; respiration faible.
- *Pertinence* : bonne pour l'aperçu survol, juste pour la fiche complète.

**Option B — Confort lisible (`text-xs`/`text-[13px]`, `gap-2.5`, `p-3.5`, `w-80`/`max-w-sm`,
sections séparées par `border-t border-line/60`).** Rythme d'espacement aligné
InspectorPanel/BoundaryEvidence.
- *Forces* : lisible, structuré, « pro » ; tient l'info complète.
- *Faiblesses* : un peu plus large.
- *Pertinence* : très élevée.

**Option C — Large aéré (`w-96`, `p-5`, grandes sections).** Maximum de respiration.
- *Forces* : très confortable.
- *Faiblesses* : trop grand pour un survol ; masque le document.
- *Pertinence* : faible pour un flottant.

> **Recommandation : Option B.** `max-w-sm` (~`w-80`/22rem), `p-3.5`, `gap-2.5`, sections
> titrées `text-[11px] font-semibold uppercase tracking-wide text-ink-muted`, corps
> `text-xs`/`text-[13px]`, séparateurs `border-t border-line/60`, `max-h-[70vh]
> overflow-auto` en mode épinglé. Cohérent avec les patrons maison.

---

## Domaine 7 — Ergonomie, accessibilité & états

**Option A — Tooltip passif pur (`role="tooltip"`, `aria-describedby`).** Comme
`RationaleHover`.
- *Forces* : simple, standard, non-intrusif.
- *Faiblesses* : pas d'accès clavier réel ni d'interaction (liens thème).
- *Pertinence* : ok pour l'aperçu, insuffisant pour la fiche complète.

**Option B — Aperçu tooltip + fiche épinglée `role="dialog"` accessible.** Survol = tooltip ;
épinglé = dialog focusable (Échap, clic-extérieur, focus initial), ouvrable aussi au
**clavier** (la marque devient `tabbable`, Entrée/Espace épingle).
- *Forces* : a11y complète (souris + clavier + lecteur d'écran) ; gère les fiches longues.
- *Faiblesses* : 2 rôles ARIA à gérer proprement.
- *Pertinence* : très élevée.

**Option C — Toujours interactif (popover au survol avec pointer-events).** Le survol ouvre
directement un popover interactif (pas de pointer-events-none).
- *Forces* : un seul mode.
- *Faiblesses* : popover qui « capture » au survol = papillotement, gêne sélection/lecture.
- *Pertinence* : faible.

> **Recommandation : Option B.** Aperçu **passif** au survol (tooltip, `pointer-events-none`,
> non-intrusif) ; **fiche épinglée** `role="dialog"` au clic/clavier sur la marque (rendue
> `tabIndex=0`, `aria-haspopup`, Entrée/Espace) avec Échap/clic-extérieur/focus. États gérés :
> 1 catégorie / multi / niveau 1↔3 / overlay désactivé (pas de marque → pas de survol).
> Découvrabilité : `cursor-help` sur les marques + le glyphe d'alerte amorce l'affordance.

---

## Récapitulatif des recommandations

| Domaine | Choix retenu |
|---|---|
| Surlignage | **C** — phrase surlignée (vérité) + repère mots-clés indicatif étiqueté |
| Déclenchement | **B** — survol passif (≈350 ms) + épinglage au clic sur la marque |
| Structure | **A** — liste verticale complète, triée par sévérité ↓ |
| Couleurs/sévérité | **B+C** — échelle sémantique + glyphe + libellé + jauge ; catégorie séparée |
| Animation | **B** — fade-in + ring ambre sur la marque ; sobre |
| Espaces/typo | **B** — `max-w-sm`, `p-3.5`, sections titrées, séparateurs |
| Ergonomie/a11y | **B** — tooltip passif + dialog épinglé accessible (souris+clavier) |

→ Proposition unifiée et anatomie complète : `02_proposition_finale.md`.
