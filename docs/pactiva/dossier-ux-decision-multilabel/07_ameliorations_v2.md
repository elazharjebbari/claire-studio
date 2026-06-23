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

## Tests & déploiement
Vitest pur + RTL (ClauseChip provenance/états/`+N`, MultiLabelEditor, validationDisplay) ; suite
front complète verte ; tsc clean. Déploiement sur `pactiva.legal` (gate + healthcheck + rollback).
Détails d'exécution : `06_technique/06_runbook_execution.md`.
