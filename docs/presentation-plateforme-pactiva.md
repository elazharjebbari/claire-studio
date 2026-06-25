# Pactiva — Plateforme d'annotation juridique assistée

> **Présentation complète des fonctionnalités et de leur intérêt.**
> Pactiva (anciennement *CLAIRE Studio*) est une plateforme web d'annotation de contrats et
> de documents juridiques, conçue pour produire des **jeux de données de référence (« gold »)
> de haute qualité**, mesurables et traçables. Backend Django REST, frontend Next.js
> (App Router) + Zustand. En production sur **https://pactiva.legal**.
>
> Ce document est une synthèse transverse, recoupée avec le code réel et les dossiers de
> conception sous `docs/pactiva/`. Pour le détail d'un sous-système, voir les dossiers cités.

---

## 1. La promesse en une page

Annoter du droit à la main est **lent, subjectif et difficile à mesurer**. Pactiva attaque
les trois fronts à la fois :

- **Vitesse** — l'annotateur ne fait plus une relecture uniforme. Des pré-annotations de
  plusieurs modèles (LLM) servent de point de départ, et un **moteur de triage** classe chaque
  phrase par niveau de confiance (C1→C5) pour **accepter le quasi-certain d'un geste** et
  concentrer l'effort humain là où il compte (≈ 43 % du corpus passe en auto/quasi-auto).
- **Qualité** — rien n'est jamais imposé : une pré-annotation ne vaut **jamais référence** tant
  qu'un humain ne l'a pas validée. La qualité est **mesurée** (accord inter-annotateurs : κ de
  Cohen, κ de frontières, α de Krippendorff-MASI multi-label) et **gouvernée** (revues,
  machine à états, versions immuables).
- **Traçabilité** — chaque décision est attribuée, horodatée, versionnée et exportable, avec
  des **invariants d'intégrité** gardés en base. Le résultat est un jeu de données défendable,
  reproductible et conforme.

**Trois principes structurants** traversent toute la plateforme :

1. **L'humain décide, la machine assiste.** Les suggestions (LLM, triage) sont déterministes,
   explicables et réversibles ; jamais appliquées d'office.
2. **Indépendance des sessions (ADR-001).** Un annotateur ne lit jamais le travail d'un pair —
   condition pour que la mesure d'accord reflète un jugement réel et non mutualisé.
3. **Confiance graduée.** Le découpage (frontières dure/molle), l'étiquetage (multi-label) et
   la difficulté (triage C1–C5) sont des signaux distincts et explicites.

---

## 2. Architecture en bref

