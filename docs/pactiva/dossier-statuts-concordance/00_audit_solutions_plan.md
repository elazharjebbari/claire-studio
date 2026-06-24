# Soumission confirmée · statuts/verrou · sur-scroll · KPIs de concordance — audit & plan

Quatre volets demandés. Audit (constats mesurés), solutions (tech/UI/UX), plan d'action et
plan d'exécution avec tests. Frontend majoritaire ; aucune migration backend.

---

## Volet 1 — Modale de confirmation de soumission

**Constat** : `WorkspaceToolbar.confirmSubmit` (succès) fait `markClean()` + `setSubmitOpen(false)`
— **aucun feedback** de réussite ; l'utilisateur ne sait pas que c'est soumis ni que le
document est verrouillé.

**Solution** : à la réussite (`patchAnnotation status=submitted` OK), ouvrir une **modale de
succès** (`SubmitSuccessDialog`) : ✓ « Annotation soumise », explication « le document est
**verrouillé** » + bouton **Déverrouiller** (réutilise `useUnlockAnnotation` → rouvre en
draft) + bouton **Fermer**. Design : icône lucide `CheckCircle2` vert, encart `Lock`, ton
rassurant, `role=dialog`, Échap/fermer.

**Plan** : composant `SubmitSuccessDialog` ; `confirmSubmit` ouvre la modale au lieu de juste
fermer ; test vitest (rendu + déverrouiller) + e2e si faisable.

---

## Volet 2 — Statuts des documents + verrou depuis les pages projet

**Constat** : `SessionRollup` expose `status` (`draft`/`submitted`/`unstarted`) mais pas
`locked`. Or `submitted ⟺ verrouillé` (auto-lock) → on dérive le verrou du statut pour
l'affichage. Pages `/projects/[slug]` et `/projects/[slug]/docs` n'affichent pas de badge de
statut, ni de contrôle de verrou.

**Solution** :
- **Badge de statut** réutilisable (`DocStatusBadge`) : `unstarted` (gris), `draft` (ambre
  « Brouillon »), `submitted` (émeraude « Soumis · 🔒 verrouillé »), `approved`/`rejected`.
  Icônes lucide (FileText/Pencil/Lock/CheckCircle2). Affiché par doc (project page « Ma
  session » + docs page).
- **Verrou de campagne (projet)** : toggle **admin** réutilisant `useLockProject`/
  `useUnlockProject` (déjà livré) sur la page projet, avec **confirmation** (gèle/dégèle
  toutes les sessions). Bandeau « Projet verrouillé » si actif. (Le verrou par-session reste
  géré dans l'atelier.)

**Plan** : `DocStatusBadge` ; intégrer dans project page + docs page ; bloc « Verrou de
campagne » (admin) avec confirm ; tests vitest (badge par statut) + e2e (page docs montre
les statuts).

---

## Volet 3 — Zone vide au bas des conteneurs scrollables

**Constat (mesuré, Playwright)** : `TocPanel` → **trailingGap 283px** (contenu 447 < aside
729) : grand vide sous le plan quand le contenu ne remplit pas — même bug que l'inspecteur
(déjà corrigé `min-h-full` + section qui grandit). Inspecteur : ~0 (corrigé). Document :
`py-8` (~32px, marge de lecture — acceptable). `#main-content` : pas de sur-scroll.

**Solution** : appliquer le **patron de remplissage** au `TocPanel` — colonne flex `h-full` :
en-tête + barre de sélection figés, **liste de clauses `flex-1` défilante**, **fieldset
Overlays épinglé en bas**. Plus de vide. (Document : padding de lecture conservé.)

**Plan** : restructurer `TocPanel` en flex-col remplissant ; test e2e/vitest de non-régression
du plan ; vérif visuelle (trailingGap ≈ 0).

---

## Volet 4 — KPIs de concordance (LLM↔LLM, humain↔LLM, meilleur accord %)

**Constat** : `iaa.py` ne calcule que le κ **humain↔humain**. La concordance demandée
(LLM↔LLM, humain↔chaque LLM, meilleur modèle + %) n'existe pas, MAIS les données sont
côté client : `useLlmAgreement` → `preByJudge` (thème par juge, forward-fill) + `nSentences` ;
le thème humain par phrase = `draftClauses` (forward-fill). → **calcul pur côté client**.

**Solution tech** : module pur `concordance.ts` :
`themeVectorFromClauses(clauses, n)` (forward-fill) ; `agreementPct(a, b)` (% de phrases
co-couvertes en accord) ; `concordanceReport(humanVec, judgeVecs)` → par juge `{pct, n}`,
+ `bestMatch` (juge le + concordant + %), + matrice **LLM↔LLM**.

**UI/UX** :
- **Atelier (temps réel)** — placement non intrusif : un **panneau « Concordance »** repliable
  dans la `WorkspaceToolbar` (ou un badge compact « ⌥ accord max : Claude 82% » qui déplie une
  mini-carte : barres par modèle + meilleur accord + accord LLM↔LLM). Mise à jour live au fil
  de l'annotation. Design sobre (barres horizontales colorées par modèle, lucide `GitCompare`).
- **Pages projet** — un encart KPI « Concordance » à côté de l'IAA (humain↔humain) : pour la
  session courante, accord avec chaque LLM + meilleur. (Agrégation document courant ; le
  multi-doc projet est une évolution backend ultérieure — noté.)

**Plan** : `concordance.ts` (+ tests purs) ; composant `ConcordancePanel` (atelier) ; encart
projet ; tests vitest (calculs + composant) + e2e (le panneau s'affiche/déplie).

---

## Plan d'exécution global
| Lot | Contenu | Vérif |
|---|---|---|
| A | V1 modale succès + V3 ToC fill | vitest + e2e + visuel |
| B | V2 badges statut + verrou campagne (pages projet) | vitest + e2e |
| C | V4 `concordance.ts` + ConcordancePanel atelier + encart projet | vitest purs + composant + e2e |
| — | Gate tsc+vitest+e2e, commit, deploy (health) à chaque lot | prod=local, 200 |

## Critères d'acceptation
- Soumission → modale de succès claire avec option de déverrouillage.
- Statuts (draft/soumis/verrouillé) visibles par doc ; verrou de campagne togglable (admin,
  confirmé) depuis les pages projet.
- Aucune grande zone vide au bas des asides (ToC rempli).
- KPIs de concordance LLM↔LLM et humain↔LLM (meilleur modèle + %) en temps réel sur l'atelier
  et sur les pages projet, élégants et non intrusifs.
- Zéro hex en dur (tokens), a11y, suites vertes, gate vert.
