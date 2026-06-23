# Critères de validation — grille d'acceptation

> Grille de recette UX/UI du dispositif (3 canaux orthogonaux : niveau C1–C5 / provenance ★/⚡/✎ /
> multi-label). Chaque critère a une **cible mesurable** et une **méthode de preuve**.
> Référence d'ordonnancement : `etapes.md`. Référence visuelle : `02_conception/systeme_visuel/*`.
>
> **Verdict global** : GO si tous les critères « bloquant » sont au vert. Un critère « majeur » au
> rouge ⇒ correction avant déploiement ; « mineur » ⇒ backlog.

---

## 1. Ergonomie

| Critère | Cible | Méthode de preuve | Sévérité |
|---|---|---|---|
| Satisfaction globale | **SUS ≥ 85** | Questionnaire SUS post-test, 5–8 annotateurs | Bloquant |
| Compréhension des marques (★/⚡/✎, `+N`, toggle 🏷) | **≥ 90 %** de bonnes réponses | Test de reconnaissance sur 10 clauses mélangées | Bloquant |
| 1 action = 1 geste (valider C1/C2) | 1 clic, ≤ 1 s | Observation tâche scénarisée | Majeur |
| Ajout d'un secondaire hors C3 | succès ≥ 90 %, ≤ 2 gestes | Tâche scénarisée chronométrée | Majeur |
| Réversibilité du toggle | 100 % retour à l'état initial au re-clic | Test fonctionnel sur prototype | Bloquant |
| Repérage multi-label dans le plan (sans ouvrir) | **≥ 90 %** | Tâche « repère les clauses à plusieurs thèmes » | Majeur |
| Taux d'erreur par tâche | ≤ 5 % | Observation + journal d'erreurs | Majeur |

---

## 2. UI (cohérence & hiérarchie visuelle)

| Critère | Cible | Méthode de preuve | Sévérité |
|---|---|---|---|
| Cohérence de provenance (piste / ClauseChip / en-tête) | même forme partout, 100 % | Revue visuelle pairée des 3 emplacements | Bloquant |
| Hiérarchie primaire vs secondaire | distinction nette, 100 % des cas | Inspection visuelle vs `hierarchie_visuelle.md` | Bloquant |
| Cohérence `+N` vs nb réel de secondaires | 100 % | Audit de cohérence plan ↔ inspecteur | Majeur |
| Non-collision des 3 canaux | 0 télescopage de teintes proches | Revue heuristique (emplacements distincts) | Majeur |
| Max 3 couleurs dominantes par zone | respecté | Inspection visuelle par zone | Mineur |
| Une seule forme de provenance par clause | 100 % (dernière action fait foi) | Vérification de la règle sur cas multiples | Majeur |

---

## 3. Design (système visuel)

| Critère | Cible | Méthode de preuve | Sévérité |
|---|---|---|---|
| Lisibilité primaire/secondaire en niveaux de gris | distinguable sans couleur, ≥ 90 % | Test grayscale sur specimen + écran réel | Bloquant |
| Couleurs de niveau C1–C5 inchangées | identiques à la source `levels.ts` | Comparaison aux tokens existants | Bloquant |
| Forme = provenance / couleur = état | conforme à `icones_validation.yaml` | Revue de conformité du specimen | Bloquant |
| Specimen complet (dark + light + N&B) | 100 % des marques présentes | Revue de la planche de référence | Majeur |
| C3 hors gradient d'accord (violet dédié) | respecté | Inspection visuelle | Mineur |

---

## 4. Réactivité (feedback)

| Critère | Cible | Méthode de preuve | Sévérité |
|---|---|---|---|
| Feedback à la validation | **< 200 ms** (changement couleur/forme/glyphe) | Mesure prototype + ressenti utilisateur | Bloquant |
| Feedback au toggle multi-label | **< 200 ms** (chips secondaires + accent bleu) | Mesure prototype | Bloquant |
| Feedback à l'ajout/retrait de secondaire | < 200 ms | Mesure prototype | Majeur |
| Tooltip de règle (provenance moteur) | apparaît sans délai perçu | Observation | Mineur |

---

## 5. Accessibilité (WCAG AA)

| Critère | Cible | Méthode de preuve | Sévérité |
|---|---|---|---|
| Contraste texte | **≥ 4.5:1** | Audit contraste chiffré (dark + light) | Bloquant |
| Contraste éléments non textuels (glyphes, chips 18 %) | **≥ 3:1** | Audit contraste chiffré | Bloquant |
| Jamais la couleur seule | 100 % des sens portés par forme + glyphe + texte | Test grayscale + simulation daltonisme (deut./prot.) | Bloquant |
| Libellé textuel équivalent (`title`/`aria-label`) | 100 % des marques | Audit des attributs d'accessibilité | Bloquant |
| Navigation clavier complète + focus visible | 0 piège, 0 focus perdu | Parcours clavier de bout en bout | Bloquant |
| Taille des cibles | ≥ 24 px (gouttière) / ≥ 32 px (inspecteur) | Mesure sur écran réel | Majeur |
| Taille des glyphes | ≥ 12 px | Inspection du specimen | Mineur |

---

## 6. Non-régression (acquis préservé)

| Critère | Cible | Méthode de preuve | Sévérité |
|---|---|---|---|
| Validation mono C1/C2 toujours en 1 clic | 100 % | Tâche scénarisée | Bloquant |
| ✓/◷ actuels restent valides tant que ★/⚡/✎ non déployés | 0 rupture | Test de migration par étapes | Majeur |
| C4/C5 jamais auto-validés | 0 occurrence | Audit des validations | Bloquant |
| Refuge jamais secondaire | 100 % bloqué + message | Test de tentative | Bloquant |

---

## Synthèse de recette

- **GO** : tous les « Bloquant » au vert, ≤ 1 « Majeur » au orange (avec plan de correction daté).
- **NO-GO** : ≥ 1 « Bloquant » au rouge, ou SUS < 85, ou compréhension < 90 %, ou contraste < AA.
- Échantillon de test recommandé : **5–8 annotateurs** (saturation des problèmes d'utilisabilité),
  comparaison **avant/après** (UI actuelle ✓/◷ sans multi-label vs nouvelle à 3 canaux).
