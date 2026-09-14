# LLM_EXTRACTION — construire la couche normative avec des LLM sans en faire une vérité

> Répond aux sections 9 (construction automatique) et 10 (sélection des modèles). Décision :
> [ADR-004](adr/ADR-004-llm-extraction-strategy.md). Artefacts : schéma JSON
> [`llm/schemas/clause_template.schema.json`](../llm/schemas/clause_template.schema.json), prompt
> [`llm/prompts/clause_template_extraction.md`](../llm/prompts/clause_template_extraction.md), registre
> [`llm/prompts/PROMPT_REGISTRY.md`](../llm/prompts/PROMPT_REGISTRY.md), configuration des modèles
> [`configs/models.yaml`](../configs/models.yaml).
>
> Principe non négociable : **le LLM propose, un contrôle structural puis sémantique filtre, un juriste
> valide, le graphe conserve la provenance** ; aucune sortie LLM n'entre dans le graphe comme vérité.

---

## 1. Ce que l'on extrait, et à quel niveau

| Cible | Entrée | Sortie | Qui valide |
|---|---|---|---|
| **Énoncés normatifs** (`Norm`) d'une clause | texte de la clause (≤ 8 phrases, sinon découpe), son thème T11, l'inventaire d'actions du thème | 0..n objets `{actor, modality, action, object, condition, notice, remedy, evidence[]}` conformes au schéma | juriste (champ par champ) sur le hold-out ; échantillon sur la conception |
| Renvois internes (`REFERS_TO`) | clause | cibles (section, clause) | contrôle automatique (existence de la cible) |
| Thèmes (déjà faits) | phrase | thème T20 | annotateurs humains — **pas de nouvelle extraction** |

Ce que l'on **n'extrait pas** par LLM : l'abusivité (jamais), la sévérité, les frontières de clause
(source : annotateurs/consensus).

## 2. Stratégies comparées

| Stratégie | Description | Avantages | Risques | Verdict |
|---|---|---|---|---|
| Zero-shot libre | « extrais qui fait quoi » | rapide | sorties hétérogènes, non évaluables | ✗ |
| Few-shot | + 5–10 exemples validés | meilleure conformité de vocabulaire | fuite si exemples issus du hold-out | ✓ (exemples **de la conception**) |
| **Schema-guided + sortie structurée** | schéma JSON strict (énumérations fermées, `additionalProperties: false`, `evidence` obligatoire) imposé par l'API | conformité garantie, énumérations respectées, nullité explicite (`not_stated`) | le modèle peut « remplir pour remplir » → contrôle sémantique | **✓ base** |
| Génération contrainte locale (grammaire/regex, ex. Outlines) | même idée pour modèles ouverts | déploiement local, reproductible | outillage à maintenir | ✓ pour les modèles ouverts |
| Function calling | tool = `emit_norm` | équivalent | idem | ✓ (variante) |
| Pipeline en étapes | 1) segmenter la clause en énoncés 2) typer chaque énoncé 3) remplir | erreurs localisables, meilleure evidence | 3 appels | ✓ si RQ4 montre un gain |
| Multi-agent (extracteur + vérificateur) | second modèle vérifie l'ancrage textuel de chaque champ | réduit les hallucinations | coût ×2, risque de consensus d'erreur (mêmes biais) | ✓ en **vérificateur**, jamais en juge final |
| LLM + règles | post-traitement par règles (ex. `notice` détecté par regex de durée) | corrige les valeurs numériques | règles fragiles | ✓ pour dates/durées/montants |
| LLM + classifieur | un classifieur (Legal-BERT) pour `modality` | mesurable, reproductible | données d'entraînement = validé (bootstrap) | ✓ en phase 2 (après ≥ 1 000 templates validés) |
| LLM + contraintes d'ontologie | rejet des combinaisons impossibles (permission sans acteur ; `remedy` sur une prohibition) | filtre gratuit | — | **✓ obligatoire** |
| **LLM + validation humaine** | juriste accepte/corrige/rejette dans l'outil | ressource fiable, mesure de RQ0 | coût humain (~1 min/clause) | **✓ obligatoire** sur le hold-out |

## 3. Le pipeline de construction (avec ses portes)

```
clause (texte + thème + inventaire)                      → 1. Extraction (schema-guided, T=0, seed, prompt versionné)
   → 2. Validation structurale : JSON valide, énumérations, evidence ⊆ phrases de la clause, ≤ n énoncés
   → 3. Validation sémantique : contraintes d'ontologie (acteur obligatoire ; modalité unique ;
        remedy ∉ prohibition ; action ∈ inventaire du thème ; not_stated ≠ none)
   → 4. Vérification d'ancrage : chaque champ non-null doit être supporté par un span d'evidence
        (vérificateur = second passage LLM OU heuristique lexicale) ; score d'ancrage par champ
   → 5. Correction : re-prompt ciblé sur les champs rejetés (au plus 1 fois) ; sinon champ → not_stated + flag
   → 6. Validation juridique (humaine) : accept / edit / reject par champ ; horodatage, validateur
   → 7. Insertion : Norm + EVIDENCED_BY + PRODUCED_BY(Run) ; statut validated|proposed ; jamais d'écrasement
```

