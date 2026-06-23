# Améliorations v2 — raffinements UI/UX (icônes premium, états, multi-label visible, arbitrage)

> Itération sur le dossier (mêmes objectifs : clarté, hiérarchie, feedback, accessibilité).
> 7 points issus du retour terrain. Statut d'implémentation indiqué par point.

## 1. Icônes premium (bibliothèque) — ✅
Remplacement des glyphes Unicode par des icônes **lucide-react** (vectorielles, cohérentes) :
- Provenance (`ProvenanceMark`) : `Zap` (⚡ moteur) · `Sparkles` (✦ pré-annotation/arbitrage) ·
  `PenLine` (✎ manuel) · `Clock` (à valider). Couleur = état (emerald/amber), forme = provenance.
- Multi-label (`MultiLabelEditor`) : `Tags` (toggle), `Plus` (ajouter / chip secondaire), `X` (retirer).
- Arbitrage (`BoundaryEvidence`) : `Scale`, `CheckCircle2`/`AlertTriangle`, `ArrowLeftRight`, `Check`, `X`.
- *Reste (suivi)* : les glyphes de NIVEAU C1–C5 (●◐⧉◑⚖) dans la carte de suggestion/compteurs
  pourront passer en lucide (`levels.ts` → composant `Icon`) dans une passe dédiée.

## 2. Sélection miroir plan ↔ document — ✅ (fonctionnel)
Cliquer un `ClauseChip` du plan appelle `selectClause(localId)` + `focusSentence(anchorIndex)` :
la phrase est **focalisée et défilée** dans le document (anneau d'accent), et le chip passe
`selected`. Inversement, sélectionner une phrase met `selectedClauseId` → le chip correspondant
est mis en évidence. Miroir bidirectionnel sur la sélection. *(Évolution possible : miroir au
survol.)*

## 3. Respiration piste de validation / texte — ✅
La piste de validation (barre colorée à gauche) était collée au bloc de texte. Le padding gauche
de la ligne est augmenté (`pl-6` par défaut ; `pl-20` en mode actions rapides) → écart net entre
la barre et le texte, sans chevauchement avec le rail d'actions.

## 4. Multi-label manuel depuis la zone d'annotation — ✅ (clic-droit)
Le `MultiLabelEditor` (toggle Mono/Multi + chips secondaires retirables + « + thème secondaire »,
refuges exclus) est désormais **intégré au menu clic-droit** (`SentenceMenu`) sur la clause
couvrante — ajout/retrait d'un secondaire sans ouvrir l'inspecteur. *(2ᵉ voie : depuis
l'inspecteur, déjà livrée.)*

## 5. Multi-label visible dans le document — ✅
Le badge de clause (`clause-badge`) affiche les **thèmes secondaires** en chips pointillés
colorés (cohérent avec l'inspecteur et le badge `+N` du plan) → le multi-label se lit
directement dans le texte annoté.

## 6. Style validé vs à-valider nettement distinct — ✅
Le `ClauseChip` ne se distinguait que par un glyphe. Désormais :
- **Validé** : bordure pleine + fond plus dense + **accent émeraude à gauche** (boxShadow inset)
  + libellé en pleine couleur + marque de provenance verte.
- **À valider (brouillon)** : bordure **pointillée** + fond plus pâle + **libellé atténué**
  (`text-ink-muted`) + pastille de thème estompée + `Clock` ambre.
→ distinction immédiate, **sans dépendre de la couleur seule** (forme + densité + position).

## 7. Refonte de l'arbitrage « Comparer » (`BoundaryEvidence`) — ✅
Problèmes : grille 2 colonnes → cellule vide (3 cartes), popover étroit, espaces/couleurs faibles.
Nouvelle version :
- Popover **élargi** en mode comparaison (`w-[26rem]`), en-tête « Arbitrage de frontière » (`Scale`).
- Bandeau d'accord/divergence avec icône (`CheckCircle2`/`AlertTriangle`) + fond teinté.
- Comparaison = **cartes empilées pleine largeur** (aucune cellule vide), chacune avec un
  **accent gauche dans la couleur du thème**, evidence citée encadrée, nature en pastille,
  bouton « Choisir » (`Check`).
- Hiérarchie, espaces et contrastes revus pour la lisibilité.

## 8. Bug corrigé — bande vide en bas de l'inspecteur (panneau droit) — ✅
Symptôme : le panneau de l'inspecteur laissait une grande zone vide en bas quand son
contenu était plus court que le panneau (écran haut, clause courte, et surtout l'état
« aucune clause » : ~380 px de contenu dans ~730 px → ~350 px de vide noir).
Correction au BON NIVEAU (pas un rustine par état) :
- Le panneau droit devient une **colonne flex** : en-tête figé (`shrink-0`) + zone de
  contenu **défilante** (`flex-1 min-h-0 overflow-y-auto`). La barre de défilement
  n'apparaît donc que si le contenu **dépasse réellement**.
- L'inspecteur **remplit** cette zone (`min-h-full`) et une section *grandit* pour
  absorber l'espace résiduel : les **commentaires** (style « discussion », liste
  défilante + composeur épinglé en bas) pour l'éditeur, la **palette de thèmes**
  (`fill`) pour l'état « aucune clause » (tous les thèmes visibles au lieu d'une liste
  tronquée + un vide).
- Vérifié visuellement (Playwright, 1440×900 et 1440×1700) : **bande vide = 0 px** sur
  grand écran ; remplissage propre en état vide. Verrouillé par 6 tests de contrat.

## 9. Soumission sans perte de données (course autosave/submit) — ✅
La soumission ne transporte PAS les clauses : elle crée une version (snapshot figé
**côté serveur** à partir de l'état déjà persisté) puis passe `submitted`. Risque
identifié : une modification faite < 1,2 s avant le clic (débounce non écoulé), une
synchro en vol, ou un autosave en erreur → le snapshot soumis **perdait** ces données.
Correction : `confirmSubmit` appelle d'abord `flush()` (annule le débounce, synchronise
MAINTENANT, attend la **convergence**). La soumission n'est autorisée que si tout est
sur le serveur ; sinon elle s'abstient avec un message explicite (pas de perte
silencieuse). `markClean` n'est posé qu'au vrai succès du passage `submitted`.

