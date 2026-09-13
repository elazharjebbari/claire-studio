# Audit de l'accès Grid'5000 depuis la production

**Date** : 13 septembre 2026 · **Site de production** : `pactiva.legal` · **Compte G5K** : `ejebbari`

---

## 1. Ce qui a été vérifié, et comment

L'audit n'est pas déclaratif : chaque ligne ci-dessous est le résultat d'une commande
réellement exécutée depuis le serveur de production, pas une lecture de configuration.

| Maillon | Méthode de vérification | Résultat |
|---|---|---|
| Identifiants API | `test_connection()` du backend `Grid5000Backend` | ✅ `api_ok: true` — 12 sites listés |
| Clé SSH | connexion réelle à `access.grid5000.fr` | ✅ `ssh_ok: true` |
| Chiffrement des secrets | `ComputeCredential.ssh_key_encrypted` + `decrypt_secret` | ✅ jamais en clair sur disque |
| Environnement conda distant | `ls ~/.conda/envs` sur lyon | ✅ `pactiva-lab` présent |
| Quota disque | `df -h ~` | ✅ 3,3 To libres |
| Package d'expérimentation | empreinte des fichiers sur les frontales | ❌ **périmé** (voir §2) |
| Cache de modèles | `du -sh ~/.cache/huggingface` | ❌ **vide** (voir §3) |
| Type de job GPU | soumission OAR réelle | ❌ **refusée** (voir §4) |

Trois défauts bloquants ont été trouvés. Aucun n'était visible depuis l'interface : tous
les trois se seraient manifestés *après* la réservation d'un nœud, c'est-à-dire au moment
le plus coûteux.

---

## 2. Défaut n° 1 — le package distant datait du 14 août (le plus grave)

`~/pactiva-src/pactiva_lab` sur les frontales **n'est pas couvert par le déploiement de la
plateforme** : il se synchronise à la main. Les frontales portaient encore la version du
14 août, antérieure à l'axe de taxonomie (T20/T14/T11/T10).

**Pourquoi c'était grave, et pas seulement gênant.** Le code de configuration ignore
silencieusement les clés qu'il ne connaît pas. Un run soumis avec `data.taxonomy: "T11"`
aurait donc tourné **en T20**, sans aucune erreur, et rendu des chiffres étiquetés T11.
C'est la pire catégorie de panne : pas un plantage, un résultat faux et plausible.

**Correction (commits `d0b521f`, `f73530c`).** Trois pièces complémentaires :

1. **Résolution multi-chemins de la spécification** — sur Grid'5000 il n'existe pas
   d'arborescence `frontend/` ; `taxonomy.py` cherche désormais la spécification à côté du
   package, puis dans le dépôt, avec surcharge possible par `PACTIVA_TAXONOMY_SPEC`.
2. **Déclaration de capacités** — le package annonce `CAPABILITIES = {"taxonomy_projection",
   "population_filter"}` et `runner.assert_capabilities(config)` s'exécute **en premier** :
   une configuration qui demande une capacité absente échoue immédiatement, avec le remède
   dans le message. Un package périmé ne peut plus produire de chiffres faux.
3. **Scripts de synchronisation reproductibles** — `scripts/sync_g5k.sh` (poste de travail)
   et `scripts/sync_g5k_from_prod.py` (serveur, clé SSH déchiffrée en mémoire). Tous deux
   transfèrent le package **et** la spécification, avec `--delete`, puis **vérifient à
   distance** les empreintes obtenues.

**État après correction** — les deux sites répondent identiquement :
`taxonomy=PRESENT | spec=f6cdd2715df02177 | caps=1 | axe=18`

---

## 3. Défaut n° 2 — le cache de modèles était jeté à chaque job

Le script de job exportait `HF_HOME="$RUN_DIR/.hf"`, soit un cache **détruit avec le
répertoire du run**.

**Pourquoi c'était bloquant.** Les nœuds de calcul n'ont pas l'accès Internet dont dispose
la frontale — vérifié : `curl https://huggingface.co` renvoie `200` depuis lyon, et aucune
variable `http_proxy` n'est définie sur les nœuds. Sans cache pré-peuplé, tout
fine-tuning aurait échoué **après** la réservation du GPU, sur une erreur réseau obscure.
Accessoirement, le sweep `encoders-comparison` aurait payé 20 téléchargements.

**Correction (commit `e95d61b`).**

- Cache persistant `~/.cache/huggingface`, en substitution **conditionnelle**
  (`${HF_HOME:-…}`) : qui veut isoler un run exporte `HF_HOME` en amont, et sa valeur est
  respectée. Un cache HuggingFace est adressé par (dépôt, révision) : le partager ne
  menace pas la reproductibilité.
- **Garde-fou checkpoint** (`exit 66`), calqué sur le garde-fou GPU existant : le job
  vérifie en une seconde que le modèle est dans le cache et, sinon, échoue avec le remède
  écrit dans le message — plutôt que de consommer du GPU pour découvrir l'absence.
- `scripts/prefetch_g5k_models.py` peuple le cache depuis la frontale.

**Sous-défaut rencontré pendant le pré-téléchargement.** Le protocole Xet (déduplication
par blocs de HuggingFace) renvoie `404` depuis les frontales, sur les deux sites, alors que
l'API HTTP classique répond `200` ; de plus, une seule erreur empoisonnait les
téléchargements suivants (« Previous task error »). Correction : `HF_HUB_DISABLE_XET=1`,
`max_workers=1` et une nouvelle tentative par dépôt.

---

## 4. Défaut n° 3 — les GPU de lyon exigent le type de job `exotic`

La première soumission GPU a été refusée par OAR :

> `Filtering out exotic resources (pyxis, neowise, hydra, gemini, sirius).`
> `HINT: Add the 'exotic' job type in the request payload…`

Le runner **sait** demander ce type (`compute.g5k.exotic`), mais rien ne l'indiquait à la
composition de la configuration. La correction a consisté à l'activer dans les trois
configurations, pas à modifier le code : la capacité existait déjà, documentée depuis le
14 août par un commentaire qui garde volontairement ce choix en configuration plutôt qu'en
dur, la classification « exotique » étant décidée côté Grid'5000 et susceptible de changer.

---

## 5. Ce que l'audit valide en creux

Les maillons suivants ont été confirmés **par exécution réelle**, pas par lecture de code :
chiffrement des secrets, transfert `rsync` via la passerelle, soumission OAR, sondage
d'avancement, rapatriement des résultats, écriture en base — et la projection de taxonomie
sur le nœud lui-même. Le détail de cette validation est en `02_PLAN_ACTION.md` §3.
