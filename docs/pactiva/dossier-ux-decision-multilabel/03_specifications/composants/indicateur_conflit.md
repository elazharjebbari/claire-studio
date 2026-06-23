# Spécification — Indicateur de conflit (C4 / C5)

> Canal 1 (niveau), cas hauts de l'échelle. C4 (Majorité, ambre `#F59E0B`) et C5 (Arbitrage,
> rose `#F43F5E`) demandent l'**attention humaine**. Règle socle absolue : **jamais
> d'auto-validation** ; la décision passe **toujours** par un geste manuel explicite (`✎`).

## 1. Principe

C4 et C5 ne sont pas de « mauvais » niveaux à corriger en silence : ce sont des **alertes** qui
doivent **sauter aux yeux** (priorité de saillance maximale — cf. `hierarchie_visuelle.md` §3) et
**bloquer** tout chemin de validation automatique. Couleur vive **+ glyphe `❗`** + texte, jamais
la couleur seule.

## 2. Rendu visuel

| Élément | C4 — Majorité | C5 — Arbitrage |
|---|---|---|
| Couleur de niveau | ambre `#F59E0B` | rose `#F43F5E` |
| Glyphe de niveau | `◑` | `⚖` |
| Marque d'alerte | **`❗`** ajouté à la marque d'état | **`❗`** + liseré marqué (le plus saillant) |
| Liseré du bloc | 2 px ambre | 2–3 px rose, plus appuyé |
| Saillance | élevée (3ᵉ après C5) | maximale (sommet de l'ordre d'attention) |

Le glyphe d'état n'est **jamais** `✓` tant que la décision humaine n'a pas eu lieu : on affiche
`❗` (rose `#F43F5E` pour le conflit, ambre pour C4) et non `◷` neutre, afin de différencier
« à valider, banal » de « à arbitrer, attention requise ».

## 3. Verrou anti-auto-validation

- Les chemins rapides (« valider + suivant », validation en lot C1) **ne s'appliquent pas** aux
  clauses C4/C5 : le bouton de validation rapide est **désactivé** (opacité 0.4, `aria-disabled`,
  tooltip « Décision humaine requise — C4/C5 »).
- Aucune pré-validation par seed ou moteur n'est consolidée automatiquement sur C4/C5 ; elles
  restent en `❗` jusqu'à action.

## 4. Bouton de décision manuelle (`✎`)

Action **explicite** et unique pour lever le conflit :

| Propriété | Valeur |
|---|---|
| Libellé | « Décider (manuel) » avec glyphe `✎` |
| Cible | ≥ 32 px (action importante, hors gouttière dense) |
| Couleur | vert action humaine `#22C55E` (cohérent avec la provenance manuelle) |
| Effet | ouvre la décision : choisir le thème primaire (et éventuels secondaires via le toggle `🏷`), puis valider |
| Résultat | la clause devient provenance **`✎` (manuel)** validée — le `❗` disparaît, remplacé par `✎` vert |

Après décision, le niveau Cx d'origine (C4/C5) **reste consultable** dans l'historique / le
tooltip (« arbitré manuellement, niveau initial C5 »), mais l'état affiché est validé manuel.

## 5. États interactifs

| État | Rendu |
|---|---|
| Repos | `❗` + couleur de niveau + liseré ; le bloc attire l'œil sans clignoter |
| Survol | tooltip « C5 Arbitrage — désaccord fort, décision humaine obligatoire » ; le bouton `✎` s'éclaire |
| Focus clavier | anneau de focus sur le bouton `✎` ; navigable au clavier en priorité |
| Désactivé (validation rapide) | bouton rapide grisé, `aria-disabled`, raison au tooltip |
| Résolu | `❗` → `✎` vert (≤ 200 ms, morphing), liseré d'alerte retiré |

## 6. Accessibilité

- `❗` est doublé d'un `aria-label` : « Conflit C5 — arbitrage requis » / « Majorité C4 — à
  vérifier ». L'alerte n'est jamais portée par la seule couleur vive.
- L'ordre de tabulation amène **en premier** vers les clauses C5 puis C4 dans une vue de revue
  (cf. priorité d'attention socle).
- Contraste du liseré et du glyphe ≥ 3:1 sur le fond ; texte du tooltip ≥ 4.5:1.
