# Wireframes — écrans clés (descriptions ASCII)

> Wireframes basse-fidélité, fidèles à `navigation.md`. Le **workspace 3 panneaux** est le cœur du
> produit et détaillé en premier. Les mesures (colonne ~70ch, line-height 1.7) viennent de
> `ergonomics_anti_fatigue.md` et de `06_design_system`. Légende : `[ ]` zone, `( )` bouton, `☑/☐`
> toggle, `▸` menu, `…` troncature. Toutes les couleurs de thème renvoient à `vocabulary.yaml`.

---

## W0 — Chrome applicatif (shell commun)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ▸CLAIRE  [▾ Projet: claudette-gold-v1]   ⌘K Rechercher…   ▓ 62%   ◐ thème  🔔3   ▸Salma│  ← top bar
├───────────┬──────────────────────────────────────────────────────────────────────────┤
│  SIDEBAR  │                                                                            │
│ (repliable│                        ZONE DE CONTENU (route active)                      │
│  ◧)       │                                                                            │
│ ◈ Tableau │                                                                            │
│ ▤ Documents                                                                            │
│ ✎ Mes ann.│                                                                            │
│ ⚖ Revue   │                                                                            │
│ ⇄ Comparer│                                                                            │
│ ⏱ Histo.  │                                                                            │
│ ───────── │                                                                            │
│ ⚙ Admin*  │  (* visible si role admin/owner uniquement)                                │
└───────────┴──────────────────────────────────────────────────────────────────────────┘
```
- Top bar (navigation.md §2) : sélecteur de projet, ⌘K palette, jauge d'avancement perso, bascule
  thème clair/sombre, cloche d'activité (feature 4), menu utilisateur (badge rôle).
- Sidebar : navigation primaire contextuelle au projet, repliable (◧) pour maximiser la lecture.

---

## W1 — ★ Workspace d'annotation `/annotate/[id]` (3 panneaux)

```
┌──────────────────┬─────────────────────────────────────────────┬──────────────────────┐
│ PLAN / TOC       │  DOCUMENT — Fitbit ToS            [draft ●]   │ INSPECTEUR           │
│ (gauche, 18%)    │  (centre, ~70ch, line-height 1.7)            │ (droite, 26%)        │
│                  │                                               │                      │
│ Clauses (6)      │  [0] we recently revised these terms …        │ ▸ Clause #3 sélect.  │
│ ● META       #0  │  [1] your continued use constitutes …         │ ──────────────────── │
│ ● PREAMBLE   #2  │  [2] ─── clause START (ancre) ─────────┐      │ Thème                │
│ ● PRIVACY    #6  │      [2] fitbit provides the services… │      │ [● PRIVACY_DATA  ▾]  │
│ ● LICENSE    #11 │      [3] including the website and app… │      │  (palette colorée,   │
│ ● TERMINATION#18 │  ┌── [6] we collect personal data … ───┐│ ⚑   │   recherche typée)   │
│ ● ARBITRATION#24 │  │   clause sélectionnée (surlignée)    ││     │ Nature jur. (opt.)   │
│                  │  │   [7] such as your email address …   ││     │ [DECLARATION    ▾]   │
│ ───────────────  │  └──────────────────────────────────────┘│   │ Certitude  0 1 2[3]  │
│ Progression      │      ⚑ injustice CLAUDETTE: LTD niv.3 (●) │   │  🤔 🙂 😀 💯         │
│ ▓▓▓▓▓▓░░ 62%     │      ░ fantôme LLM claude: frontière @ [5]│   │ Evidence span        │
│                  │                                               │ ┌──────────────────┐ │
│ Overlays         │  [8] you may opt out at any time …            │ │"we collect…data" │ │
│ ☑ Injustice (12) │  [9] …                                        │ └──────────────────┘ │
│ ☑ LLM claude (2) │                                               │ Rationale            │
│ ☐ LLM codex      │                                               │ ┌──────────────────┐ │
│ ☐ Traduction(8)  │                                               │ │ clause de collecte││ │
│                  │                                               │ └──────────────────┘ │
│ Sauts: g d ▸     │                                               │ ──────────────────── │
│                  │                                               │ 💬 Commentaires (9)  │
│                  │                                               │  Marc: "préciser la  │
│                  │                                               │  finalité?"   ↩ résu.│
│                  │                                               │ ──────────────────── │
│                  │                                               │ ⇄ Diff vs LLM        │
│                  │                                               │  + thème PRIVACY     │
│                  │                                               │  - frontière @ [5]   │
├──────────────────┴─────────────────────────────────────────────┴──────────────────────┤
│ ( Pré-remplir depuis Claude▾ )  ( ⌘S Snapshot )      certitude globale: [2 😀]  ( Soumettre ▸ )│ ← barre d'action
└────────────────────────────────────────────────────────────────────────────────────────┘
 Raccourcis: j/k phrases · B frontière · T thème · C commentaire · 0–3 certitude · ⌘S snapshot · g d doc suivant · ? aide
