# Runbook — exécuter une campagne Grid'5000 de bout en bout

Séquence opératoire, dans l'ordre. Chaque étape porte son critère d'arrêt : si le critère
n'est pas atteint, **ne pas passer à la suivante** — le coût d'un défaut croît à chaque
étape, et devient du temps GPU perdu à l'étape 4.

---

## 0. Préalables

| Élément | Où | Vérification |
|---|---|---|
| Identifiants API Grid'5000 | `ComputeCredential` (chiffré) | page Calcul de l'interface → « Tester la connexion » |
| Clé SSH | idem | le test affiche `SSH : connexion SSH établie` |
| Environnement conda `pactiva-lab` | frontales lyon/nancy | `ls ~/.conda/envs` |

Attendu : `{"api_ok": true, "ssh_ok": true, "detail": "connexion établie (12 sites) · SSH : connexion SSH établie"}`

---

## 1. Synchroniser le package (à refaire après tout changement)

```bash
python manage.py shell < scripts/sync_g5k_from_prod.py     # depuis la production
bash scripts/sync_g5k.sh --login <id> --sites "lyon nancy" # depuis le poste de travail
```

**Critère d'arrêt** : chaque site doit renvoyer `taxonomy=PRESENT | spec=<empreinte> |
caps=1 | axe=18`, avec la même empreinte que `frontend/src/lib/taxonomy/taxonomies.json`.

## 2. Peupler le cache de modèles

```bash
python manage.py shell < scripts/prefetch_g5k_models.py
```

**Critère d'arrêt** : une ligne `OK <dépôt> -> <chemin>` pour chaque checkpoint utilisé par
les expériences prévues. Un `FAIL` sur un checkpoint qu'aucune expérience n'utilise n'est
pas bloquant.

## 3. Valider par un job CPU court

Créer une expérience `data.taxonomy: "T11"`, modèle `tfidf_linear`, compute
`{"target": "g5k", "require_gpu": false, "g5k": {"site": "nancy", "resources": "walltime=00:15"}}`.

**Critère d'arrêt** : le run réussit **et** sa matrice de confusion compte 11 classes. Un
run qui réussit avec 20 classes signale un package périmé — retourner à l'étape 1.

## 4. Lancer les expériences GPU

Réglages obligatoires :

```jsonc
"compute": {
  "target": "g5k", "require_gpu": true,
  "g5k": { "site": "lyon", "resources": "gpu=1,walltime=03:00", "exotic": true }
}
```

- `exotic: true` — **indispensable sur lyon** : tous les GPU du site y sont classés
  ressources exotiques et OAR refuse la réservation sans ce type de job.
- La file est drainée **séquentiellement** par le worker : trois runs s'enchaînent, ils ne
  s'exécutent pas en parallèle. En tenir compte pour estimer la durée totale.

**Diagnostic en cas d'échec** — le code de sortie nomme la cause :

| Code | Cause | Remède |
|---|---|---|
| 64 | aucun GPU visible sur le nœud | vérifier `require_gpu` et **contraindre le cluster** : à lyon, `gpu=1` seul peut être servi par **neowise** (GPU AMD MI50, `nvidia-smi` absent) — écrire `resources: "{cluster in ('gemini','sirius')}/gpu=1,walltime=…"` (constaté le 15 sept. 2026, job 2067175 ; vérifier l'état des nœuds avec `oarnodes`, gemini était Dead ce jour-là) |
| 65 | torch ne voit pas le GPU (CUDA/pytorch désaccordés) | reconstruire l'environnement conda |
| 66 | checkpoint absent du cache HuggingFace | étape 2 |
| `capability_missing` | package distant périmé | étape 1 |
| `g5k_unreachable` + `exotic` dans le message | type de job manquant | ajouter `exotic: true` |

**Suivre un job réellement** (au-delà du statut affiché) :

```bash
oarstat -j <job_id> -f | grep -E "state|assigned_hostnames"
```

## 5. Exporter et intégrer à la campagne

```bash
python manage.py shell < scripts/export_g5k_runs.py   # écrit /tmp/pactiva-runs/
# rapatrier vers research/runs/, puis :
python research/experiments/run_campaign.py --model-runs research/runs
```

**Critère d'arrêt** : `campaign.json` contient E4.4 et E4.5, et la vue « Résultats
expérimentaux » de l'interface les affiche avec leur provenance complète.