| Couche | Technologie | Rôle |
|---|---|---|
| Frontend | Next.js (App Router), React, **Zustand** (store local), React Query | Workspace d'annotation, console admin, état optimiste + auto-save |
| Backend | Django REST Framework, Channels (WebSocket) | API, invariants, IAA, exports, présence temps réel |
| Données | Corpus → Documents → Phrases ; Schémas (thèmes + natures) ; Annotations → Clauses (multi-label) | Modèle pivot versionné |
| Assistance | Pré-annotations multi-juges importées (Claude / Codex / Mistral) | Comparaison, seed, triage (hors-ligne, pas d'appel LLM à la volée) |
| Prod | VPS, systemd, déploiement avec gate de tests + healthcheck + rollback | `pactiva.legal` |

---

## 3. Annotation — le cœur

L'espace de travail combine trois panneaux redimensionnables (plan / document / inspecteur)
pilotés par un store local optimiste, pour une saisie fluide au clavier. Dossier de référence :
`docs/pactiva/dossier-inspecteur-workspace/`.

### Saisie & qualification
- **Multi-label natif (1 primaire + N secondaires).** Une clause exprime un sujet principal
  *et* des sujets connexes. Le thème scalaire reste le miroir du primaire (rétro-compatibilité
  mono-label totale) ; le `support` trace la provenance inter-juges. Un thème **refuge**
  (préambule, divers) ne peut **jamais** être secondaire. → *Intérêt : qualification fine sans
  perdre la simplicité, et un fourre-tout ne peut pas polluer une étiquette.*
- **Frontières de clause dure/molle + support.** Le découpage du contrat porte une frontière
  d'ouverture nette (`hard`) ou incertaine (`soft`), avec le nombre de juges concordants. →
  *Intérêt : signale à l'annotateur les zones de fusion/scission probable, là où sa décision
  vaut le plus — un signal de qualité du découpage, distinct du thème.*
- **Deux axes de confiance orthogonaux.** La **certitude 0–3** (ressenti subjectif, réglée au
  clavier) est distincte du **niveau de triage C1–C5** (difficulté objective dérivée de
  l'accord inter-juges). → *Intérêt : on distingue « où l'humain hésite » de « où les modèles
  divergent » — deux leviers de pilotage qualité différents.*
- **Validation humaine explicite.** Chaque clause porte `validated`. Une saisie manuelle, un
  geste de bloc ou une adoption de frontière la valide ; un pré-remplissage LLM reste **non
  validé**. Une soumission n'est complète que si **toutes** les phrases sont validées. →
  *Intérêt : filet de qualité central — l'automatique ne fait jamais référence sans
  confirmation humaine.*

### Édition à grande échelle
- **Sélection puissante** : plage contiguë, toggle, sélection arbitraire non contiguë, et une
  barre d'outils (« jusqu'à la frontière », « segment courant », « tout le thème », « tout »).
  **Sélection multi-blocs au clic-droit glissé** pour re-thématiser/étendre/réduire/désannoter
  un bloc entier. → *Intérêt : annoter en lot au lieu de phrase par phrase — gain majeur sur de
  longs contrats répétitifs.*
- **Undo / redo transactionnel** (profondeur 200) : chaque opération de lot ne pose **qu'un**
  snapshot, donc s'annule atomiquement. → *Intérêt : marge d'erreur sans peur sur les gestes
  puissants — tout est réversible d'un coup.*
- **Navigation clavier** : `j`/`k` (phrase), `B`/`T` (palette de thème), `C` (commenter),
  `0–3` (certitude), `⌘Z`/`⌘⇧Z` (undo/redo), `⌘S` (snapshot). → *Intérêt : annotation au fil de
  la lecture, sans souris — vitesse et moindre fatigue.*

### Repères visuels
- **Plan / sommaire (ToC)** avec saut rapide et deux **barres de progression** : couverture
  (clauses / total) et **validation** (validées / total). → *Intérêt : pilotage de complétude
  d'un coup d'œil.*
- **Inspecteur de clause** : thème (avec définition au survol), nature juridique, certitude,
  citation (evidence span), justification (rationale), et un **comparateur N-modèles** par champ
  avec « Reprendre ». → *Intérêt : annotation traçable et défendable — la citation est reliée à
  sa raison et aux propositions des modèles.*
- **Gouttière des frontières par modèle** + surlignages (voir §5).

### Fiabilité de l'enregistrement
- **Auto-save incrémental** : debounce, **diff par ancre** (create/update/delete minimal),
  écriture optimiste, **reprise hors-ligne** (événement `online`), backoff borné sur erreurs
  transitoires, état terminal sur 4xx, indicateur d'état (idle→saved→error). → *Intérêt :
  aucune perte de travail silencieuse, le risque majeur d'une session longue.*
- **Idempotence + convergence (upsert).** Chaque création porte un `client_op_id` : un retry
  réseau ne duplique pas. En cas de désynchronisation, l'`upsert` met à jour au lieu de
  renvoyer un conflit (409) — le brouillon local fait foi pour sa propre annotation. → *Intérêt :
  l'enregistrement converge toujours, même après coupure ou rechargement partiel.*

---

## 4. Annotation assistée — triage C1–C5 (aide à la décision)

L'accélérateur du produit. Dossier complet : `docs/pactiva/dossier-annotation-assistee/`
(comprehension, comparatif, architecture, moteur, UX, plan, tests).

- **Moteur de triage déterministe, pur.** À partir des votes de K juges (thème + frontière),
  il route chaque phrase vers **C1 (Or) → C5 (Arbitrage)** sans aucun appel LLM ni confiance
  auto-déclarée. La confiance dérive de l'**accord inter-juges** — donc reproductible et
  auditable. → *Intérêt : classe ~43 % du corpus en auto/quasi-auto et concentre l'humain sur
  C4/C5 ; recalculable instantanément.*
- **Règles versionnées, source unique** (YAML → TypeScript + Python) : refuges, couples de
  cluster (chevauchement juridique réel), préséances, priorités, alias de codes. → *Intérêt :
  arbre de décision explicite, traçable, évolutif ; la version des règles est jointe à chaque
  résultat.*
- **Parité TS ↔ Python testée** sur un jeu de cas « golden » partagé. → *Intérêt : ce que
  l'annotateur voit (front) et ce que le serveur pré-calcule (batch) sont identiques.*
- **Carte de suggestion (contexte / décision / logique).** Pour chaque phrase : le niveau, le
  set recommandé (chips primaire/secondaire ou candidats), la frontière, **et l'explication
  déterministe** (votes réels, règle appliquée, κ de fiabilité mesuré). → *Intérêt :
  transparence totale — l'annotateur voit *pourquoi*, sans nouveau modèle.*
- **Acceptation à trois granularités** : un geste (Entrée), **lot C1** (touche `A`), **lot
  sélection** (touche `S`). Les lots passent en une transaction d'undo ; C5 est exclu des lots.
  → *Intérêt : débit maximal — le quasi-certain part en masse, le reste se traite à la carte,
  le tout réversible.*
- **Affordances d'ajustement par niveau** : permuter primaire/secondaire, retirer le
  secondaire, choisir un candidat, annuler un override anti-refuge. → *Intérêt : la suggestion
  est un point de départ ajustable en un clic ; l'humain reste maître.*
- **Pédagogie intégrée** : compteurs colorés par niveau, **légende repliable**, **modale d'aide**
  accessible (`?`) expliquant la méthodologie et tous les raccourcis, et **overlay opt-in** du
  niveau C1–C5 *dans le document* (pastille sur le badge / liseré). → *Intérêt : auto-formation
  in-context, code couleur unique partout (cf. `ux/14-aide-decision-ui.md`).*
- **Sensibilité à la sélection** : synchronisation bidirectionnelle file ↔ document (cliquer une
  phrase positionne la file ; naviguer la file scrolle le document ; anti-boucle géré), et la
  sélection multiple alimente « Accepter la sélection ». → *Intérêt : va-et-vient fluide entre
  texte et file.*

> Les niveaux C1–C5 — **C1** Or (accord total, lot) · **C2** Haute (1 clic) · **C3** Multi-label
> (cluster) · **C4** Majorité (vérifier) · **C5** Arbitrage (décision humaine).

---

## 5. Assistance LLM & comparaison multi-juges

La plateforme **consomme des pré-annotations importées** (offline) de plusieurs modèles ;
elle n'invoque pas les LLM à la volée. Source des juges côté front : `lib/llmJudges.ts`.

- **Pré-annotations multi-juges** (Claude / Codex / Mistral), stockées append-only avec le JSON
  brut conservé, **jamais mélangées à l'or humain**. → *Intérêt : point de départ et de
  comparaison, traçable pour l'audit.*
- **Import & normalisation multi-schémas** (formats v9.2/v9.4 → clause-pivot), avec **repli** par
  reconstruction depuis les annotations phrase-à-phrase si le plan de blocs est absent. →
  *Intérêt : ingestion fiable et idempotente de sorties LLM hétérogènes.*
- **Normalisation des codes de thème** (vocabulaire LLM → schéma fermé ; inconnu → refuge). →
  *Intérêt : pas de clause rejetée, invariant « thème dans le schéma » respecté ; le code brut
  reste en base pour l'audit.*
- **Seed d'une annotation humaine depuis un juge** (éditable, source marquée, ancres
  dédupliquées). → *Intérêt : démarrer d'un plan LLM sans rien imposer.*
