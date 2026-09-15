# Short paper JURIX 2026 — nommer les LLM éprouvés et mettre en avant leurs résultats

Relecture de la version soumise (`jurix2026-short-paper/`, commit `98f07ba`, corps de texte = 5 pages exactement,
7 pages avec références). Date : 15 septembre 2026.

## 1. Ce que l'article dit aujourd'hui des LLM

| Endroit | Formulation actuelle | Ce qui manque |
|---|---|---|
| Résumé | « by four large language models on the same sentences » ; « A fine-tuned legal encoder outperforms every language-model judge » | aucun nom, aucun chiffre |
| Introduction | « separately by four large language models prompted with the same vocabulary » | idem |
| §3 *The layer* | « four large language models prompted with the same vocabulary on the same sentences » | **identité des modèles, version, mode d'accès, réglages, date** |
| §3 *Construction* | les quatre juges → cinq paliers d'accord inter-juges ; 34,5 % des labels gold hors propositions ; « model outputs are never parties to the gold » | rien à ajouter (protocole clair) |
| §4, Table 2 | une seule ligne « Best LLM judge, stored labels, T20 : κ 0,581, acc. 0,601 » | **les trois autres juges, T11, macro-F1** |
| §4 dernier § | « the best of the four LLM judges reaches 0.581 » | classement, écart entre juges, stabilité T20→T11 |
| §5 Discussion | « judges are not substitutable for trained annotators (0.859 vs 0.581) » | ok |
| §5 Limitations | circularité déclarée ; sensibilité « excluding the strongest judge leaves the second at κ = 0.515 » ; « produced once and stored » | le test ancrage/compétence n'est pas rapporté ; les juges ne sont toujours pas nommés |

Conséquence : un relecteur ne peut ni situer les juges dans l'état de l'art (quelle génération ? quel fournisseur ?),
ni reproduire, ni juger si « le meilleur juge » est un modèle frontière ou non. Le mot-clé *LLM-as-a-judge* est
annoncé sans qu'aucun juge soit identifiable.

## 2. Ce que le dépôt sait — et ne sait pas — des quatre juges

**Connu et vérifié** (source : `frontend/src/features/paper/campaign.json`, expériences E3.1–E3.3 validées,
dataset `7116e627…`, 9 414 phrases, 50 documents pour chaque juge) :

| Juge (étiquette interne) | κ T20 | acc. T20 | macro-F1 T20 | κ T11 | acc. T11 | macro-F1 T11 | version du prompt de pré-annotation |
|---|---|---|---|---|---|---|---|
| fable | **0,581** | 0,601 | 0,390 | **0,591** | 0,629 | 0,367 | v9.2-nature-derived |
| claude | 0,515 | 0,539 | 0,341 | 0,531 | 0,576 | 0,332 | v9.2-nature-derived |
| mistral | 0,327 | 0,358 | 0,219 | 0,353 | 0,413 | 0,224 | v9.2 |
| codex | 0,266 | 0,305 | 0,173 | 0,302 | 0,375 | 0,181 | v9.2-nature-derived |

Faits complémentaires exploitables : classement **stable** de T20 à T11 (`rankingStable: true`) ; gain de κ par
consolidation faible pour les juges (+0,010 à +0,036) contre +0,067 d'α-MASI pour les humains ; matrice E3.1 :
humain↔humain κ 0,679–0,795, humain↔juge ≤ 0,594, **claude↔fable 0,800** (deux juges quasi redondants),
codex↔les autres 0,30–0,45 ; divergence des annotateurs au juge le plus proche 38,5–48,6 % (E3.2) ; ventilation
par classe d'accord humain (audit `02_AUDIT_OBJECTIONS.md` §1.2) : fable 0,607 / 0,636 / 0,212 (strict / majorité /
divergence), claude 0,578 / 0,543 / 0,128 — fable est le seul juge qui progresse là où les humains se divisent.

