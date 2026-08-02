# Valoriser le dataset d'annotation & résoudre les conflits inter-annotateurs

> Réponse à deux questions liées : **(1)** faut-il valoriser le travail d'annotation thématique
> lui-même (dataset) ? **(2)** comment choisit-on la version finale — fusion, démocratie, ou comité ?
> Les deux sont indissociables : **la méthode de résolution *définit* le dataset publié.**
> Contexte : **3 annotateurs × 50 ToS** disponibles courant août 2026.

> ## ✅ Décisions arrêtées (porteur)
> - **Valoriser les DEUX** : les **thèmes** (paper ressource) **ET** les **graphes** (détection
>   d'anomalies) → portefeuille **deux papiers** (voir §4, montage « R+G »).
> - **Résolution des conflits** = **cascade tiérée** (unanime→auto / majorité ≥2/3→auto /
>   divergence→comité humain priorisé ; multi-label = primaire majoritaire + secondaires si ≥2).
> - **Publier deux couches** : **hard gold arbitré + soft labels / votes bruts** (désaccord préservé).

---

## 1. Oui — le dataset d'annotation thématique est une contribution à part entière

Une **triple annotation** de 50 ToS (≈9 414 phrases) en **thèmes multi-label + frontières + certitude +
rationale**, bilingue **EN + FR**, avec **accord inter-annotateur** et un **protocole de gold traçable**,
est un **travail conséquent** et une **ressource** que la communauté JURIX reconnaît explicitement
(*« datasets for AI & Law »*). C'est aussi le **socle** de tout le reste (le graphe d'anomalies se
construit *sur* ce dataset). Il faut donc **le publier comme un objet scientifique**, pas seulement s'en
servir.

**Ce qui en fait une vraie contribution (le delta vs CLAUDETTE) :**

| | CLAUDETTE / UNFAIR-ToS (Lippi 2019) | **Dataset Pactiva enrichi** |
|---|---|---|
| Unité | phrase | **clause** (frontières) + phrase |
| Étiquette | 8 catégories d'abusivité (binaire) | **thèmes multi-label** (≈20) + labels d'abusivité conservés |
| Confiance | — | **certitude 0–3** par clause |
| Explication | — | **rationale** + span d'évidence |
| Annotateurs | agrégé, **désaccord effacé** | **3 annotateurs, désaccord préservé** (soft labels) |
| Accord | κ binaire ≈0,64 *(à vérifier)* | **α de Krippendorff (MASI)** multi-label, par thème |
| Langue | EN | **EN + FR** (aligné phrase à phrase) |
| Gold | adjudication (opaque) | **protocole de résolution traçable + outillé** |

**Feasibilité 2026 :** avec les 3 annotateurs livrés en août, une **ressource** (dataset + protocole +
IAA + baselines) est **réaliste pour la deadline** — et c'est la contribution la **plus sûre** (les
données existent, pas de pipeline lourd à construire).

**Implication sur le portefeuille** (voir §4) : le **paper ressource passe de « programme 2027 » à
candidat *flagship* 2026**. Il valorise directement l'effort d'annotation, et le graphe d'anomalies
devient le **second papier qui s'appuie dessus**.

---

## 2. Résoudre les conflits : fusion, démocratie, ou comité ?

### 2.1 Les trois familles, honnêtement comparées