- **Multi-versions de schéma** + sélecteur de version (ne pilote que l'overlay LLM). → *Intérêt :
  comparer/consulter une version de plan précise, suivre l'évolution des sorties dans le temps.*
- **Accord inter-juges** : % de concordance + **κ de Cohen** (pairwise), **accord N-way**
  (toutes sources) et **segments d'accord** (agree / diverge / partial). → *Intérêt : quantifie
  objectivement où les modèles divergent pour cibler l'arbitrage.*
- **ComparePanel** (comparaison visuelle N-way + navigation des désaccords), **réglette des
  frontières par modèle** (gouttière), **fantômes LLM** (overlay non destructif),
  **BoundaryEvidence** (popover de preuves par juge avec « Reprendre »), **InspectorJudgeCompare**
  (comparer/adopter par champ). → *Intérêt : arbitrer en connaissance de cause — preuve textuelle
  + raisonnement de chaque modèle au point de décision.*
- **Adoption de frontière / segment** : adopter toute la frontière d'un juge en un geste, en
  marquant la source de résolution + validation. → *Intérêt : trancher un conflit de découpage
  rapidement et de façon traçable.*

---

## 6. Collaboration, qualité & traçabilité

Dossiers : `docs/pactiva/dossier-collaboration/` et `dossier-tests-multi-annotation/`.

### Indépendance & intégrité
- **Indépendance des sessions (ADR-001 / INV-ISO).** Un annotateur ne voit que ses propres
  sessions, jamais le contenu de celles des pairs (la supervision est réservée aux
  admins/owners et reviewers). → *Intérêt : la lecture du travail d'un pair ne peut pas biaiser
  l'annotation ni contaminer la mesure d'accord.*
- **Écriture owner-only.** Le contenu d'une session (clauses, statut, soumission) n'est
  modifiable que par son auteur — aucune dérogation, même admin/reviewer. → *Intérêt : chaque
  session de référence reflète le jugement d'un seul annotateur (condition de validité de l'IAA).*

