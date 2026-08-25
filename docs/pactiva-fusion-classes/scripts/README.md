# Annexe — scripts d'analyse reproductibles

Trois scripts, rejouables sur **tout export du Lab** (dossier contenant
`manifest.json`, `sentences.jsonl`, `votes.jsonl`, `judges.jsonl`,
`reference.jsonl`). Ils réutilisent le package `research/pactiva_lab`
(α-MASI, AC1, bootstrap par document) — aucune dépendance externe (pur Python).

```bash
# env : conda « claire » (ou tout Python ≥ 3.11 avec le repo présent)
python explore.py  <dossier-export>   # statistiques factuelles (fascicule 01)
python simulate.py <dossier-export>   # effets des schémas T14/T11/T10 (fascicule 02 §5)
python paired.py   <dossier-export>   # Δ appariés d'α-MASI, mêmes tirages bootstrap
```

| Fichier | Rôle |
|---|---|
| `schemes.py` | les mappings T14 / T11 / T10 — source unique |
| `explore.py` | supports, déséquilibre, confusions, α par thème, lien CLAUDETTE |
| `simulate.py` | α-MASI + IC, désaccords, supports, MI, AP LODO, accord juges — par schéma |
| `paired.py` | Δ d'α-MASI vs T20 sur les MÊMES tirages (IC + stabilité du signe) |
| `resultats/*.json` | sorties datées du 25 août 2026 sur l'export `f68c4e9e…` (prod, 24 août) |

Les chiffres cités par les fascicules 00–02 proviennent exactement de ces
sorties. Pour la version « papier », le protocole 03 remplace ces scripts par
l'axe `theme_map` du Lab (runs versionnés, mêmes plis) — ces scripts restent la
trace de l'aperçu.