| Stratégie | Principe | Forces | Faiblesses | Verdict |
|---|---|---|---|---|
| **A. Fusion / union** (multi-label) | garder **tout** thème proposé par ≥1 annotateur | recall max, aucun thème perdu, garde les rares | **précision effondrée** (un thème parasite d'un seul annotateur pollue le gold) ; pas de « décision » ; sur-étiquetage | ❌ **pure** ; ✅ **union-avec-plancher** (≥2) |
| **B. Démocratie / majorité** | par unité & par thème, garder si **majorité** | simple, transparent, standard | **grossier à 3 annotateurs** (un 2-1 bascule) ; jette la minorité-correcte ; **poids égal** ignore la fiabilité ; les **thèmes rares** n'atteignent jamais la majorité | ✅ pour les cas **faciles** (auto) |
| **C. Comité / adjudication 1-par-1** | un **arbitre humain** tranche chaque conflit | **qualité max**, gère la nuance, standard juridique (CLAUDETTE, ACORD) | **coûteux** (impossible sur tout) ; biais/fatigue d'arbitre ; à **prioriser** | ✅ pour le **résidu** (conflits réels) |

### 2.2 La bonne réponse n'est pas « l'une des trois » mais **une cascade tiérée** (déjà implémentée)

Le moteur `projects/gold_scoring.py` de Pactiva fait déjà **la synthèse** — décision **par phrase**,
**annotateurs seuls** (les LLM ne sont **jamais** parties au conflit, seulement référence indicative) :

```
Accord UNANIME (même primaire + mêmes secondaires)   → auto_1click  (accepté automatiquement)
Accord MAJORITAIRE (primaire >50% ET ≥ 2/3 d'accord) → auto         (démocratie, accepté auto)
DIVERGENCE (pas de majorité, ex. 1-1-1)              → manual       (COMITÉ : arbitrage humain tracé)

Multi-label :  primaire = majorité pondérée (argmax) ;  secondaires = thème porté par ≥ 2 annotateurs
Confiance   = soutien pondéré des annotateurs pour le primaire × fiabilité(thème)
Bande de risque = strict→low, majorité→medium, divergence→high     (pour prioriser l'arbitrage)
Leviers      = poids par annotateur (per_annotator) + fiabilité par thème (reliability)
```

→ **Fusion (avec plancher ≥2), démocratie (auto ≥2/3), et comité (manual)** cohabitent, **chacune sur les
cas qu'elle traite le mieux**. C'est exactement ce que recommande la littérature d'annotation, et **c'est
déjà outillé, traçable et reproductible** (arbitrage sous verrou exclusif, décision horodatée, gold figé
immuable une fois finalisé).

### 2.3 Pourquoi la cascade > chaque stratégie seule
- **Efficience** : ~l'essentiel des phrases (unanimes + majoritaires) est **auto-résolu** → l'humain ne
  dépense son temps que sur les **vrais** conflits (le résidu « manual »).
- **Qualité** : les conflits durs vont au **comité** (pas à un vote 2-1 aveugle).
- **Multi-label géré** : primaire **décidé**, secondaires **par plancher de support** (ni union naïve, ni
  perte).
- **Prioritisation** : la **bande de risque** (divergence = high) ordonne l'arbitrage — on peut y brancher
  un **active-learning** (envoyer d'abord les conflits à fort désaccord/enjeu ; cf. ActiveLab, Gruber
  2025) pour tenir le budget d'arbitrage.

### 2.4 Trois raffinements recommandés pour la rigueur scientifique

1. **Mesurer l'accord AVANT résolution** — publier **α de Krippendorff (distance MASI)** multi-label,
   **par thème** et **avant/après formation** : c'est le signal de fiabilité honnête (et le prérequis du
   graphe). Rapporter aussi **Gwet AC** (robuste au ratio ~9:1 des thèmes rares).

2. **Ne pas *effacer* le désaccord** (le reproche de **Braun 2023** à tous les datasets juridiques) →
   **publier deux couches** :
   - **Hard gold** : la version arbitrée (cascade ci-dessus) — pour l'usage « référence unique ».
   - **Soft labels + votes bruts** : la **distribution des thèmes par phrase** (les 3 votes) — pour
     l'usage *perspectivist* (LeWiDi), l'audit des annotateurs (A1) et la mesure de **l'ambiguïté
     irréductible** (les phrases où le comité lui-même ne tranche pas nettement).
   C'est ce qui rend la ressource **moderne et différenciante**.

3. **Agrégation informée par la fiabilité** (option) — au lieu d'un vote à poids égal, **pondérer les
   annotateurs** (levier `per_annotator` déjà présent) à partir d'un **modèle d'annotateur** (MACE /
   Dawid-Skene / CROWDLAB) qui détecte un annotateur systématiquement biaisé. ⚠️ Avec **3 annotateurs**,
   ces modèles sont **peu robustes** (peu de redondance) → à utiliser surtout pour **détecter** un biais
   (audit A1) et **documenter**, pas pour survaloriser un annotateur. **Défaut sûr = poids égal +
   comité** ; le poids-modèle est un **complément d'analyse**, pas la décision principale.

