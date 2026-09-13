# Plan d'action — exécuter les expérimentations sur Grid'5000

**Principe directeur** : ne jamais engager de GPU pour découvrir un défaut de déploiement.
Chaque étape ci-dessous ne coûte que ce qu'il faut pour valider le maillon suivant.

---

## Étape 1 — Remettre les frontales au niveau du dépôt (préalable absolu)

```bash
# Depuis le poste de travail
bash scripts/sync_g5k.sh --login <identifiant> --sites "lyon nancy"

# Depuis le serveur de production (clé SSH déchiffrée en mémoire)
python manage.py shell < scripts/sync_g5k_from_prod.py
```

Le script **vérifie après transfert** et doit afficher, sur chaque site :

```
taxonomy=PRESENT | spec=f6cdd2715df02177 | caps=1 | axe=18
```

Toute divergence de l'empreinte `spec` signifie que le nœud n'exécutera pas la taxonomie
demandée : arrêter là.

> **À retenir** : cette étape est à refaire après **tout** changement dans
> `research/pactiva_lab/` ou dans `frontend/src/lib/taxonomy/taxonomies.json`. Le
> déploiement de la plateforme ne la couvre pas.

## Étape 2 — Peupler le cache de modèles depuis la frontale

```bash
python manage.py shell < scripts/prefetch_g5k_models.py
```

Les nœuds n'ayant pas Internet, c'est la frontale qui télécharge. Le script est idempotent.

## Étape 3 — Valider la chaîne par un job CPU court (15 minutes de walltime)

Un job délibérément minimal, dont le seul but est de prouver que la chaîne complète
fonctionne : configuration → transfert → soumission OAR → exécution → rapatriement → base.
**Le point vérifié est l'axe de taxonomie** : on demande T11 et on exige 11 classes en
retour.

Ce qui a été obtenu (job OAR `6925504`, nancy, 24,9 s d'exécution) :

| Vérification | Attendu | Obtenu |
|---|---|---|
| Taxonomie effective | 11 classes | ✅ 11 (`ACCOUNT_USE`, `CONTENT_IP`, … `WARRANTY_DISCLAIMER`) |
| Empreinte du dataset | `7116e627f528c557` | ✅ identique |
| Documents / phrases | 50 / 9 414 | ✅ |
| Environnement | nœud Grid'5000 | ✅ Linux 6.12 debian13, torch 2.13, sklearn 1.9 |

Sans l'étape 1, ce job aurait rendu des chiffres T20 étiquetés T11. C'est précisément ce
que le garde-fou de capacités empêche désormais.

## Étape 4 — Lancer les expérimentations GPU

Trois expériences, toutes sur `nlpaueb/legal-bert-base-uncased`, plis groupés **par
document** (jamais par phrase), graine 42, bootstrap 1 000 rééchantillonnages :

| Expérience | Tâche | Taxonomie | Ce qu'elle tranche |
|---|---|---|---|
| Legal-BERT fine-tune — T20 | `T1_primary` | T20 | Référence sur la taxonomie d'annotation |
| Legal-BERT fine-tune — T11 | `T1_primary` | T11 | La fusion est-elle plus apprenable ? |
| Legal-BERT multi-label — T11 | `T2_multilabel` | T11 | La tâche **réelle** du protocole, à comparer au plafond α-MASI (0,635) et non au plafond κ |

Réglage indispensable sur lyon : `compute.g5k.exotic: true` (cf. audit §4).

## Étape 5 — Intégrer à la campagne

Les enveloppes de RQ4 (`research/experiments/rq4_models.py`) lisent des répertoires de run.
Les résultats Grid'5000 doivent donc être exportés depuis la base vers ces répertoires,
puis `run_campaign.py` régénère `frontend/src/features/paper/campaign.json`.

L'apport direct : la limite déclarée de E4.1 — « planchers CPU uniquement : les encodeurs
juridiques fine-tunés (GPU) ne sont pas inclus dans cette campagne » — devient levable.

---

## Ce que ce plan ne fait délibérément pas

- **Il ne lance pas `encoders-comparison`** (4 checkpoints × 5 plis, ~6 h GPU). Ce sweep
  compare Legal-BERT à des encodeurs généralistes : c'est une question secondaire, à
  engager une fois le résultat principal acquis. Ses checkpoints restent à pré-télécharger
  (le correctif Xet est en place, l'exécution ne l'est pas).
- **Il ne touche pas au GOLD.** Les quatre expériences qui en dépendent resteront
  `preliminary` tant que les 50 résolutions ne sont pas finalisées — c'est le comportement
  voulu des contrôles automatiques, pas un défaut.