### Mesure d'accord (IAA)
- **κ de Cohen pairwise** sur le thème par phrase, agrégé par document puis moyenné (uniquement
  sur les sessions soumises). → *Intérêt : repère **où** l'accord chute (quel document, quelle
  paire) pour cibler la relecture.*
- **κ de frontières** (accord sur le découpage) **+ κ par thème** (one-vs-rest, avec support),
  calculés par paire puis moyennés (correction anti-double-comptage à N≥3). → *Intérêt : sépare
  l'accord sur *où commencent les clauses* de l'accord sur *l'étiquette*, et révèle les thèmes
  ambigus à clarifier dans le guide.*
- **α de Krippendorff avec distance MASI** (multi-label) : accord sur des **ensembles** de
  thèmes. Propriété de cohérence : sur étiquettes mono, α_MASI se réduit à κ (sanity-check du
  protocole). → *Intérêt : indicateur « tête de gondole » qui capture l'accord même quand
  plusieurs thèmes sont assignés à une clause.*

### Gouvernance & traçabilité
- **Revues & décisions** (score 1–5, approve / request_changes / reject, grille, markdown) qui
  **pilotent la machine à états**. → *Intérêt : étape qualité formelle et tracée — transforme une
  soumission en gold approuvé ou en retour de correction.*
- **Commentaires & fils** ancrés sur annotation/clause/phrase, avec résolution. → *Intérêt :
  collaboration explicite sans altérer la session de référence.*
- **Versioning immuable** (snapshots numérotés append-only) + **diff inter-versions** clause par
  clause. → *Intérêt : traçabilité non répudiable et reproductibilité du gold ; on voit
  exactement ce qui a changé entre deux états.*
- **Machine à états gouvernée** (`transition_status`, INV-5) : transitions validées, audit et
  snapshot atomiques, transitions illégales refusées (409). → *Intérêt : statut, audit et
  versions toujours cohérents.*
- **Journal d'audit append-only** (qui a fait quoi, quand, sur quoi), isolé par projet. →
  *Intérêt : imputabilité et gouvernance qualité.*
