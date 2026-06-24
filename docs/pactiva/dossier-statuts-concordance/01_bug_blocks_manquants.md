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
Le plan affiche désormais **UN BLOC PAR PHRASE** (et non un résumé) : l'utilisateur veut voir
« les blocks comme au début », un par phrase restante.

Module pur `frontend/src/lib/planCoverage.ts` (testé, défensif, sans React) :
`coverageGaps`, `uncoveredCount`, `nextUncovered`.

`TocPanel` :
- **Un bloc par phrase, en ordre document** : pour chaque phrase 0..n−1, un chip de clause si
  annotée, sinon un **bloc « à annoter »** (`data-testid=plan-empty`, gabarit identique aux
  chips mais pointillés/sourdine, `[i]` + « à annoter ») cliquable → focalise la phrase dans le
  document (`focusSentence`) pour l'annoter sur place. Le plan reflète TOUT le document
  (193 blocs : 133 chips + 60 « à annoter »).
- **Encart de couverture** (`toc-coverage`) « 133/193 annotées · 60 restantes » +
  bouton **« Prochaine non annotée → »** (`toc-goto-gap`) qui cycle les phrases libres depuis
  la phrase focalisée. Masqués quand la couverture est complète (doc 100% annoté = un chip par
  phrase, aucun bloc « à annoter »).
- Tokens uniquement (zéro hex), `<button>` focusables, `aria-live` sur le compteur.

## 4. Tests
- `tests/planCoverage.test.ts` — couverture/gaps/`nextUncovered` (dont le cas Academia
  0..132/193 → 60 restantes).
- `tests/tocCoverage.test.tsx` — un bloc par phrase (chips + blocs « à annoter »), encart,
  saut + cyclage, doc complet sans bloc « à annoter ».
- e2e `sync-toc.spec.ts` — le plan affiche un bloc « à annoter » par phrase + couverture + saut.
- Suites : vitest **389** vertes, tsc clean.

## 5. Pour l'utilisateur
Les 60 phrases (133..192) n'avaient pas disparu : elles n'étaient pas encore annotées et le
plan ne les montrait pas. Désormais le plan affiche **un bloc par phrase** — chaque phrase
restante a son propre bloc « à annoter » (`[133]` … `[192]`), cliquable pour y aller — plus le
compteur « 60 restantes » et le bouton « Prochaine non annotée ».
