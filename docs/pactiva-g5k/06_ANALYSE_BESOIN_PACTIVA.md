# Analyse — comment utiliser Grid'5000 pour le besoin réel de Pactiva Lab

> Confronte la recherche documentaire (`research/`) à ce que Pactiva Lab a réellement à
> calculer : les 14 presets déjà écrits dans
> `docs/pactiva-lab/specs/pipeline-presets.yaml`, le modèle Experiment/Run, et l'écran
> `ExperimentLauncher` tout juste câblé (session du 11 août 2026).

---

## 1. Ce que nos presets demandent réellement à Grid'5000

Sur les 14 presets, seuls **5 nécessitent réellement un GPU** (les autres tournent en
local, CPU, quelques minutes) :

| Preset | Modèle | Sweep | Durée estimée | Besoin GPU |
|---|---|---:|---|---|
| `legal-bert-finetune` | `nlpaueb/legal-bert-base-uncased` | non | ~45 min | 1 GPU, ~16 GB suffisent |
| `multilabel-finetune` | idem, tâche T2 | non | ~45 min | 1 GPU |
| `encoders-comparison` | 4 checkpoints (Legal-BERT, RoBERTa, DeBERTa, ModernBERT) | **4 runs** | ~3 h (×4 séquentiel = ~12 h) | 1 GPU par run |
| `sequence-boundary` | Legal-BERT + CRF, tâche T3 | non | ~1 h | 1 GPU |
| `ablation-context` | Legal-BERT, fenêtre de contexte | **6 runs** | ~2 h (×6 = ~12 h si séquentiel) | 1 GPU par run |

Legal-BERT-base pèse ~440 Mo (110M paramètres) — un GPU à 16 Go de VRAM (Tesla V100,
P100) est **largement suffisant**. Pas besoin des clusters H100/H200/MI300X réservés
aux LLM de plusieurs dizaines de milliards de paramètres. C'est une information
directement exploitable : **inutile de viser les clusters les plus demandés/contendus**
(`chicoree` 4×H200 à Lille, `vianden` 8×MI300X au Luxembourg) — un cluster GPU modeste et
probablement moins demandé (Nancy `grouille`, Lille `chifflot`) convient très bien et
réduit le temps d'attente en file.

## 2. Quelle queue, quel walltime

- **`default`** convient pour `legal-bert-finetune`, `multilabel-finetune`,
  `sequence-boundary` (45 min-1 h, largement sous la limite de 14 h hors week-end, et
  sous la limite de 2 h/jour cumulées si lancé en journée — à surveiller si plusieurs
  runs de ce type sont lancés le même jour).
- **`encoders-comparison`** (4×3h=12h) et **`ablation-context`** (6×2h=12h) **dépassent
  la fenêtre journalière `default`** (2h/jour en semaine 9h-19h) si exécutés
  séquentiellement dans un seul job. Trois options, du plus simple au plus robuste :
  1. **Nuit/week-end** (`-t night` ou `-t weekend`, borne 19h-9h/samedi-dimanche,
     walltime ~14h) — suffisant pour les deux presets en un seul job de nuit.
  2. **Paralléliser** : réserver plusieurs nœuds GPU en une fois (`resources:
     "nodes=4,walltime=03:00"` pour `encoders-comparison`) et lancer les 4 variantes en
     parallèle plutôt qu'en séquence — walltime redescend à ~3h, rentre dans `default`
     en journée.
  3. **Queue `production`** (Nancy/Rennes/Grenoble/Sophia) si le compte a un niveau de
     priorité suffisant (p3=48h/p4=24h couvrent déjà 12h) — mais walltime-change
     impossible à Nancy, donc bien dimensionner dès la soumission.
- **Aucun de nos presets ne nécessite la queue `besteffort`** (pas de criblage massif de
  centaines de runs interruptibles dans notre plan actuel) — mais elle reste une option
  naturelle pour le futur `screening-preprocess` GPU-lourd si le plan évolue.

## 3. Le sweep — ne PAS soumettre N jobs OAR séparés

La doc est explicite : *« It is a bad practice on Grid'5000 to submit a high number of
OAR small jobs »*. Nos 2 presets GPU à sweep (`encoders-comparison` 4 runs,
`ablation-context` 6 runs) doivent donc être packagés en **une seule réservation** qui
exécute les variantes en interne — soit séquentiellement (script bash qui boucle),
soit en parallèle (`nodes=N`, une variante par nœud). C'est un changement d'architecture
par rapport à `claire/lab/services.queue_run`, qui aujourd'hui crée un `ExperimentRun`
Django (et potentiellement un job OAR) **par variante de sweep** — voir
`07_ARCHITECTURE.md` §Batch G5K pour la conception détaillée.

## 4. Stockage — poids de modèles partagés, pas retéléchargés à chaque run

Les 5 presets GPU téléchargent des poids HuggingFace (Legal-BERT, RoBERTa-base,
DeBERTa-v3-base, ModernBERT-base) — plusieurs centaines de Mo à 1-2 Go chacun. Sans
mutualisation, chaque run les re-téléchargerait depuis Internet (NATé, non garanti en
bande passante) à chaque réservation.