- **Attribution multi-annotateurs** (dernier auteur + couleur d'identité stable, par clause ou
  phrase) et **présence temps réel** (WebSocket + repli REST). → *Intérêt : lecture de
  supervision et coordination sans rompre l'isolation.*

---

## 7. Administration & gouvernance

Console `/admin` (8 sections), protégée par un contrôle de rôle (403 explicite pour un
annotateur, pas de redirection silencieuse).

- **Corpus & documents** (provenance, licence, intégrité par checksum, index de phrase
  contigu) et **import CLAUDETTE** (texte + labels d'injustice de référence). → *Intérêt :
  maîtrise et traçabilité des données ; vérité-terrain d'injustice comme point de comparaison.*
- **Schémas versionnés** (thèmes + natures juridiques + **couleurs**, vocabulaire fermé). →
  *Intérêt : référentiel d'étiquettes stable et partagé (cohérence inter-annotateurs) ; figer
  ou cloner un vocabulaire sans casser l'historique.*
- **Campagnes** (couplent corpus + schéma, consignes, statut, visibilité) — unité de gouvernance
  et d'isolation. **Membres & rôles** à deux niveaux : global (`annotator/reviewer/admin/owner`)
  et par campagne (`annotator/reviewer/lead`). → *Intérêt : répartition fine des
  responsabilités.*
- **Assignations document↔annotateur + bulk** (produit cartésien ou **recouvrement `overlap=k`**
  round-robin). → *Intérêt : distribue le travail à grande échelle, et le recouvrement crée
  volontairement le multi-annotateur nécessaire à l'IAA.*
- **Suivi d'avancement & supervision** (par annotateur : assigné/démarré/soumis/% ; matrice
  document×annotateur ; ouverture en lecture seule). → *Intérêt : visibilité temps réel sur
  l'avancement sans altérer le travail d'autrui.*
- **Authentification JWT** (login throttlé anti-brute-force, refresh, `/me` qui n'autorise que
  display_name/locale) ; **inscription + vérification e-mail + reset** sans fuite d'existence de
  compte (tokens signés expirables, aucune table de tokens). → *Intérêt : accès sécurisé à des
  données confidentielles ; pas d'auto-élévation de privilèges ; conformité RGPD/sécurité.*
- **Traductions FR stockées** (file-based, par phrase ; relues, jamais traduites en ligne). →
  *Intérêt : annoter un corpus anglophone en lisant le FR, de façon déterministe et reproductible.*