Chaque étape écrit un artefact (`results/extraction/<run_id>/step_k.jsonl`) et un compteur (taux de
rejet par étape) — ce sont les métriques de RQ4.

## 4. Hallucinations, relations manquantes, incertitude

- **Hallucination** = champ non-null sans span d'evidence qui le supporte, ou `Norm` sans phrase
  source. Mesure : taux par champ et par modèle (EVALUATION_PLAN §1). Parade : evidence obligatoire +
  vérificateur + rejet à l'étape 4.
- **Relations manquantes** = énoncé présent dans la clause et absent de la sortie (rappel). Mesure : sur
  l'échantillon validé, le juriste ajoute les énoncés manquants → rappel d'énoncé.
- **Relations incorrectes** = mauvais acteur/modalité/action. Mesure : exactitude par champ vs validé.
- **Incertitude** : le schéma impose `confidence ∈ [0,1]` par énoncé **et** la valeur `not_stated` ; la
  confiance auto-déclarée est calibrée contre l'exactitude observée (courbe de fiabilité) — si elle n'est
  pas calibrée, elle n'est pas utilisée dans le graphe autrement que comme métadonnée.
- **Provenance** : `Run{model, version, prompt_hash, schema_hash, seed, temperature, started_at, cost}` ;
  chaque `Norm` → `PRODUCED_BY` ; chaque correction humaine → `Activity{validator, at, diff}`.
- **Reproductibilité** : température 0, seed fixé quand l'API le permet, 3 exécutions sur le pilote ;
  taux d'identité des sorties = métrique ; modèles ouverts épinglés par hash de poids.

## 5. Sélection des modèles — un protocole, pas une opinion

Ce que nous savons déjà (nos données, tâche voisine : thème par phrase sur vocabulaire fermé) : κ vs
consensus humain **fable 0,58, claude 0,52, mistral 0,33, codex 0,26** ; deux juges Anthropic s'accordent
à 0,80 entre eux. Cela oriente le pilote, cela ne le remplace pas : l'extraction structurée est une
autre tâche.

**Candidats** (à confirmer au moment du pilote ; aucun chiffre de performance n'est avancé ici) :

| Famille | Modèles candidats | Déploiement | Sortie structurée | Remarques |
|---|---|---|---|---|
| Propriétaires frontier | Claude Opus 5 (`claude-opus-5`, 5 $/25 $ par M tokens), Claude Sonnet 5 (`claude-sonnet-5`, 2 $/10 $), Claude Fable 5.1 (`claude-fable-5-1`, 10 $/50 $), Haiku 4.5 (`claude-haiku-4-5`, 1 $/5 $) — tarifs API Anthropic au 24 juin 2026 | API | native (`output_config.format`, `strict`) | déjà nos juges les plus proches des humains ; Batch API à −50 % pour 2 450 clauses |
| Propriétaires autres | GPT (OpenAI), Gemini (Google) | API | native | à inclure pour la défendabilité de la comparaison ; tarifs à relever au moment du run |
| Ouverts généralistes | Llama 3.x 70B, Qwen 2.5/3 (72B), Mistral Large / Mixtral, DeepSeek | local (vLLM) ou hébergé | via génération contrainte | déploiement local = reproductibilité et confidentialité |
| Ouverts juridiques | SaulLM (7B/54B/141B) | local | contrainte | spécialisation juridique ; à tester face aux généralistes |
| Petits modèles | Haiku 4.5, Llama 8B, Qwen 7B | API / local | oui | pour le vérificateur et le passage à l'échelle |

**Protocole de sélection (E4-pilote)** : 100 clauses de la **conception** (stratifiées par thème T11,
20 % longues), templates de référence validés par deux juristes ; chaque candidat exécuté 3 fois à T=0 ;
métriques : conformité de schéma, exactitude par champ, rappel d'énoncé, taux d'hallucination,
reproductibilité, coût par 1 000 clauses, latence, possibilité de déploiement local. Décision par un
score pondéré **déclaré à l'avance** (exactitude 40 %, hallucination 20 %, reproductibilité 15 %, coût 15 %,
déployabilité 10 %). Le modèle retenu extrait les 2 450 clauses ; un second modèle (ouvert) sert de
**réplication** sur le hold-out pour montrer que les résultats de RQ2 ne dépendent pas d'un fournisseur.

## 6. Coûts et volumes (ordres de grandeur, à mesurer)

2 450 clauses × ~400 tokens d'entrée (clause + consignes) + ~300 tokens de sortie ≈ 1,7 M tokens par
passage complet ; avec Claude Opus 5 : de l'ordre de 10–20 $ par passage (moitié en Batch) ; 3 passages
+ vérificateur < 100 $. Le coût humain (validation à ~1 min/clause) domine : 2 450 clauses ≈ 40 h,
d'où la stratégie **hold-out complet validé (888 clauses ≈ 15 h)**, conception par échantillon.

## 7. Ce qui est explicitement hors de la vérité terrain

Les sorties LLM non validées sont stockées avec `status=proposed` et n'entrent **dans aucune métrique
de RQ2/RQ3** autrement que comme ablation (« templates bruts ») ; les modèles ne voient jamais les
labels CLAUDETTE ni les items de l'annexe au moment de l'extraction (le prompt ne contient que la
clause, le thème et l'inventaire) — contrôle par relecture du prompt versionné.