**Inconnu du dépôt — à fournir par les auteurs avant toute modification** : les fichiers de pré-annotation
(`data/preannotations/<juge>/`) ne portent que l'étiquette (`claude`, `codex`, `mistral`, `fable`) et la version
du prompt ; aucun identifiant de modèle, aucune date de génération, aucun réglage de décodage n'est enregistré
(l'audit l'avait noté : « le juge ayant servi au pré-remplissage n'est pas persisté »). Il faut donc, pour chacun :

| À renseigner | Pourquoi |
|---|---|
| Fournisseur et **identifiant exact du modèle** (nom commercial + identifiant d'API ou de version, ex. `claude-…`, `gpt-…`, `mistral-…`) | nommer sans ambiguïté ; situer la génération |
| Mode d'accès (API, CLI d'agent, interface) et **outil** utilisé | « Codex » et « Claude » sont des noms de produits, pas de modèles |
| Réglages : température, *reasoning effort*, longueur max, fenêtre (document entier vs fenêtre) | reproductibilité déclarée ; explique en partie les écarts |
| Période de génération (mois/année) et confirmation « une seule passe, sorties stockées » | déjà affirmé dans l'article, à dater |
| Texte du prompt v9.2 (et différence « nature-derived » vs v9.2 pour Mistral) | même vocabulaire ? même consignes ? la comparaison n'est équitable qu'à prompt constant |

Sans ces éléments, l'article ne peut nommer que des **familles** (Anthropic, OpenAI, Mistral) — ce qui est
déjà mieux que l'anonymat actuel, mais insuffisant pour un relecteur JURIX.

## 3. Comment enrichir sans dépasser 5 pages

Espace disponible : environ 8 lignes en bas de la page 5 (≈ 120 mots) ; Table 2 peut absorber 3 lignes
de plus sans changer de page. Tout le reste doit être compensé par des coupes (proposées en 3.5).

### 3.1 Nommer les juges (§3, *The layer*) — +2 lignes

Remplacer « and, separately, by four large language models prompted with the same vocabulary on the same
sentences » par une phrase qui nomme, dans l'ordre du tableau :

> *and, separately, by four large language models --- \textsc{Fable} (⟨modèle, version⟩), \textsc{Claude}
> (⟨…⟩), \textsc{Mistral} (⟨…⟩) and \textsc{Codex} (⟨…⟩) --- prompted once, in ⟨mois année⟩, with the same
> vocabulary on the same sentences, at temperature ⟨t⟩; their outputs were stored and never regenerated.*

Les crochets sont les cinq informations de la section 2. Garder les étiquettes internes en petites capitales
pour que Table 2 et le dépôt public parlent le même langage.

### 3.2 Table 2 : les quatre juges, T20 et T11 — +3 lignes, aucun texte en plus

```latex
\begin{tabular}{llcc}
\toprule
System & Setting & $\kappa$ (\Tn{20} / \Tn{11}) & Accuracy (\Tn{20} / \Tn{11}) \\
\midrule
Human annotators & leave-one-annotator-out & \textbf{0.859} / --- & 0.871 / --- \\
Legal-BERT, fine-tuned & 5-fold by document & 0.695 / 0.720 & --- \\
LLM judge \textsc{Fable} & stored labels & 0.581 / 0.591 & 0.601 / 0.629 \\
LLM judge \textsc{Claude} & stored labels & 0.515 / 0.531 & 0.539 / 0.576 \\
LLM judge \textsc{Mistral} & stored labels & 0.327 / 0.353 & 0.358 / 0.413 \\
LLM judge \textsc{Codex} & stored labels & 0.266 / 0.302 & 0.305 / 0.375 \\
\bottomrule
\end{tabular}
```

Légende à compléter d'une phrase : *« Judges are ordered by agreement; the ranking is identical under both
taxonomies. »* Le plafond humain n'est calculé qu'en T20 (le tiret l'indique honnêtement).

### 3.3 Un résultat rapporté de plus (§4, dernier paragraphe) — +4 lignes

Après « a fine-tuned Legal-BERT reaches 0.720 on T11 (Table 2) », ajouter :

> *The four judges span a wide range (κ 0.27–0.58) and their ranking is unchanged under \Tn{11}, where they
> gain only 0.01–0.04 against the 0.067 recovered by human annotators: consolidation helps the models far less
> than it helps the annotators. The two strongest judges are also nearly redundant (κ = 0.80 between them,
> above any human pair), so the benchmark contains three distinct behaviours rather than four.*

C'est la mise en avant demandée : elle donne au lecteur le classement, l'écart, la stabilité et une lecture
(les juges ne profitent pas de la consolidation, contrairement aux humains) sans rien démontrer de plus que ce
que les expériences E3.1/E3.3 établissent.

### 3.4 Limitations : rapporter la signature d'ancrage en une phrase — +2 lignes

Aujourd'hui la limite dit que l'exclusion de Fable laisse Claude à 0,515. Ajouter, juste avant :

> *Fable is also the only judge whose accuracy rises where the annotators split (0.607 on unanimous sentences,
> 0.636 on majority-decided ones, against 0.578 and 0.543 for Claude) --- the signature one would expect of
> anchoring rather than competence.*

Cela transforme la défense en mesure (remède R3 de l'audit, condensé) et rend la sensibilité qui suit plus
lisible. Le pré-annotateur n'étant pas tracé, la phrase reste au conditionnel (« one would expect »).

### 3.5 Coupes pour financer ces ajouts (≈ 11 lignes à trouver, ~4 disponibles)

| Coupe proposée | Gain | Justification |
|---|---|---|
| §2, phrase « Compact domain-specific encoders remain competitive… \cite{…} » : réduire à la seule citation groupée dans la phrase suivante | 2 lignes | l'idée est reprise en §5 avec les mêmes références |
| §4 *The effect of granularity*, dernière phrase (« What the result does not establish… ») : déplacer en une demi-phrase dans §5 | 2 lignes | doublon partiel avec la Discussion |
| §5, premier paragraphe : « (0.859 against 0.581) » devient « (Table 2) » ; supprimer « \cite{chalkidis2020legalbert,dominguezolmedo2025lawma} » déjà cités en §2 | 1 ligne | |
| §3 *Measurement*, « Finally, the human ceiling… \cite{nangia2019human} » : fusionner avec la phrase précédente | 1 ligne | |
| Table 2 : supprimer la colonne *Setting* (l'information passe dans la légende) | 0 ligne, mais évite un débordement de largeur avec les doubles colonnes | |

Si le budget reste serré, 3.4 est la première chose à sacrifier (elle est déjà couverte par la sensibilité) ;
3.1 et 3.2 sont non négociables : un article intitulé *LLM-as-a-judge* dans ses mots-clés doit nommer les juges.

### 3.6 Résumé et mots-clés

Le résumé peut rester tel quel ou remplacer « four large language models » par « four language-model judges
from three providers » : gain de précision sans coût. Ne pas y mettre de chiffres de juges (le résumé porte
déjà quatre résultats). Le champ EasyChair (`easychair-abstract.txt`) devra suivre le même changement.

## 4. Références à ajouter si les modèles sont nommés

Une référence par modèle (fiche technique ou rapport système du fournisseur, format `@misc` Vancouver avec
`note={{doi}: …}` ou URL et date de consultation). Rappel du piège BibTeX de ce projet : **jamais de `@` dans un
commentaire du `.bib`**. Ajouter ces entrées coûte des lignes en bibliographie, hors limite des 5 pages.

## 5. Ordre d'exécution

1. Les auteurs fournissent les cinq informations par juge (section 2). Si un élément est irrécupérable (par
   exemple la version exacte d'un modèle servi par une CLI), l'article le dit tel quel dans la phrase 3.1
   (« version as served by ⟨outil⟩ in ⟨mois⟩ ») : une incertitude déclarée vaut mieux qu'une précision inventée.
2. Édition des quatre passages (3.1–3.4) et des coupes (3.5) ; recompilation ; `tools/check_pages.sh` doit
   rester à 5 ; relecture de la Table 2 sur la page 4 (largeur).
3. Mise à jour de `easychair-abstract.txt` si le résumé change ; vérification `grep TODO`.
4. Consigner dans `docs/pactiva-jurix-short-paper/` la provenance des juges reçue des auteurs (elle manque
   au dépôt) et l'ajouter au `README` de `data/thematic-layer/` pour la ressource publiée.

## 6. Exécuté le 15 septembre : base de production et manuscrit

### 6.1 Ce que la base de production contient (interrogée via l'accès de déploiement)

- `imports.PreAnnotation` : 200 enregistrements = 4 juges × 50 documents, `schema_version = v9.2` pour tous ;
  charge utile `raw = {doc, judge, version, annotations, document_plan}` avec `version = v9.2-nature-derived`
  (Claude, Codex, Fable) ou `v9.2` (Mistral, sans champ `legal_nature`). Importés le **21–22 juin 2026** (Claude,
  Codex, Mistral) et le **2 août 2026** (Fable). Les justifications (`rationale`) sont rédigées en **français** :
  le prompt de pré-annotation était en français. **Aucun identifiant de modèle, aucun réglage, aucune date de
  génération** n'est stocké — ni dans la base, ni dans les fichiers, ni dans les dépôts de documentation.
- `lab.ExperimentRun` : runs `llm_judge` antérieurs (11–15 août) sur des datasets partiels ; **aucun** sur le
  dataset final `7116e627…` avant ce jour.

### 6.2 Huit runs lancés sur le dataset final (preset `llm-judges-baseline`, 5 plis par document, bootstrap 1 000 documents)

| Juge | κ T20 (écart-type inter-plis) | macro-F1 T20 [IC 95 %] | erreur T20 | κ T11 | macro-F1 T11 [IC 95 %] | erreur T11 | run T20 / T11 |
|---|---|---|---|---|---|---|---|
| Fable | 0,579 (0,047) | 0,403 [0,379 ; 0,406] | 39,9 % | 0,589 (0,040) | 0,367 [0,360 ; 0,375] | 37,1 % | `dc3c7fd7` / `b65cb576` |
| Claude | 0,519 (0,033) | 0,354 [0,329 ; 0,364] | 45,6 % | 0,536 (0,030) | 0,335 [0,320 ; 0,351] | 41,9 % | `1bac2776` / `ff976996` |
| Mistral | 0,330 (0,015) | 0,226 [0,199 ; 0,243] | 63,8 % | 0,354 (0,017) | 0,225 [0,204 ; 0,246] | 58,5 % | `bf30bb7b` / `6b7747f1` |
| Codex | 0,264 (0,039) | 0,186 [0,160 ; 0,192] | 69,6 % | 0,301 (0,042) | 0,193 [0,170 ; 0,202] | 62,5 % | `ad3034fd` / `d238f7c0` |

Lecture : les κ en 5 plis reproduisent à ±0,005 les κ globaux d'E3.3 utilisés dans la Table 2 (0,581 / 0,515 /
0,327 / 0,266) ; les IC de macro-F1 par document ne se recouvrent pas entre juges consécutifs, sauf Fable–Claude en T11
(recouvrement marginal) ; l'erreur sur les phrases abusives est plus élevée que l'erreur globale pour les quatre
juges (Fable 42,7 % vs 39,9 % en T20). Le « plafond humain » renvoyé par ces runs (0,468) est le taux d'accord
strict, pas le κ leave-one-annotator-out (0,859) : ne pas le citer.

### 6.3 Modifications appliquées au manuscrit (corps = 5 pages, 0 débordement, `latexmk` propre)

- §3 : « four large language models from three providers (Anthropic, OpenAI and Mistral AI; Table 2), prompted
  once … in June and August 2026; their outputs were stored and never regenerated ».
- Table 2 : quatre lignes de juges nommées, avec fournisseur et **`\todo{model id}`** à remplacer ; κ et exactitude
  en T20 et T11 ; légende complétée (classement identique sous les deux taxonomies).
- §4 : phrase de résultat rapporté (étendue 0,27–0,58, classement stable, gain T11 0,01–0,04 vs 0,067, redondance
  Fable–Claude κ 0,80).
- §5 Limitations : signature d'ancrage (0,607 / 0,636 vs 0,578 / 0,543) avant la sensibilité κ 0,515.
- Coupes : §1 (deux phrases), §2 (fusion encodeurs compacts, gap raccourci), §3 (plafond humain fusionné,
  « fraction … cannot converge »), §4 (phrase déplacée en §5, deux fusions), §5 (citations répétées), §6
  (conclusion et disponibilité resserrées).

**Reste bloquant** : les quatre identifiants de modèles (et, si connus, outil d'accès, température, mois de
génération par juge). Une fois fournis, remplacer les `\todo{model id}` dans `tables/systems.tex`, recompiler,
`tools/check_pages.sh`, `grep TODO`.

## 7. Provenance des modèles — résolue le 15 septembre (sources : `SAVE/annotations`, journaux des CLI)

| Juge | Modèle servi | Harnais | Dates 2026 | Niveau de preuve |
|---|---|---|---|---|
| Fable | **Claude Fable 5** (`claude-fable-5`) | Claude Code, sous-agents forcés `model: fable` | 1–2 août | transcription Claude Code (`dbeeafb4…`, 1 397 appels `claude-fable-5`) + runbook |
| Claude | **Claude Opus 4.7** | Claude Code (abonnement), session vierge par document | 29–31 mai | README de campagne + runbook v9.2 (« Opus uniquement ») ; transcriptions de mai purgées → **déclaré, non revérifié** |
| Mistral | **Mistral Medium 3.5** (`mistral-medium-3.5`) | Vibe CLI, température 1,0, thinking high | 21–22 juin | `~/.vibe/config.toml` + messages de session |
| Codex | **GPT-5.5** | Codex CLI 0.135.0 | 31 mai – 2 juin | journaux `~/.codex/sessions` (`turn_context.model = gpt-5.5`) |

Manuscrit : Table 2 porte désormais « Judge Fable (Claude Fable 5) », « Judge Claude (Claude Opus 4.7) »,
« Judge Mistral (Mistral Medium 3.5) », « Judge Codex (GPT-5.5) » ; §3 précise « each run through its vendor's
agent interface at default settings … between May and August 2026 » ; la disponibilité annonce les prompts.
Les prompts et runbooks v9.2 sont publiés dans `data/thematic-layer/prompts/` avec un README de provenance.
Pas de référence bibliographique ajoutée pour les modèles : aucune fiche technique vérifiée à la source n'est
disponible dans le dépôt, et une URL inventée serait pire qu'une absence.

Réserve à garder en tête pour un relecteur : le juge `claude` est le seul dont l'identifiant repose sur la
documentation de campagne et non sur un journal d'exécution.
