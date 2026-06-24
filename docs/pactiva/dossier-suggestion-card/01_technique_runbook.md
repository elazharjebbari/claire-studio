# Carte de suggestion — dossier technique, plan d'exécution & tests

> Mise en œuvre de `00_audit_et_etude.md`. **Frontend uniquement** : le moteur (pur,
> golden-testé) et le backend ne changent pas. La donnée existe déjà ; on ajoute la
> seule chose manquante (votes par juge + texte de phrase) par plomberie additive.

---

## 1. Architecture & data

```
useTriage (buildTriageItems, PUR)  ──►  TriageItem { index, result, votes }   ← + votes (ADDITIF)
        │
useDocument(documentId) ──► textByIndex (n° phrase → texte)                    ← contexte phrase
        │
TriageQueue ──► QueueRow { index, result, votes, text }
        │
TriageQueueView (navigation, pos) ──► SuggestionCard (refondue)
```

**Changements de données (additifs, sans rupture)** :
- `TriageItem.votes?: Record<string,string>` (judgeId → code thème) — déjà calculé dans
  `buildTriageItems`, aujourd'hui jeté ; on l'expose.
- `QueueRow` gagne `votes` + `text`.
- `SuggestionCard` gagne `sentenceText?: string` + `votes?: Record<string,string>`.

**Humanisation** : la carte n'affiche JAMAIS de code brut — `getThemeToken(code).label` +
puce couleur. Le « pourquoi » = `TRIAGE_LEVEL_META[level].meaning` (code-free) + une ligne
SPÉCIFIQUE reconstruite des données structurées (cluster = `{label(primary)} + {label(sec)}` ;
override = `{label(from)} (refuge) → {label(to)}`). Les votes → libellés de juges
(`llmJudgeLabel`) + libellés de thèmes.

---

## 2. Composants

### `SuggestionCard.tsx` (refonte présentationnelle)
- En-tête : badge niveau (icône **lucide** `SEVERITY/LEVEL_ICON` + `C# · Label`, teinté
  `meta.color`) + bouton action primaire nommé. Liseré gauche `meta.color`.
- **Texte de la phrase** (cité, `border-l`, tronqué + « voir plus »).
- **Ce que disent les juges** (`Users`) : récap votes (puce juge + flèche + libellé thème) +
  **jauge d'accord** (n d'accord / N) + frontière (support).
- **Décision recommandée** (`Sparkles`) : `ThemeChip` en LIBELLÉS (primaire plein discret,
  secondaire pointillé) + type de frontière (icône).
- **Pourquoi ce niveau** (`Info`) : `meta.meaning` lisible + ligne spécifique humanisée.
- **Alternatives** (`Shuffle`) : candidats = chips libellés + support → « Choisir »
  (unitaire) ; « + Multi-label » (composer un set) ; C3 « Permuter » / « Retirer 2ⁿᵈ » ;
  override « Annuler ». Section visuellement distincte.
- Icônes lucide (ShieldCheck/Check/Layers/AlertTriangle/Scale, Users/Sparkles/Info/Shuffle,
  ArrowRight/Repeat/Minus/Plus/Undo2). Zéro hex hors tokens. Couleur+texte toujours.

### `LEVEL_ICON` (carte) : map `TriageLevel → composant lucide` (C1 ShieldCheck, C2 Check,
C3 Layers, C4 AlertTriangle, C5 Scale). *(Ne modifie pas `levels.ts` `icon` unicode —
gardé pour la légende/compteurs ; la carte utilise sa propre map lucide.)*

### `useTriage.ts` / `buildTriageItems` : ajouter `votes` à chaque item (pur).
### `TriageQueue.tsx` : `useDocument` → `textByIndex` ; rows `{index,result,votes,text}`.
### `TriageQueueView.tsx` : passe `sentenceText`/`votes` du `current` à la carte.

---

## 3. Plan de développement (séquencé)
1. `useTriage` : exposer `votes` (TriageItem) + test pur.
2. `SuggestionCard` refonte (sections, lucide, libellés, votes, jauge, alternatives) + test.
3. `TriageQueue` : `useDocument` → texte ; rows enrichies (votes/text).
4. `TriageQueueView` : passer texte/votes à la carte.
5. Fixtures/MSW : s'assurer que le doc + pré-annotations multi-juges alimentent la carte.
6. Tests vitest (carte : libellés, votes, jauge, niveaux, alternatives, a11y) + e2e
   (file de triage : carte lisible, accepter, alternative, multi).
7. Gate tsc + vitest + e2e ; revue ; commit + déploiement.

## 4. Plan d'exécution
| # | Étape | Vérif |
|---|---|---|
| 1 | `useTriage.votes` (+ test) | vitest pur vert (non-régression engine/golden) |
| 2 | `SuggestionCard` refonte (+ test) | test composant vert |
| 3 | `TriageQueue` texte+votes ; `TriageQueueView` câblage | tsc |
| 4 | Tests vitest + e2e triage | verts |
| 5 | Revue (charte/hex, a11y, libellés, non-régression accept/batch) | corrigé |
| 6 | Commit + deploy (gate + health) | prod=local, 200 |

## 5. Tests de validation robustes
- **Pur** : `buildTriageItems` expose des votes corrects (judge→thème) ; non-régression du
  moteur (golden + sweep inchangés).
- **Composant** (`suggestionCard.test.tsx`) : affiche LIBELLÉS (pas codes) ; sections
  Décision/Pourquoi/Alternatives ; jauge d'accord ; texte de phrase ; icône lucide par
  niveau ; C1 accepter, C3 permuter/retirer, C4/C5 choisir candidat ; a11y (section/aria).
- **e2e** (`triage.spec.ts` étendu) : ouvrir la file → la carte montre le texte + le
  « pourquoi » lisible + alternatives ; accepter met à jour le document ; choisir une
  alternative ; non-régression batch C1.

## 6. Critères d'acceptation
Aucun code de thème brut affiché ; « pourquoi » lisible (meaning + spécifique + votes) ;
texte de phrase visible ; alternatives unitaires/multiples claires ; icônes lucide ;
charte (couleur+texte, zéro hex en dur) ; suites vertes ; gate vert.