## 10. Garde anti-soumission vide (point campagne 1) — ✅
Filet de sécurité serveur : `transition → submitted` est refusé (409) si l'annotation a
0 clause (les deux portes : `POST /submit` et `PATCH status=submitted`). Le gate de
validation front (toutes phrases validées) reste la première barrière ; le backend
garantit qu'aucune session vide ne peut être figée en snapshot.

## 11. Verrouillage / déverrouillage du document (point campagne 2) — ✅
Édition gelée, orthogonale au statut. `Annotation.locked` (+ `locked_at`, `locked_by`) :
- **Auto-lock** à la soumission (entrée `submitted`) ; **auto-unlock** au retour `draft`.
- **lock/unlock manuels** (`POST …/lock|/unlock`, propriétaire + relecteur/admin).
- **Déverrouiller un document soumis le ROUVRE en `draft`** (« on souhaite y revenir ») ;
  une re-soumission recrée une version et re-verrouille. Les états de revue/terminaux
  (in_review/approved/rejected/archived) **ne sont pas** déverrouillables directement
  (le verrou protège le gold).
- **Refus d'écriture** : toute écriture de clause (et `globalCertainty`) sur un document
  verrouillé répond **`423 Locked`** ; le front traduit en avertissement.

UI (option A retenue) : **bandeau persistant** « 🔒 Document soumis et verrouillé —
déverrouillez pour reprendre », **cadenas dans la toolbar** (Verrouiller/Déverrouiller,
icônes lucide), **confirmation** au déverrouillage, **avertissement « pulse »** du bandeau
quand on tente une vraie action d'édition (thème/nature/certitude/valider/supprimer…),
lecture/commentaires non perturbés. Lecture seule via `readOnly` du store ; autosave gelé ;
**flush anti-perte avant le verrouillage manuel**. Revue adversariale passée (4 findings
corrigés : déverrouillage des états terminaux, ré-armement autosave au déverrouillage,
sur-déclenchement du nudge, ré-init destructif sur refetch).

## Tests & déploiement
Vitest pur + RTL (ClauseChip provenance/états/`+N`, MultiLabelEditor, validationDisplay) ; suite
front complète verte ; tsc clean. Déploiement sur `pactiva.legal` (gate + healthcheck + rollback).
Détails d'exécution : `06_technique/06_runbook_execution.md`.
