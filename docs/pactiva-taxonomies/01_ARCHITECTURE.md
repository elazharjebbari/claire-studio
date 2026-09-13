# 01 — Diagnostic, architecture cible et modèle de données

## 1. Diagnostic AS-IS

Audit du 13 septembre 2026 (8 couches, lecture seule). L'état de départ :

| Constat | Détail |
|---|---|
| **Dix endroits** listent ou regroupent des codes de thème | `dossier/00_overview/vocabulary.yaml` (canonique) recopié À LA MAIN dans `frontend/design-tokens.json` et une 3ᵉ fois dans `themeDescriptions.ts`, sans aucun test de parité |
| Les mappings de fusion n'existaient qu'**hors production** | `docs/pactiva-fusion-classes/scripts/schemes.py` — dicts simples, sans version, lus par trois scripts d'analyse |
| Le fichier promis `docs/pactiva-lab/specs/theme-maps.yaml` | **n'existait pas** ; l'axe `data.theme_map` n'existait nulle part dans le code |
| Le rendu d'un thème passe par **trois registres indépendants** | `getThemeToken` (libellé + couleur, 24 fichiers), `getThemeIcon` (glyphe), `getThemeDescription` (info-bulle) — aucune macro-catégorie n'y figure |
| `setRuntimeThemes` | Map mutable au niveau module, écrite pendant le rendu, ne déclenche aucun re-rendu : **inutilisable** pour un sélecteur commutable |
| Le stockage est **favorable** | Le thème est une FK vers `Theme` + `ClauseTheme` (rôle primaire/secondaire) ; rien dans le stockage n'a besoin de changer pour afficher une fusion |
| L'empreinte de dataset **n'inclut aucune notion de taxonomie** | Structurellement favorable au principe « T20 canonique, le reste = projection » |
| La liste nominative des 33/17 documents | **n'existait nulle part** dans le dépôt ; seuls des comptages étaient publiés |

Deux précédents de fichier partagé Python↔TypeScript existent déjà et font jurisprudence :
le moteur gold (`golden.cases.json` lu par pytest ET vitest) et le moteur de triage.

## 2. La décision d'architecture

**Projection à la LECTURE, jamais à l'écriture.** Trois raisons décisives :

1. **Rien à migrer, rien à dupliquer.** Le wire reste en T20 ; l'interface projette pour
   afficher, le Lab projette pour mesurer. Changer de taxonomie est réversible d'un clic et
   n'écrit rien.
2. **L'appariement est gratuit.** La projection se fait sur le MÊME dataset, dont les plis
   et l'empreinte ne bougent pas : comparer deux taxonomies, c'est comparer deux lectures
   des mêmes documents — le test apparié s'applique sans construction supplémentaire.
3. **Le risque est confiné.** Le seul danger est qu'un code projeté redescende dans un
   chemin d'écriture. En ne projetant que la lecture, la surface à surveiller se réduit à
   quelques composants d'affichage, et les chemins d'écriture (palette d'annotation,
   boutons de décision gold) restent inchangés.

Corollaire : les mesures scientifiques projettent **côté Python**, au chargement du
dataset — pas côté client.

## 3. La source unique

`frontend/src/lib/taxonomy/taxonomies.json` — un fichier de DONNÉES, lu :

- par TypeScript via un import natif (`frontend/src/lib/taxonomy/index.ts`) ;
- par Python via un chemin relatif au dépôt (`research/pactiva_lab/taxonomy.py`).

C'est exactement le patron du golden gold. Deux suites de tests miroirs assertent les mêmes
invariants (`research/tests/test_taxonomy.py`, `frontend/tests/taxonomy.test.ts`) : si l'une
des deux implémentations dérive, la paire casse.

### Structure

```
specVersion, frozenAt, canonical: "T20"
populations: { designSet (33 doc.), holdout (17 doc.) }   ← partition FIGÉE
taxonomies: [ { id, label, short, rationale,
                categories: [ { code, label, description, color,
                                isRefuge?, rationale?, members: [codes T20] } ] } ]
```

### Versionnement et gel

- `specVersion` : incrémenté à toute modification des mappings.
- `spec_fingerprint()` : SHA-256 des octets, **journalisé dans chaque résultat**. Un chiffre
  publié cite (empreinte de dataset, empreinte de spécification, taxonomie, population).
- Modifier un mapping change l'empreinte : la divergence avec un résultat publié devient
  immédiatement visible.

## 4. Conventions de nommage des classes fusionnées