```

**Notes de conception**
- 3 panneaux **redimensionnables** (poignées entre colonnes), largeurs persistées dans `/settings`.
- Colonne document plafonnée à ~70ch quelle que soit la largeur d'écran (anti-fatigue).
- Statut affiché en tête (`draft/submitted/in_review/…`) — voir state machine (03_data_model).
- Overlays togglables : injustice (feature 12), fantôme LLM (feature 2), traduction (feature 8).
- Barre d'action bas : pré-remplissage (feature 2), snapshot (feature 3), certitude globale + soumission.

---

## W2 — Mode revue `/review/[annotationId]` (reviewer, lecture seule)

```
┌──────────────────┬─────────────────────────────────────────────┬──────────────────────┐
│ PLAN (lecture)   │  DOCUMENT — Fitbit ToS         [submitted ◑] │ PANNEAU REVUE        │
│ Clauses + certit.│  (identique W1 mais NON éditable)            │ ──────────────────── │
│ ● PRIVACY  #6 😀2│  clauses surlignées, certitudes visibles,    │ Score   ( ★★★★☆ ) 4  │
│ ● LICENSE #11 🤔0│  rationales en survol                        │ Décision             │
│  ⚠ faible certit.│                                               │ ( ◯ Approuver )      │
│                  │  [6] we collect personal data … 😀           │ ( ◉ Demander modif.) │
│ Filtrer:         │  [7] …                                        │ ( ◯ Rejeter )        │
│ ☑ certitude<2    │                                               │ Rubrique             │
│ ☐ commentées     │                                               │  Couverture   ▓▓▓░  │
│                  │                                               │  Cohérence    ▓▓▓▓  │
│                  │                                               │  Evidence     ▓▓░░  │
│                  │                                               │ Corps (md)           │
│                  │                                               │ ┌──────────────────┐ │
│                  │                                               │ │ Revoir clause #11│ │
│                  │                                               │ └──────────────────┘ │
│                  │                                               │ 💬 commenter (C)     │
├──────────────────┴─────────────────────────────────────────────┴──────────────────────┤
│                                                  ( Enregistrer la revue ▸ )              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```
Le filtre « certitude < 2 » guide l'attention du reviewer vers les clauses à risque (P2).

---

## W3 — Comparaison `/compare?doc=&a=&b=` (diff côte-à-côte)

```
┌────────────────────────────────────────┬───────────────────────────────────────────────┐
│ A: alice (humain) — submitted           │ B: claude@v9.4 (preannotation)                │
├────────────────────────────────────────┼───────────────────────────────────────────────┤
│ [6] PRIVACY_DATA   😀2                  │ [6] PRIVACY_DATA      (= identique)            │
│ [11] LICENSE_IP    🤔0      ◀── diff ──▶│ [11] LICENSE_IP / frontière déplacée @ [12]    │
│ [18] TERMINATION   😀2                  │ [18] (absente)        ◀── A seulement          │
│                                         │ [21] FEES_PAYMENT     ◀── B seulement          │
├────────────────────────────────────────┴───────────────────────────────────────────────┤
│ Légende: = accord · ▲ thème diffère · ◀▶ frontière diffère · seul-A · seul-B   κ paire: 0.41│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## W4 — Tableau de bord projet `/projects/[slug]`

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ claudette-gold-v1   ·   corpus: CLAUDETTE-ToS   ·   scheme: claire-themes-v1   role: lead│
├───────────────────────────────┬────────────────────────────┬───────────────────────────┤
│ AVANCEMENT                    │ MON PLAN DE TRAVAIL         │ ACTIVITÉ (feature 4)       │
│ Documents 50                  │ ▤ Fitbit       draft        │ 🔔 alice a soumis Spotify  │
│ approved ▓▓▓▓▓░░░ 28          │ ▤ Spotify      submitted    │ 🔔 marc a approuvé Netflix │
│ in_review ▓▓ 6                │ ▤ Netflix      approved     │ 🔔 karim a importé claude  │
│ submitted ▓ 4                 │ ( Reprendre ▸ )             │ …                          │
│ draft ▓▓ 12                   │                             │ ( Voir le journal ▸ )      │
├───────────────────────────────┴────────────────────────────┴───────────────────────────┤
│ ACCORD INTER-ANNOTATEUR (IAA)   κ global 0.43   ·   par paire: alice·bob 0.51, alice·LLM 0.41│
│ [ heatmap des désaccords par thème ]                                ( /compare ▸ )       │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## W5 — Admin : schémas `/admin/schemes` (vocab fermé versionné, feature 11)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Schémas d'annotation                                          ( + Nouveau )  ( Cloner ) │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ claire-themes-v1   v1.0.0   ● actif    20 thèmes · 6 natures   (projets: 1)             │
│   Thèmes (fermés):  ● META  ● PREAMBLE_SCOPE  ● PRIVACY_DATA … ● MISC_BOILERPLATE       │
│   ⚠ Vocab FERMÉ — pas de catégorie OTHER_ libre (ADR-0003). Édition = nouvelle version. │
│ claire-themes-v2   v2.0.0   ○ brouillon  (cloné de v1, +2 thèmes)        ( Activer )    │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## W6 — Admin : exports `/admin/exports` (feature 5)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Exports — claudette-gold-v1                                            ( + Nouvel export)│
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Format:  ( jsonl ) ( csv ) ( conll ) ( xml ) ( md ) ( huggingface )                    │
│ Scope:   ☑ approved  ☐ submitted   documents: [tous ▾]   inclure: ☑ rationale ☑ certit.│
│ ──────────────────────────────────────────────────────────────────────────────────────│
│ #128  jsonl  approved  ✓ done    artefact ⬇   manifest ▸   par karim  il y a 2 min     │
│ #127  conll  approved  ⏳ running …                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## W7 — État vide / onboarding (navigation.md §5)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                          Bienvenue dans CLAIRE Studio                                  │
│   Atelier d'annotation juridique : segmentez en clauses, attribuez thème + certitude,  │
│   repartez des pré-annotations LLM, produisez un gold traçable.                        │
│                                                                                        │
│         ( Rejoindre un projet )            ( Créer un projet )  ← si admin/owner        │
│                                                                                        │
│   Aucun projet ne vous est encore assigné. Voir la progression ▸                       │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
