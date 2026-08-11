# UX/UI — Grid'5000 dans le Lab

> Étend l'écran « Calcul » (`ComputeSettings.tsx`, déjà livré) sans le remplacer :
> ajoute ce que la recherche a révélé nécessaire (clé SSH distincte, choix de cluster
> informé), rien de plus. Cohérent avec le système de style existant (tokens, garde
> anti-hex, primitives `Button`/`Panel`).

---

## 1. Ce qui existe déjà et reste inchangé

`ComputeSettings.tsx` : formulaire login/mot de passe, bouton « Tester la connexion »,
message d'état, motif explicite si `LAB_CREDENTIALS_KEY` absente côté serveur. **Ce
comportement pour le mot de passe API ne change pas.**

## 2. Ce qui s'ajoute — le formulaire d'identifiants

```
┌ Identifiants Grid'5000 ──────────────────────────────────────────────┐
│  Identifiant (API)        [ ajebbari                              ]  │
│  Mot de passe (API)       [ ••••••••••••  ]  (jamais réaffiché)     │
│                                                                       │
│  ⓘ La clé ci-dessous sert UNIQUEMENT au transfert de fichiers        │
│    (rsync) — Grid'5000 n'accepte pas de mot de passe en SSH.         │
│    Générez une clé DÉDIÉE : ssh-keygen -t ed25519 -f pactiva-g5k     │
│    puis ajoutez-la à votre compte Grid'5000 avant de la coller ici.  │
│                                                                       │
│  Clé SSH privée (rsync)   [ ┌─────────────────────────────────────┐ ]│
│                              │ -----BEGIN OPENSSH PRIVATE KEY----- │  │
│                              └─────────────────────────────────────┘ │
│                            (jamais réaffichée non plus)               │
│                                                                       │
│  [ Enregistrer ]     [ Tester la connexion ]                         │
│                                                                       │
│  ✓ API accessible        (testé le 11/08 à 14:32)                   │
│  ✓ Transfert SSH opérationnel  (testé le 11/08 à 14:32)              │
│  — ou, si la clé manque —                                            │
│  ⚠ Transfert SSH non testé : aucune clé enregistrée                  │
└───────────────────────────────────────────────────────────────────────┘
```

**Point d'ergonomie central** : les deux résultats de test (`apiOk`/`sshOk`) sont
**deux lignes distinctes**, jamais un seul badge agrégé — un utilisateur avec un mot de
passe correct mais pas encore de clé SSH doit voir précisément lequel manque, pas un
« échec » générique qui masquerait lequel des deux corriger.

## 3. Nouveau : aperçu des clusters GPU compatibles

Affiché dans le formulaire « Nouvelle expérience » (`ExperimentLauncher.tsx`,
déjà livré) quand un preset GPU est sélectionné et `compute.target === "g5k"` — **avant**
de créer l'expérience, pour éviter de découvrir après coup qu'aucun cluster ne convient :

```
┌ Cluster Grid'5000 recommandé ─────────────────────────────────────────┐
│  Modèle : nlpaueb/legal-bert-base-uncased (~440 Mo, GPU ≥8 Go suffit) │
│                                                                        │
│  Site      Cluster     GPU              VRAM    Queue                │
│  nancy     grouille    2× A100          40 Go    default    ✓ choisi │
│  lille     chifflot    2× P100/V100     16 Go    default             │
│  luxembourg larochette  4× MI210         64 Go    default             │
│                                                                        │
│  ⓘ Liste triée par VRAM croissante suffisante — inutile de viser      │
│    les plus gros clusters (H100/H200) pour un modèle de cette taille. │
└────────────────────────────────────────────────────────────────────────┘
```

Alimenté par `GET /projects/<slug>/lab/g5k/clusters?minVramGb=8` (nouveau endpoint,
§`07_ARCHITECTURE.md` §4) — si aucun identifiant Grid'5000 n'est configuré, ou si l'API
Grid'5000 est injoignable, ce panneau affiche un état vide explicite (« configurez vos
identifiants Grid'5000 pour voir les clusters disponibles »), **jamais une erreur qui
bloquerait la création de l'expérience** (le lancement en LOCAL reste toujours possible
sans ce panneau).

## 4. Nouveau : avertissement de sweep GPU

Quand `ExperimentLauncher` détecte un preset GPU avec `sweep` (ex. `encoders-comparison`,
4 variantes) et `compute.target === "g5k"` :

```
⚠ Ce sweep lancerait 4 réservations Grid'5000 séparées — déconseillé par la
  documentation officielle (préférer une réservation plus large). Réduire le
  nombre de variantes, ou continuer en connaissance de cause.
  [ Continuer quand même ]   [ Modifier la configuration ]
```

Cohérent avec le principe déjà en place ailleurs dans le produit : « un bouton désactivé
dit pourquoi » — ici, une action risquée **avertit pourquoi** plutôt que de la bloquer
silencieusement ou de l'autoriser sans explication.

## 5. Suivi d'un run G5K — inchangé dans sa forme, enrichi d'un détail

L'écran déjà conçu (`03.4` du dossier historique, toujours valable) affiche
`waiting`/`running`/`partial`/`failed` avec les codes d'erreur (`g5k_unreachable`...).
**Nouveaux codes à afficher explicitement** (cohérents avec `07_ARCHITECTURE.md` §7) :
`g5k_ssh_key_missing` (« aucune clé SSH enregistrée — le transfert de fichiers a
échoué avant même la réservation »), avec un lien direct vers l'écran Calcul.

## 6. Navigation — aucun changement

Le Lab garde sa structure à 3 onglets (Jeux de données / Expériences / Calcul, déjà
livrés). Rien de nouveau n'est ajouté au niveau navigation — les ajouts ci-dessus sont
des enrichissements *dans* les écrans existants, pas de nouveaux écrans autonomes.

## 7. Accessibilité

Mêmes règles déjà établies pour le Lab : contraste AA, équivalent tabulaire pour le
tableau de clusters, jamais la couleur seule (le badge ✓/⚠ porte aussi une icône + un
texte), `aria-live` pour les résultats de test de connexion.