Une classe fusionnée doit être compréhensible **sans documentation externe**. Quatre règles,
vérifiées par les tests :

1. **Un libellé juridiquement explicite**, jamais un sigle : « Contenu, propriété
   intellectuelle & signalements », pas « CONTENT_IP ».
2. **Une description qui énumère la matière couverte** (> 80 caractères pour une fusion) :
   « licence du fournisseur, licence concédée sur le contenu de l'utilisateur, retraits et
   signalements de contrefaçon, droits sur les suggestions ».
3. **La liste de ses thèmes T20**, affichée dans la légende et dans chaque info-bulle —
   c'est la trace vers la source canonique.
4. **La justification mesurée de la fusion** (`rationale`) : le nombre de désaccords
   constatés, les α concernés, la strate d'abusivité. Une fusion se justifie, elle ne se
   décrète pas.

Les descriptions T20, elles, sont reprises **mot pour mot du guide annotateur** : la
fidélité au protocole prime sur l'uniformité de style.

## 5. Modifications par couche

### Backend
**Aucune.** Le stockage, les endpoints et les exports restent en T20. C'est le résultat le
plus important de l'architecture retenue : zéro migration, zéro risque sur les données.

### Lab / expérimentations (`research/pactiva_lab/`)
| Fichier | Évolution |
|---|---|
| `taxonomy.py` | **nouveau** — spécification, projection pure, populations, helpers de config |
| `data.py` | `load_dataset`, `load_votes`, `load_gold` acceptent `taxonomy` ; les **quatre** sources de thèmes sont projetées avec le même mapping ; le vocabulaire est dédoublonné ; **les frontières sont recalculées** |
| `runner.py`, `measurement.py`, `cooccurrence.py` | lisent `data.taxonomy` et `data.population` ; chaque résultat porte la traçabilité de projection |
| `experiments/run_taxonomy_matrix.py` | **nouveau** — pilote de la matrice 4 taxonomies × 3 populations × 3 sources |

### Frontend
| Fichier | Rôle |
|---|---|
| `lib/taxonomy/index.ts` | projection pure, catégories, populations (miroir de Python) |
| `lib/taxonomy/presentation.ts` | **point de passage unique** du rendu : libellé, couleur, description et **glyphe** d'une macro-catégorie (dérivé du thème-tête) |
| `components/taxonomy/TaxonomySwitch.tsx` | sélecteur segmenté accessible (radiogroup, flèches) |
| `components/taxonomy/CategoryChip.tsx` | pastille projetée ; signale les fusions (⊕N) ; `data-theme` reste **canonique** |
| `components/taxonomy/TaxonomyLegend.tsx` | légende : chaque macro énumère ses thèmes T20, avec effectifs et justification |
| Atelier gold (`GoldWorkspace`, `GoldInspectorPanel`, `GoldReadingPanel`, `GoldOutlinePanel`) | sélecteur, bandeau de lecture projetée, libellés/pastilles/compteurs projetés, **décision toujours en T20** |

## 6. Invariants garantis par les tests

| # | Invariant | Où |
|---|---|---|
| I1 | Chaque taxonomie **partitionne** les 20 thèmes (ni trou ni doublon) | PY + TS |
| I2 | La projection est **déterministe et idempotente** | PY + TS |
| I3 | Un code inconnu **passe tel quel** (jamais escamoté) | PY + TS |
| I4 | Un secondaire absorbé par son primaire **disparaît** | PY + TS |
| I5 | Les **refuges** survivent aux fusions | PY + TS |
| I6 | Les **frontières sont recalculées** après projection | PY |
| I7 | Les **plis sont identiques** entre taxonomies (appariement gratuit) | PY |
| I8 | Les fichiers du dataset **ne sont jamais réécrits** | PY |
| I9 | Conception et validation sont **disjointes** et couvrent les 50 | PY + TS |
| I10 | La spécification est **inaltérable** par ses appelants | TS |
| I11 | Une fusion porte libellé, description substantielle et justification | PY + TS |

## 7. Stratégie de rollback

| Étage | Rollback |
|---|---|
| Spécification | `git revert` du fichier JSON ; `specVersion` rend toute divergence visible |
| Lab | `taxonomy="T20"` (défaut) = comportement antérieur exact ; aucune donnée touchée |
| Frontend | Le sélecteur revient à T20 ; aucun état persistant |
| Données | **Rien à annuler** : aucune écriture n'a jamais eu lieu |

Le rollback est trivial **par construction** : c'est la propriété que l'architecture « T20
canonique + projections » a été choisie pour garantir.