**Action recommandée, une fois** : demander un **Group Storage** (par e-mail à
`support-staff@lists.grid5000.fr`, objet « Group storage creation », ~10-20 Go
suffisent pour nos 4 checkpoints + cache d'embeddings) sur le site où l'on réserve le
plus (probablement Nancy ou Lille). Configurer `HF_HOME` dessus dans le script généré —
déjà partiellement prévu dans `06_GRID5000.md` (historique) §5 `hf_home`, à conserver.

Cette démarche est **hors du périmètre automatisable** (pas de self-service, voir
`research/04_STOCKAGE_RESEAU.md` §2.2) — l'architecture logicielle doit simplement
**accepter un chemin de Group Storage en configuration** et échouer explicitement s'il
n'est pas renseigné pour un run GPU (plutôt que de retélécharger silencieusement à
chaque fois).

## 5. Sélection informée du cluster — nouvelle capacité à construire

La Reference API expose `gpu_devices` (modèle, `memory` en octets, `compute_capability`)
par nœud. Avant de lancer `legal-bert-finetune`, l'architecture peut désormais **vérifier
qu'un cluster candidat a bien un GPU ≥16 Go** avant de le proposer/réserver, plutôt que
de découvrir l'échec après coup. C'est une amélioration directe par rapport au squelette
actuel (`claire/lab/runners/g5k.py`), qui ne consulte jamais la Reference API.

## 6. Environnement logiciel — cohérent avec ce qui existait déjà

Le script généré (`06_GRID5000.md` historique §6) prévoyait déjà Conda + garde-fou
`nvidia-smi`/`torch.cuda.is_available()`. La recherche confirme que c'est **exactement**
la bonne pratique documentée (§`05_MONITORING_ML_GPU.md` §4.2-4.4) : pas besoin de
Kadeploy, Conda avec `pytorch-cuda=X.Y` explicite, vérification post-connexion plutôt
que pré-réservation (aucun mécanisme pré-réservation fiable n'existe côté Grid'5000).
**Ce principe reste inchangé** dans la nouvelle architecture.

**Amélioration possible** (non prioritaire) : construire une image Singularity figée une
fois (poids CUDA/PyTorch garantis identiques à chaque run) plutôt que réinstaller Conda
à chaque réservation — gain de temps de démarrage et de reproductibilité stricte. Prévu
en piste d'extension future (§`09_PLAN_DEV.md`, hors lot 0).

## 7. Monitoring — un vrai gain scientifique pour l'article, pas juste opérationnel

Kwollect expose un exporteur **NVIDIA DCGM** par nœud GPU et une API `/metrics?job_id=X`
avec rétention indéfinie. Pour un article JURIX/AI & Law, **mesurer et publier l'empreinte
énergétique du fine-tuning** (kWh consommés par le run `legal-bert-finetune`) est un
argument de reproductibilité et d'impact environnemental de plus en plus attendu en
recherche IA appliquée — gratuit à obtenir une fois `-t monitor=wattmetre_power_watt`
activé à la réservation. **Ajouté au plan comme fonctionnalité P2** (§`09_PLAN_DEV.md`).

## 8. Ce que l'utilisateur doit faire, que le code ne peut pas automatiser

1. **Créer un compte Grid'5000** — [Get an account](https://www.grid5000.fr/w/Grid5000:Get_an_account).
   Éligibilité académique française probable (Pactiva/laboratoire de rattachement) ;
   sinon, parrainage requis (programme Open-Access fermé).
2. **Demander un Group Storage** une fois le compte actif (§4).
3. **Enregistrer les identifiants** dans Pactiva (`/lab` → onglet Calcul → déjà
   implémenté, chiffrement Fernet) — le code est prêt à les recevoir dès qu'ils
   existeront.
4. **Vérifier son niveau de privilège** (bronze/silver/gold — impacte l'accès à
   `besteffort` et le nombre de réservations à l'avance) une fois le compte créé, via
   `https://api.grid5000.fr/explorer` — aucune API ne l'expose de façon prévisible sans
   authentification, donc pas automatisable côté Pactiva.

## 9. Ce qui ne change pas — principe d'architecture maintenu

**Grid'5000 ne doit jamais être sur le chemin critique de l'article.** Les baselines,
embeddings gelés et criblages tournent en local (déjà le cas, cf. `execution du 11 août
2026 — poids réels exécutés`). Grid'5000 sert exclusivement au fine-tuning et aux
sweeps GPU (`legal-bert-finetune`, `multilabel-finetune`, `encoders-comparison`,
`sequence-boundary`, `ablation-context`). Si Grid'5000 est indisponible ou sans
identifiants configurés, ces 5 presets restent **listés mais leur lancement est refusé
avec un message explicite**, jamais masqués silencieusement — cohérent avec la
dégradation maîtrisée déjà conçue.
