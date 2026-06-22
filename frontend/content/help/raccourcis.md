# Raccourcis clavier

CLAIRE Studio est pensé pour le travail au clavier afin de réduire la fatigue.

## Workspace d'annotation

| Touche | Action |
|---|---|
| `j` | Phrase suivante |
| `k` | Phrase précédente |
| `n` | Divergence suivante *(mode comparaison)* |
| `p` | Divergence précédente *(mode comparaison)* |
| `1` | Adopter la proposition **Claude** sur la divergence courante *(mode comparaison)* |
| `2` | Adopter la proposition **Codex** sur la divergence courante *(mode comparaison)* |
| `e` | Aperçu evidence / rationale à la frontière courante |
| `g` | Afficher / masquer le panneau comparatif |
| `B` | Poser une frontière de clause sur la phrase focalisée |
| `T` | Cibler / ouvrir le sélecteur de thème |
| `C` | Ouvrir un commentaire sur la clause sélectionnée |
| `0`–`3` | Certitude de la clause sélectionnée (0 = très incertain → 3 = certain) |
| `⌘Z` | Annuler la dernière modification de clauses |
| `⌘⇧Z` / `⌘Y` | Rétablir |
| `⌘S` | Snapshot (instantané), fonctionne même en saisie |

> Hors mode comparaison, `1`–`2` conservent leur rôle de **certitude** : ils
> n'adoptent une proposition LLM que lorsqu'une divergence est ciblée. Les autres juges (ex. Mistral) s'adoptent via l'œil 👁 « Choisir ».

## Souris

| Geste | Action |
|---|---|
| Clic | Focus + pose / sélection de la frontière de clause |
| Clic-droit (immobile) | Ouvrir le menu d'annotation de la phrase |
| Clic-droit **maintenu + glisser** | Sélectionner une plage de **blocs** (clauses) |
| Shift + clic | Étendre la sélection de phrases |
| ⌘/Ctrl + clic | Ajouter / retirer une phrase de la sélection |

## Application

| Touche | Action |
|---|---|
| `⌘K` | Ouvrir la palette de commandes (recherche globale) |

> Les raccourcis `0–3`, `B`, `T`, `C` sont désactivés lorsque le focus est dans
> un champ de saisie (sauf `⌘S`), pour ne pas interférer avec la frappe.
