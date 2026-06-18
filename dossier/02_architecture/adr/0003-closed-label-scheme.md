# ADR 0003 — Schéma de labels fermé et versionné

- Statut : **Accepté**
- Date : 2026-06-18
- Décideurs : architecte plateforme, responsable données/recherche, lead annotation
- Contexte de référence : `00_overview/CONTRACT.md` §1/§2/§5, `vocabulary.yaml`

## Contexte et problème

La cause racine de l'échec des protocoles LLM (κ ≈ 0,32–0,45) n'était ni le prompt ni l'outillage, mais
l'**instabilité du référentiel** : des catégories ouvertes / libres (`OTHER_*`) faisaient diverger les
annotateurs (humains et LLM). Le verrou est l'**accord inter-annotateurs**. Comment garantir un référentiel
stable, mesurable et réutilisable sur d'autres corpus (feature 11) ?

## Options envisagées

1. **Schéma fermé et versionné** : `LabelScheme` = vocabulaire fini de `Theme`/`LegalNature`, versionné,
   attaché au projet ; aucune catégorie libre ; toute évolution = nouvelle version.
2. **Schéma ouvert** : les annotateurs peuvent créer des thèmes / catégories `OTHER_` à la volée.
3. **Schéma hiérarchique ouvert** : taxonomie extensible avec sous-catégories libres.

## Décision

Adopter l'**option 1 — schéma fermé et versionné**. Le `LabelScheme` (CONTRACT §2) est un **vocabulaire
fermé** de `Theme` (20 thèmes v1, vocabulary.yaml) et `LegalNature` (6 natures), **versionné**
(`version`, `is_active`), **attaché à un projet**. **Invariant dur (CONTRACT §2)** : `Clause.theme` ∈
themes du `LabelScheme` du projet — **pas de `OTHER_` libre**. Faire évoluer le vocab = **cloner/créer une
nouvelle version** (`POST /schemes`), jamais éditer en place un schéma actif utilisé.

## Justification

- **Accord inter-annotateurs** : un référentiel fini et stable est la condition nécessaire d'un κ
  exploitable ; il supprime la décision « faut-il créer une catégorie ? » (charge cognitive, P1).
- **Mesurabilité** : κ, matrices de confusion et désaccords (`/compare`, IAA) ne sont calculables que sur
  un espace de labels fixe et comparable entre annotateurs et entre humain/LLM.
- **Réutilisabilité multi-corpus (feature 11)** : un autre corpus déclare **son propre** `LabelScheme` avec
  la même structure (vocabulary.yaml est la forme canonique). L'isolation par scheme garantit qu'aucun
  thème ne « fuit » entre projets.
- **Versioning** : versionner le schéma rend les annotations **comparables dans le temps** et protège le
  gold déjà produit (un schéma actif ne mute pas sous les pieds des annotations existantes).
- **Validation simple** : l'invariant se teste directement (`pytest scheme_isolation`) et se vérifie côté
  API (rejet 400/409 d'un thème hors-scheme) et côté UI (palette fermée, pas de champ libre).

## Conséquences

**Positives** : κ exploitable, charge cognitive réduite, comparabilité temporelle et inter-annotateur,
réutilisabilité propre, validation triviale.

**Négatives / coûts** : moins de souplesse — un besoin non couvert exige une **nouvelle version de schéma**
(processus admin, P4) plutôt qu'un ajout ad hoc ; risque de friction si le vocab v1 est trop pauvre
(mitigé par le thème `MISC_BOILERPLATE` + commentaires feature 9 pour documenter les cas limites, et par
le clonage rapide vers une v2). L'option 2/3 auraient été plus flexibles mais auraient reproduit
exactement la dérive qui a fait échouer les protocoles précédents.

**Liens** : ADR-0001, ADR-0002, `vocabulary.yaml`, feature 11, `03_data_model/invariants.md`.