- **Liens de partage révocables** (rôle accordé, expiration, quota ; jamais d'accès anonyme) et
  **vue publique** (agrégats lecture seule : KPI + distribution de thèmes ; aucune annotation
  brute). → *Intérêt : onboarding contrôlé et diffusion transparente des résultats sans rompre
  la confidentialité.*
- **Surlignage d'injustice CLAUDETTE** (catégorie + niveau de sévérité par phrase). → *Intérêt :
  oriente l'attention vers les passages potentiellement abusifs.*

---

## 8. Exports & exploitation

Dossier : `docs/pactiva/dossier-export-async/`.

- **5 formats réellement implémentés** : **JSONL** (pivot, échange machine), **CSV** (analyse
  tableur), **Markdown** (relecture humaine), **CoNLL** (entraînement de modèles de segmentation),
  **XML** (intégration) — plus une **matrice de concordance IAA** (κ pairwise par document). →
  *Intérêt : le bon artefact selon l'usage, sans retraitement manuel.*
- **Format pivot + repli tracé** (un format non implémenté retombe sur JSONL, consigné dans le
  manifeste — jamais de repli silencieux). **Manifeste auto-documenté** joint à chaque export
  (provenance, scope, comptes, dictionnaire de champs). → *Intérêt : export honnête, auditable
  et exploitable sans connaître le code.*
- **Scope filtrable** (statuts gold-grade par défaut, documents, annotateurs). → *Intérêt :
  n'exporter que les données de la qualité voulue.*
- **Export asynchrone non bloquant** (202 immédiat, exécution en tâche de fond) avec **statut
  persistant hors transaction** (un échec reste visible), **self-heal** des jobs zombies au
  timeout, **retry idempotent**, et **téléchargement confiné** (anti path-traversal). → *Intérêt :
  l'utilisateur continue à travailler ; aucun job fantôme ; tout échec est actionnable et
  sécurisé.*

---

## 9. Intégrité, sécurité & mise en production

- **Six invariants gardés en base** : INV-1 (index de phrase unique/doc), INV-2 (une clause-début
  par phrase et par session), INV-3 (thème dans le schéma), INV-4 (annotation unique
  projet/document/annotateur), INV-5 (toute transition de statut journalisée + snapshot à la
  soumission), INV-6 (certitude ∈ {0,1,2,3}). → *Intérêt : pas de doublon faussant l'IAA, pas de
  thème hors-schéma, traçabilité complète — des exports fiables en aval.*
- **Isolation projet & permissions par rôle** centralisées (`is_project_member`, `IsAdminRole`,
  `IsAnnotationOwner`). → *Intérêt : cloisonnement multi-tenant et intégrité de l'auteur unique.*
- **Déploiement avec gate + healthcheck + rollback** : `deploy-claire.sh` lance pytest +
  `tsc --noEmit` + vitest **avant** de pousser, puis pull/migrate/build/restart sur le VPS, et un
  healthcheck final ; **échec → rollback automatique** au commit précédent. → *Intérêt : aucun
  code non testé en prod, aucun déploiement cassé laissé en place.*

---

## 10. Pourquoi Pactiva — synthèse de l'intérêt

| Enjeu | Ce que Pactiva apporte |
|---|---|
| **Produire vite** | Pré-annotations LLM + triage C1–C5 + acceptation en lot + édition de blocs + clavier-first |
| **Produire juste** | Validation humaine obligatoire, multi-label, frontières dure/molle, suggestions explicables et réversibles |
| **Mesurer la qualité** | κ de Cohen, κ de frontières, κ par thème, **α de Krippendorff-MASI**, recouvrement multi-annotateur |
| **Gouverner** | Revues, machine à états, rôles, assignations, supervision d'avancement |
| **Tracer & prouver** | Versions immuables, diff, journal d'audit, attribution, manifeste d'export |
| **Exploiter** | Exports multi-formats async, vue publique d'agrégats, formats prêts pour l'analyse et l'entraînement |
| **Tenir en prod** | Auto-save sans perte, idempotence, isolation projet, déploiement testé avec rollback |

En une phrase : **Pactiva transforme l'annotation juridique d'un travail manuel et invérifiable
en un processus assisté, mesurable et défendable** — où la machine propose, l'humain décide, et
chaque décision est tracée du clic jusqu'à l'export.

---

## Annexe — repères

**Niveaux de triage.** C1 Or (émeraude) · C2 Haute (lime) · C3 Multi-label (violet) · C4 Majorité
(ambre) · C5 Arbitrage (rose). Code couleur unique : `frontend/src/lib/triage/levels.ts`.

**Rôles.** Global : `annotator`, `reviewer`, `admin`, `owner`. Campagne : `annotator`,
`reviewer`, `lead`.

**Cycle de vie d'une annotation.** `draft → submitted → in_review → approved | rejected →
archived` (transitions gardées, snapshots automatiques à submitted/approved/rejected).

**Dossiers de conception** (`docs/pactiva/`) : `dossier-annotation-assistee/` (triage),
`dossier-inspecteur-workspace/` (UX du workspace), `dossier-collaboration/` (ADR-001, IAA),
`dossier-tests-multi-annotation/` (invariants & validation), `dossier-export-async/` (exports).

> *Document de synthèse — fonctionnalités recoupées avec le code (apps backend `annotations`,
> `projects`, `corpora`, `schemes`, `imports`, `exports`, `collaboration`, `audit`,
> `translations`, `accounts`, `common` ; frontend `components/workspace`, `lib/triage`,
> `store`, `app/(app)`).*
