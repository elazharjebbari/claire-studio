# Design system — tokens, couleurs, composants, micro-interactions

S'aligne sur le système Pactiva existant (`docs/pactiva/`, tokens `frontend/design-tokens.json`,
thème sombre de l'atelier). On **ajoute** une échelle « niveau de triage » et des
conventions « rôle de thème » — sans introduire de nouvelle bibliothèque.

## 1. Échelle de couleur « niveau de triage » (C1→C5)
Sémantique : du **vert/or sûr** (C1) au **rouge attention** (C5). Tokens proposés
(`--triage-c1..c5`), tous testés ≥ 4,5:1 sur fond sombre `--panel`.
| Niveau | Sens | Teinte (indicative) | Icône | Label (toujours présent) |
|---|---|---|---|---|
| C1 | Or / consensus | `emerald-500` ●▮ | ● | « C1 · Or » |
| C2 | Haute confiance | `lime-500` | ◐ | « C2 · Haute » |
| C3 | Multi-label | `violet-500` (= couleur « cluster ») | ⧉ | « C3 · Multi » |
| C4 | Majorité à vérifier | `amber-500` | ◑ | « C4 · Majorité » |
| C5 | Arbitrage | `rose-500` | ⚖ | « C5 · Arbitrage » |
> **Règle d'accessibilité** : la couleur n'est **jamais** le seul porteur d'information —
> toujours doublée d'un **label** + **icône** (daltonisme, contraste).

## 2. Conventions « rôle de thème »
- **Primaire** : pastille **pleine** de la couleur du thème + ✓.
- **Secondaire** : pastille **contour** (outline) de la couleur du thème + ◻.
- **Refuge** (PREAMBLE_SCOPE/MISC_BOILERPLATE) : teinte **désaturée** (gris-bleu) ; jamais
  affiché comme option secondaire.
- **Pastille de juge** : reprend `LLM_JUDGES[].identityColor` (claude/codex/mistral) — déjà
  défini ; cohérence totale avec l'atelier.

## 3. Composants (réutiliser > créer)
| Composant | Base réutilisée | Ajout |
|---|---|---|
| `TriageBadge` | — | badge niveau (couleur + icône + label) |
| `SuggestionCard` | structure de `BoundaryEvidence` (onglets juges) | sections contexte/décision/logique + CTA |
| `MultiThemePalette` | `NaturePicker` (pastilles radio) | mode multi : 1 primaire + N secondaires, toggle rôle |
| `TriageQueue` | `ResizablePanels` (split) + liste virtualisée | navigation clavier, regroupement par niveau |
| `VotesStrip` | pastilles de juge existantes | rangée compacte « [C]…[X]…[M]… » |
| `BoundaryPill` | rendu frontière existant (`llm-frontier`, pointillés) | états dur ▮ / mou ┄ + actions merge/split |

## 4. Densité & encombrement (anti-surcharge)
- **Carte compacte par défaut** : hauteur ~3 lignes sur C1/C2 (repliée), ~5 lignes sur C3/C4/C5.
- **Une seule action primaire** mise en avant (bouton plein accent) ; le reste en `⋯`/ghost.
- **Mode file en split** : 40 % file / 60 % document (redimensionnable, mémorisé).
- **Pas de modale** pour les gestes courants (tout est inline + clavier).

## 5. Micro-interactions
- **Accept** : la carte se **replie et s'estompe** (200 ms) puis la file **avance** au
  prochain item ; compteur du niveau décrémente avec un léger « tick ».
- **Override annulé** : le refuge **réapparaît** en place avec un halo bref (feedback).
- **Permuter** : primaire/secondaire **échangent** leur place avec une transition de pastille.
- **Fusion/scission** : la frontière pointillée s'**efface**/**apparaît** ; le rail de
  catégorie se recompose.
- **`prefers-reduced-motion`** : toutes ces transitions deviennent instantanées.

## 6. Tokens à ajouter (`design-tokens.json`)
```json
{
  "triage": {
    "c1": { "fg": "...", "bg": "...", "icon": "dot" },
    "c2": { "fg": "...", "bg": "...", "icon": "half" },
    "c3": { "fg": "...", "bg": "...", "icon": "stack" },
    "c4": { "fg": "...", "bg": "...", "icon": "half-alt" },
    "c5": { "fg": "...", "bg": "...", "icon": "scale" }
  },
  "role": { "primary": "solid", "secondary": "outline", "refuge": "muted" }
}
```
Hydratés via `lib/tokens.ts` (même mécanisme que les thèmes/`setRuntimeThemes`).

## 7. Ton & wording (FR, cohérent atelier)
- Niveaux nommés (« Or », « Haute », « Multi », « Majorité », « Arbitrage ») — jamais juste « C3 ».
- Verbes d'action courts à l'impératif : « Accepter le lot », « Confirmer », « Valider le set »,
  « Permuter », « Garder majorité », « Choisir l'autre », « Indécidable ».
- Logique formulée en une phrase, **factuelle** (κ, préséance, cluster), jamais moralisante.
