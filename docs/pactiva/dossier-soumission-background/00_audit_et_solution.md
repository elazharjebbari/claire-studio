# Bug « modifications pas encore enregistrées » (Atlas) + soumission en tâche de fond

## 1. Audit — cause racine (preuve : logs prod + code)

Le message apparaît quand `flush()` (anti-perte de la soumission) **ne converge pas** :
`planClauseSync(brouillon, persistedRef)` reste non vide après 12 passes.

**Vérité terrain** (prod, lecture seule) :
- Doc **Atlas** (id 7, 60 phrases), annotation ANN 11 (brouillon) = 60 clauses.
- **Logs daphne** : les **mêmes ~6 clauses** (1025, 1029, 1030, 1052, 1053, 1078) sont
  **PATCHées en boucle**, toutes en **200** (pas de 400). ⇒ pas une erreur terminale : un
  **DIFF PERPÉTUEL**.
- Ces 6 clauses sont des décisions du **moteur de triage** : `boundary=soft`, `triage_level`
  C2–C5, et un `support` multi-label **non nul** (1 ou 2).

**Mécanisme** : à la soumission, l'autosave PATCHe la clause (200), puis pose
`persistedRef = réponse serveur`. Si le serveur **normalise un champ dérivé** (support /
frontière / niveau / nature) différemment de ce que porte le brouillon, `sameFields(brouillon,
réponse)` reste **faux** → la clause est re-PATCHée à chaque passe → `flush()` ne converge
jamais → soumission bloquée. (Un round-trip d'une clause **non éditée** converge bien — le diff
vient d'une **édition non encore réconciliée** sur un champ que le serveur ne représente pas à
l'identique.)

> Variante connexe écartée ici (mais réelle) : une `legal_nature` du **vocab LLM** hors schéma
> (`GOVERNANCE`/`META`/`UNKNOWN`…) — le batch l'ignore en silence (`except: pass`), le PATCH
> unitaire la rejette (400). Sur Atlas, les natures sont `None` (logs 200) → ce n'est pas le
> déclencheur ici, mais la réconciliation ci-dessous couvre aussi ce cas.

## 2. Correctif #1 — convergence garantie (réconciliation brouillon ← serveur)

Pendant le **flush** (soumission : l'utilisateur ne tape pas), après chaque écriture **réussie**,
on **aligne le brouillon sur la réponse serveur** (champs persistés) via
`workspace.reconcileServerClause(localId, …)` — **sans** `dirty`/undo. La prochaine
`planClauseSync` est alors vide ⇒ **convergence garantie**, quel que soit le champ normalisé
(support, frontière, niveau, nature). Aucune perte : la réponse 200 EST la vérité stockée ; on
n'aligne que ce que le serveur a réellement enregistré.

- `store/workspace.ts` : action `reconcileServerClause`.
- `useAutosave.ts` : `runPass(reconcile)` ; le flush appelle `runPass(true)` et réconcilie
  chaque clause créée/mise à jour.
- Test : `submitFlush.test.tsx` — le serveur renvoie un `support` normalisé (0) ≠ brouillon (2) ;
  **sans** réconciliation le flush bouclerait → `converged=false` ; **avec**, `converged=true`
  et le brouillon est aligné.

## 3. Correctif #2 — soumission en TÂCHE DE FOND (barre + notification)

Remplace le message bloquant par une **machine à états séquencée** avec progression et
notification de fin :
1. **Enregistrement** (flush anti-perte) → 2. **Version figée** (`createVersion`,
   `mutateAsync`) → 3. **Publication** (`status=submitted`).

UI `SubmissionProgressDialog` : barre de progression (avance par étape), liste des 3 étapes
(faite ✓ / en cours ⟳ / à venir), `aria-busy`, `motion-reduce`. À la fin :
- **Succès** → `SubmitSuccessDialog` (déjà en place : confirmation + verrouillage + déverrouillage).
- **Échec** d'une étape → état d'erreur clair (« aucune donnée perdue ») + **Réessayer** (relance
  tout depuis l'enregistrement) + Fermer.

Tokens uniquement (zéro hex), accessible (role=dialog, progressbar, alert).

## 4. Tests
- vitest **414** : `submitFlush` (anti-boucle Atlas), `submissionProgress` (étapes/erreur/barre),
  `submitSuccessDialog`, suite complète verte. tsc clean.
- e2e : collab-versioning / annotate / lock (24) verts — gate de soumission inchangé.

## 5. Pour l'utilisateur
Le blocage venait d'un aller-retour d'enregistrement qui ne « collait » jamais pour 6 clauses
issues du moteur (le serveur normalisait un champ). C'est corrigé (réconciliation) : la
soumission converge. Et la publication se fait désormais **en arrière-plan avec une barre de
progression** ; à la fin, une **notification** indique si ça a réussi (avec option de
déverrouillage) ou échoué (avec « Réessayer »).
