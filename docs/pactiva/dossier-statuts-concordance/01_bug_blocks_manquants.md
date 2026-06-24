# Bug « blocks manquants » (Academia : 193 phrases, 133 blocks) — audit, diagnostic & correctif

> Reproche : sur le document **Academia**, la zone d'annotation montre ~192 phrases mais le
> panneau « blocks » (plan) n'affiche que **132/133 clauses** ; la dernière est
> `WARRANTY_DISCLAIMER @ [132]` (provenance moteur, C2). « Où sont le reste ? »

## 1. Audit — vérité terrain (requêtes lecture seule sur la prod)
- Document **Academia** (id 4) = **193 phrases** (indices 0..192), **toutes du vrai contenu
  juridique** jusqu'à la fin (aucune phrase vide, aucune re-segmentation/padding).
- Annotation de l'utilisateur (ANN 7, brouillon) = **133 clauses couvrant 0..132 EN CONTINU**,
  toutes `validated`. Mix de provenance : **94 manuelles** (niveau vide) + **39 moteur**
  (C2×12, C3×19, C4×3, C5×5). **60 phrases manquantes : 133..192** (un seul trou contigu).
- Pré-annotations LLM (v9.2) : claude 27 (0..192), codex 38 (0..188), mistral 30 (0..189).
- Couverture **reconstruite** du moteur de triage (forward-fill, minJudges=2) = **193/193,
  aucun trou** : les suggestions pour 133..192 ÉTAIENT disponibles.

## 2. Diagnostic — PAS de perte de données
**Aucun bug de troncature / pagination / cap / segmentation.** Les 193 phrases sont réelles ;
le dernier chip `[132]` est la **vraie frontière** de l'annotation humaine. Les 60 phrases
133..192 sont simplement **pas encore annotées**.

**Cause racine = angle mort UX du plan** : `TocPanel` ne listait QUE les `draftClauses`
(clauses annotées). Sur un long document partiellement annoté, les phrases sans clause
étaient **structurellement invisibles** dans le plan et **inatteignables** depuis celui-ci →
illusion de « blocks disparus ». (Vérifié de façon adverse : aucune limite réelle dans
`useTriage`/`TriageQueue`/`applyTriageBatch`/sérialiseur de clauses/pagination DRF.)

## 3. Solution (frontend, modèle per-sentence inchangé)
Module pur `frontend/src/lib/planCoverage.ts` (testé) :
- `coverageGaps`, `uncoveredCount`, `nextUncovered`, `planOutline` (clauses + trous groupés en
  ordre document). Défensifs, sans React.

`TocPanel` :
- **Plan COMPLET en ordre document** : chips de clauses **+ lignes « trou »** groupées
  (`data-testid=plan-gap`, ex. « 60 phrases non annotées [133]–[192] ») cliquables → saut à la
  1ʳᵉ phrase libre (`focusSentence`). Le plan reflète désormais TOUT le document.
- **Encart de couverture** (`toc-coverage`) « 133/193 annotées · 60 restantes » +
  bouton **« Prochaine non annotée → »** (`toc-goto-gap`) qui cycle les trous depuis la phrase
  focalisée. Masqués quand la couverture est complète (doc 100% annoté = plan inchangé).
- Tokens uniquement (zéro hex), `<button>` focusables, `aria-live` sur le compteur.

## 4. Tests
- `tests/planCoverage.test.ts` (10) — dont le cas Academia exact (0..132/193 → trou 133..192).
- `tests/tocCoverage.test.tsx` (4) — encart, ligne de trou, saut + cyclage, doc complet sans trou.
- e2e `sync-toc.spec.ts` — le plan expose les trous + couverture + saut (Fitbit partiel).
- Suites : vitest **392** vertes, tsc clean.

## 5. Pour l'utilisateur
Les 60 phrases (133..192) n'avaient pas disparu : elles n'étaient pas encore annotées et le
plan ne les montrait pas. Désormais le plan affiche la ligne « 60 phrases non annotées » et le
bouton « Prochaine non annotée » pour les traiter une à une.
