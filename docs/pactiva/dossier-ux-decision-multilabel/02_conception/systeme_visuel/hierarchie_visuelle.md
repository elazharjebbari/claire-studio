# Hiérarchie visuelle — primaire vs secondaire & priorités d'attention

> But : qu'un coup d'œil suffise à distinguer (a) le thème **principal** d'une clause de ses
> thèmes **secondaires**, et (b) les zones qui demandent l'attention humaine (C4/C5).

## 1. Thème primaire vs secondaire (multi-label)

| | Primaire | Secondaire |
|---|---|---|
| **Rôle** | thème dominant (1 seul) | thème connexe (N, jamais un refuge) |
| **Forme** | chip **plein**, coins arrondis | chip **contour pointillé** (capsule) |
| **Bordure** | 2 px pleine | 1 px pointillée |
| **Graisse** | gras | normal |
| **Taille** | 100 % | ~85 % (padding réduit) |
| **Marque** | `✓` devant le libellé | `+` devant le libellé |
| **Opacité** | 1 | 0.9 |
| **Position** | en tête (gauche / haut) | à la suite (droite / dessous) |

Conséquence : même en niveaux de gris (test d'accessibilité), le primaire **ressort** par la
forme pleine + la graisse, le secondaire reste identifiable par le contour pointillé + `+`.

## 2. Lisibilité « multi-label » en un coup d'œil

- **Plan des clauses (ToC)** : pastille **`＋N`** sur le `ClauseChip` quand la clause porte N
  secondaires → l'annotateur repère les clauses multi-label sans les ouvrir.
- **Document** : sous le badge de thème, les chips secondaires en pointillé (repliables).
- **Inspecteur** : zone « Thèmes » = primaire (gros) puis secondaires (chips `+`), avec le
  **toggle Multi-label** (🏷) en tête de zone.

## 3. Priorité d'attention (niveaux de triage)

Ordre de saillance visuelle décroissante (ce qui doit « sauter aux yeux ») :

1. **C5 Arbitrage** — `⚖` + rose, liseré marqué : décision humaine obligatoire.
2. **C4 Majorité** — `◑` + ambre : à vérifier.
3. **C3 Multi-label** — `⧉` + violet : cas qualitatif (multi-label) — saillant mais **neutre**
   (ni « bon » ni « mauvais »).
4. **C2 Haute** — `◐` + lime : confirmation rapide.
5. **C1 Or** — `●` + émeraude : discret (acceptable en lot, peu d'attention requise).

> Le **niveau** (couleur du badge) et la **provenance de validation** (forme ★/⚡/✎) occupent
> des EMPLACEMENTS distincts (badge de niveau dans la carte/gouttière ; marque de provenance
> sur la piste/chip) afin que les teintes proches (lime C2, vert validé, vert manuel) ne se
> télescopent jamais au même endroit.

## 4. Densité & espacement

- Grille d'espacement 4 px (multiples : 4/8/12) — cohérent avec l'app.
- Cibles cliquables (toggle, boutons valider) **≥ 24 px** dans la gouttière dense, **≥ 32 px**
  dans l'inspecteur ; zone de hit étendue par padding invisible si nécessaire (loi de Fitts).
- Max 3 couleurs dominantes simultanées par zone (niveau + état + multi-label) ; les chips de
  thème restent à faible opacité (18 %) pour ne pas saturer.
