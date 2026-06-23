# Scénarios d'utilisation — pas à pas (gestes + feedback attendu)

> Quatre parcours concrets qui couvrent le cœur du dossier. Chaque scénario décrit le
> **contexte**, l'**enchaînement geste → feedback**, et le **résultat lisible** sur les trois
> canaux (niveau C1–C5 = couleur ; provenance = forme ★/⚡/✎ ; multi-label = plein/pointillé +
> `＋N`). Les états et règles précises sont spécifiés dans `02_conception/` et
> `03_specifications/` ; ici on raconte l'expérience.

---

## Scénario 1 — Gérer un C3 multi-label (cas conflit structuré)

**Persona.** Karim (expert), à vitesse de croisière. **Contexte.** Une clause de
non-concurrence chevauche deux thèmes ; le triage l'a classée **C3** (violet `⧉`).

**Pas à pas.**

| # | Geste | Feedback attendu (< 200 ms) |
|---|---|---|
| 1 | Karim arrive sur la clause ; le badge de niveau **C3 violet `⧉`** est visible (couleur du niveau). | Le rail propose le bouton recommandation Cx ; la clause signale qu'un set multi-label est suggéré. |
| 2 | Il ouvre la **SuggestionCard** (clic ou raccourci). | Carte : chip **primaire plein** « ✓ Non-concurrence » + chip **secondaire pointillé** « + Confidentialité » ; frontière dure ▮ ; explication contexte/logique. |
| 3 | Il **valide le set** proposé. | Le **toggle 🏷 passe en ON** (fond bleu clair `#64B5F6`, libellé « Multi-label ») ; un flash bleu clair confirme la pose ; provenance **⚡ + C3** (forme moteur, couleur d'état → vert validé). |
| 4 | Dans le document, la clause affiche désormais le chip primaire plein + le secondaire pointillé `+` ; dans le **plan**, le ClauseChip gagne **`＋1`**. | Multi-label lisible *sans rouvrir la carte* ; provenance ⚡ visible sur piste + chip + en-tête (unifiées). |
| 5 | (Réversibilité) Karim doute : il **re-clique le toggle 🏷**. | Le set revient à mono ; le `＋1` disparaît ; retour à l'état précédent **sans chercher d'undo** (le toggle EST l'annulation). |
| 6 | Satisfait, il enchaîne **valider + suivant**. | Passage à la clause suivante ; trace persistée (⚡ C3, primaire+secondaire). |

**Résultat lisible.** Couleur = C3 (violet, neutre/qualitatif) ; forme = ⚡ (moteur) en vert
(validé) ; multi-label = primaire plein + secondaire pointillé + `＋1` au plan.

---

## Scénario 2 — Valider une pré-annotation LLM

**Persona.** Léa (débutante). **Contexte.** Une clause a été **pré-annotée** par le modèle
(`seededFrom`), niveau **C2** (lime). Elle doit confirmer ou corriger.

**Pas à pas.**

| # | Geste | Feedback attendu (< 200 ms) |
|---|---|---|
| 1 | Léa ouvre la clause ; elle voit la marque **★ ambre** (pré-annotation **proposée**, non confirmée) sur la piste + l'en-tête, et le badge **C2 lime**. | La forme ★ dit « ça vient d'une pré-annotation » ; la couleur ambre dit « à valider ». |
| 2 | Elle survole la marque pour comprendre. | Tooltip : « Pré-annotation LLM — à confirmer ». Sur l'action de validation, microcopie nommant la règle (principe « 1 action nommée »). |
| 3 | Le thème proposé lui paraît correct : elle **valide**. | La marque **★ passe au vert** (`#34D399`) ; **la forme ne change pas** (★ = provenance stable), seule la couleur bascule proposé → validé. Confirmation immédiate. |
| 4 | Dans le **plan**, le ClauseChip montre **★ vert** (au lieu de `✓` indistinct) : Léa et le reviewer savent que c'est une pré-annotation adoptée. | Provenance lisible au plan (résout P1/P4 de l'audit). |
| 5 | (Variante) Si le thème proposé est faux, Léa **corrige** dans l'inspecteur. | La provenance bascule de ★ vers **✎** (manuel) : la trace dit « finalement décidé à la main ». |

**Résultat lisible.** Couleur = C2 (lime) puis état validé (vert) ; forme = ★ (pré-annotation)
→ vert si adoptée, ou ✎ si corrigée à la main ; mono-label (pas de `＋N`).

---

## Scénario 3 — Résoudre un conflit C5 (arbitrage)

**Persona.** Inès (reviewer). **Contexte.** Désaccord fort entre juges/annotateurs sur une
clause ; le triage la classe **C5 Arbitrage** (rose `⚖`). **Jamais d'auto-validation.**

**Pas à pas.**

| # | Geste | Feedback attendu (< 200 ms) |
|---|---|---|
| 1 | Depuis le **plan**, Inès repère la clause : C5 ressort fortement (rose + `⚖` + liseré marqué, plus `❗`). | Saillance maximale (priorité d'attention n°1) — elle va droit à l'arbitrage sans chasser. |
| 2 | Elle ouvre la clause ; l'état affiche **`❗` (conflit)**, **aucune marque de validation** (ni ★/⚡/✎ verts) : rien n'a été auto-validé. | Le design **refuse l'auto-validation** en C4/C5 ; la décision humaine est explicitement requise. |
| 3 | Elle ouvre l'**inspecteur** et consulte le **comparateur par juge** : positions divergentes, evidence/rationale. | Vue des désaccords ; provenance de chaque position lisible (forme ★/⚡/✎). |
| 4 | Elle tranche et **valide manuellement** le thème retenu. | La provenance devient **✎ vert** (décision humaine) ; le `❗` disparaît ; l'état passe à validé. |
| 5 | (Si le bon résultat est multi-label) elle active le **toggle 🏷** et ajoute le secondaire. | Chip primaire plein + secondaire pointillé `+` ; `＋N` au plan ; toggle réversible. |
| 6 | Elle passe à l'arbitrage suivant. | Trace : ✎ (manuel), validé ; le corpus reflète une décision humaine assumée sur le cas dur. |

**Résultat lisible.** Couleur = C5 (rose, alerte) jusqu'à décision ; forme = ✎ (manuel) en vert
après arbitrage ; `❗` tant que non tranché ; multi-label optionnel selon la décision.

---

## Scénario 4 — Ajouter un secondaire HORS C3 (pas de conflit, mais on le veut)

**Persona.** Karim (expert), parfois Inès. **Contexte.** Une clause **mono-thème déjà validée**
(niveau C1/C2) gagnerait à porter un thème connexe, sans qu'il y ait de conflit structuré. Le
backend l'autorise ; il faut une **porte d'entrée hors C3**.

**Pas à pas.**

| # | Geste | Feedback attendu (< 200 ms) |
|---|---|---|
| 1 | Karim ouvre la clause (mono-label, primaire validé, ex. provenance ⚡ vert C2). | État courant lisible : un seul chip plein, pas de `＋N`. |
| 2 | Dans l'**inspecteur**, zone « Thèmes », il active le **toggle 🏷 Multi-label** (en tête de zone). | Le toggle passe **ON** (bleu clair + libellé « Multi-label ») ; l'affordance **« + thème secondaire »** apparaît. |
| 3 | Il clique **« + thème secondaire »** et choisit un thème dans la palette. | Un **chip secondaire pointillé `+`** s'ajoute sous le primaire ; le primaire reste plein/gras (hiérarchie préservée). |
| 4 | Le secondaire est posé. | Dans le **plan**, le ClauseChip gagne **`＋1`** ; même rendu que via C3 (cohérence : multi-label non réservé aux conflits). |
| 5 | (Réversibilité) Il retire le secondaire (re-toggle ou retrait du chip). | Retour à mono ; `＋1` disparaît ; aucune action destructrice sans réversion. |
| 6 | (Garde-fou) Si la clause était un **refuge**, l'ajout en **secondaire est refusé** (un refuge n'est jamais secondaire — règle backend). | Message explicite ; le geste est bloqué proprement, pas silencieusement ignoré. |

**Résultat lisible.** Couleur = niveau initial (inchangé) ; forme = provenance initiale
(⚡/★/✎, inchangée) ; multi-label = primaire plein + secondaire pointillé `+` + `＋1` au plan,
**posé à la main hors de tout conflit C3**.

---

## Récapitulatif transverse

| Scénario | Canal couleur (niveau) | Canal forme (provenance) | Canal multi-label | Geste-clé |
|---|---|---|---|---|
| 1 — C3 multi-label | C3 violet (neutre) | ⚡ moteur → vert | primaire plein + secondaire `+`, `＋1` | toggle 🏷 réversible + valider/suivant |
| 2 — pré-annotation LLM | C2 lime → validé | ★ pré-annot → vert (ou ✎ si corrigé) | mono | valider (★ ambre → ★ vert) |
| 3 — conflit C5 | C5 rose + `❗` (jamais auto) | ✎ manuel → vert | mono ou multi selon décision | comparateur + décision manuelle explicite |
| 4 — secondaire hors C3 | niveau initial inchangé | provenance initiale inchangée | mono → primaire + `+`, `＋1` | toggle 🏷 + « + thème secondaire » (inspecteur) |

> Constante des quatre scénarios : **feedback < 200 ms**, **réversibilité par toggle** (pas de
> chasse à l'undo pour le geste courant), **provenance et multi-label lisibles jusque dans le
> plan** — les trois exigences que l'UI actuelle ne tient pas (cf. `audit_ergonomique.md`).