### 2.5 Piège spécifique au multi-label : l'alignement des unités
L'accord multi-label n'a de sens que sur des **unités alignées**. Le choix du moteur — **décider par
phrase** (le thème d'une phrase = celui de sa clause) — **contourne élégamment le désaccord de
frontières** : chaque phrase reçoit un jeu de thèmes, et **les frontières de clauses se reconstruisent**
comme des **plages de thèmes identiques**. À documenter comme choix de conception (et à rapporter
séparément : accord *par phrase* vs accord *de frontières*, comme le suggère la décomposition du « mur du
κ »).

---

## 3. Le protocole recommandé (résumé actionnable)

> **Cascade tiérée, désaccord préservé :**
> 1. **Aligner** sur la phrase (thème propagé depuis la clause).
> 2. **Auto** : unanime → `auto_1click` ; majorité ≥2/3 → `auto`.
> 3. **Comité** : divergence → arbitrage humain **priorisé** par la bande de risque (active arbitration).
> 4. **Multi-label** : primaire décidé (majorité pondérée) ; secondaires si **≥2** annotateurs.
> 5. **Publier deux couches** : *hard gold* arbitré **+** *soft labels / votes bruts*.
> 6. **Rapporter** : α-MASI (par thème, avant/après formation), Gwet AC, taux auto vs arbitré, part
>    d'ambiguïté résiduelle.
> **→ Largement déjà implémenté dans `gold_scoring.py` + le module GOLD (arbitrage tracé, gold figé).**

---

## 4. Impact sur le portefeuille JURIX 2026 (révision)

**Décision arrêtée : montage « R+G » — valoriser les thèmes ET les graphes**, en **deux papiers
complémentaires** ciblant JURIX 2026 (le second s'appuie sur la ressource du premier) :

| Papier | Type | Contenu | Valorise |
|---|---|---|---|
| **A — Ressource** | **long** (flagship) | **CLAUDETTE-Themes** : dataset enrichi (clause multi-label + certitude + rationale, EN+FR) + **protocole de gold tiéré** (cascade) + **IAA α-MASI** + **soft labels** (deux couches) + baselines **Legal-BERT**. Intègre l'**audit annotateurs (A1)** comme section qualité. | **les thèmes** |
| **B — Graphe** | **short → long** | **Hypergraphe clause–thèmes** + **anomalie de co-occurrence ↔ abusivité CLAUDETTE** (evaluée contre labels, precision@k/AUC-PR), ablations D1 (bruit déontique) / G5 (robustesse). Construit **sur la ressource** du papier A. | **les graphes** |

**Séquencement :** A **fournit et publie** le gold fiable (α-MASI + soft labels) ; B le **consomme** pour
détecter les anomalies. Idéalement les **deux à JURIX 2026** (A en long, B en short/long) ; si le temps
manque pour B, il glisse en 2027 sans rien perdre. Le **protocole de résolution de conflits** (cascade +
deux couches) est le **cœur méthodologique du papier A** — la réponse à *« comment on choisit la version
finale »* **est** une contribution.

**Titres pressentis :**
- **A** — *« CLAUDETTE-Themes: A Multi-Label, Multi-Annotator Clause-Theme Enrichment of Unfair-ToS with a
  Transparent, Disagreement-Preserving Gold Protocol. »*
- **B** — *« Hypergraph Co-Occurrence Anomalies for Unfair-Clause Discovery in Terms of Service. »*

**Différenciation clé** (à écrire) : là où CLAUDETTE **adjuge et efface** le désaccord, on **préserve** le
désaccord (soft labels, réponse à Braun 2023) et on **publie le protocole** (cascade auto/comité) — un
**apport méthodologique** autant qu'une ressource.

---

## 5. Suivi

**Arrêté** (✅) : montage **R+G** (valoriser thèmes + graphes) · résolution **cascade tiérée** · publication
**deux couches** (hard gold + soft labels).

**Reste opérationnel :**
1. **État campagne** : combien de ToS **multi-annotés** et **arbitrés** d'ici mi-août (détermine α-MASI,
   audit A1, budget de comité). *(à extraire de la prod.)*
2. **Budget d'arbitrage** : prioriser le comité par **bande de risque** (active arbitration) pour tenir la
   deadline sur les phrases « manual ».
3. **Formation** : dispose-t-on de données **avant/après** guidelines pour montrer l'effet sur l'α-MASI ?
4. **Export soft labels** : vérifier que la publication ne **fuit aucun texte contractuel** sous licence
   restrictive (le module export gold existe : `gold/export.py`).
5. **Poids-modèle (MACE)** : rester en **complément d'audit** (peu robuste à 3 annotateurs), pas la
   décision principale.

---

## Note de fiabilité
Fondé sur le code (`projects/gold_scoring.py`, module `gold/`) et la littérature d'annotation (MASI
Passonneau 2006 ; MACE/Dawid-Skene ; LeWiDi ; Braun 2023 ; Gwet AC). Le κ CLAUDETTE ≈0,64 et les chiffres
de campagne sont **à confirmer**. La robustesse des modèles d'annotateur à **3 annotateurs** est limitée
(à traiter en audit/complément, pas en décision principale).
