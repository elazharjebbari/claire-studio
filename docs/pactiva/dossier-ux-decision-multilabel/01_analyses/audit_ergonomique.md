# Audit ergonomique — UI actuelle (triage C1–C5 & multi-label)

> Périmètre : ergonomie, lisibilité et charge cognitive de l'atelier d'annotation **tel
> qu'il est aujourd'hui** (TocPanel, document, SuggestionCard, inspecteur). On part des faits
> observés dans l'app, pas d'un état cible. Le cadre cible (3 canaux orthogonaux) vit dans
> `02_conception/` ; ici on documente seulement les frictions et leurs pistes.

## 1. Méthode

Audit heuristique (Nielsen + critères Bastien & Scapin) appliqué aux quatre surfaces réelles :
le **plan** (TocPanel / ClauseChip), le **document** (clause-badge, en-tête, piste de
validation, overlay Cx, rail d'actions rapides), la **SuggestionCard** (popover de
recommandation) et l'**inspecteur** (palette, nature, certitude, comparateur). Chaque friction
est qualifiée par sa **fréquence** (à chaque clause / par session / occasionnelle) et sa
**gravité** (cosmétique / gêne / bloquant pour la qualité des données).

## 2. Constat d'ensemble

L'app sait déjà *stocker* les trois informations clés — le niveau de triage (`triageLevel`),
la provenance (`seededFrom` / `resolvedFrom` / saisie humaine) et le multi-label
(`ClauseTheme` : 1 primaire + N secondaires). **Le déficit est strictement côté affichage et
geste** : ces données existantes ne sont pas (ou mal) rendues là où l'annotateur travaille.
Trois symptômes dominants :

1. **La couleur est surchargée.** Un même registre chromatique (vert/ambre) sert à la fois pour
   l'état de validation, pour les niveaux, et se télescope avec les teintes de thème. L'œil ne
   sait pas quel canal il regarde.
2. **L'information est cantonnée à un seul endroit.** La provenance n'existe que dans l'en-tête
   de clause ; le multi-label n'existe que dans le backend. Le plan et la piste de validation,
   eux, restent muets.
3. **Les actions de haut niveau (C3 multi-label, C4/C5 arbitrage) n'ont pas d'affordance
   dédiée.** Le niveau est affiché (overlay opt-in) mais ne dit pas *quoi faire*.

## 3. Frictions par surface

### 3.1 Plan — TocPanel / ClauseChip

| # | Problème (fait observé) | Impact | Piste |
|---|---|---|---|
| P1 | Le ClauseChip ne porte que `✓`/`◷` (validé / à valider) ; **aucune distinction du type de validation** (pré-annotation, moteur, manuel). | L'annotateur ne sait pas, depuis le plan, ce qui a été *adopté d'un LLM* vs *décidé à la main* — la confiance dans une clause « validée » est plate. Le reviewer ne peut pas cibler les clauses seedées sans les ouvrir une à une. | Marque de provenance ★/⚡/✎ sur le chip (forme=qui, couleur=état), alignée sur l'en-tête de clause. |
| P2 | **Aucun indicateur multi-label** : une clause à 1 thème et une clause à 1 primaire + 3 secondaires ont le même chip. | Le multi-label est invisible à l'échelle du document. Impossible de repérer les clauses « riches » ou de vérifier la couverture des secondaires sans ouvrir chaque clause. | Pastille `＋N` sur le ClauseChip (N = nb de secondaires). |
| P3 | Le chip est **teinté par thème uniquement** ; la teinte de thème (faible opacité) cohabite mal avec les glyphes d'état au même endroit. | Risque de collision visuelle (teinte de thème proche du vert/ambre d'état). Lecture ambiguë sur petits chips. | Séparer les emplacements : teinte de thème = fond du chip ; provenance/état = glyphe distinct ; multi-label = pastille `＋N` en coin. |

### 3.2 Document — clause-badge, en-tête, piste, overlay, rail

| # | Problème (fait observé) | Impact | Piste |
|---|---|---|---|
| P4 | La **provenance n'est lisible que dans l'en-tête** de clause (resolvedFrom « ✓ Juge » vert, seededFrom « ◷ Juge » ambre, humain « ✎ moi » ardoise). La piste de validation à gauche (barre w-1, ✓/◷) ne porte, elle, que l'état. | Pour savoir *qui a validé*, il faut regarder l'en-tête ; pour l'état, la piste. Deux endroits, deux grammaires, pour une même clause. Charge de lecture doublée sur un geste répété des centaines de fois. | Unifier piste + chip + en-tête sur le même trio ★/⚡/✎ (forme=provenance stable, couleur=état). |
| P5 | Trois conventions de glyphes **coexistent** : `✓`/`◷` (état), `✓ Juge`/`◷ Juge`/`✎ moi` (en-tête). La même coche `✓` veut dire « validé » à un endroit et « resolvedFrom » à un autre. | Ambiguïté de signe (même symbole, deux sens) — violation directe de la cohérence. L'annotateur doit ré-apprendre le code selon la zone. | Source unique : `✓` réservé au primaire multi-label ; provenance via ★/⚡/✎ ; état via couleur. |
| P6 | **L'overlay de niveau Cx est opt-in** : par défaut le niveau de triage n'est pas visible sur la clause. | Le signal le plus décisionnel (difficulté/accord) est masqué par défaut. L'annotateur travaille « à l'aveugle » sur la priorité, sauf à activer l'overlay. | Rendre le niveau discrètement persistant au moins pour C4/C5 (priorité d'attention), overlay détaillé en option. |
| P7 | Le **rail d'actions rapides** propose « valider + suivant » et un bouton recommandation Cx → popover. Mais la **validation C3 ne donne pas de feedback d'état multi-label** : rien n'indique, après le geste, qu'un set primaire+secondaire a bien été posé, ni ne permet de l'annuler d'un geste. | Le multi-label posé via C3 est « invisible une fois fait » : pas de confirmation < 200 ms, pas de toggle de réversion immédiat. Risque de re-cliquer / de douter / de poser deux fois. | Toggle 🏷 réversible + feedback bleu clair immédiat au moment du set ; le toggle EST l'annulation. |

### 3.3 SuggestionCard (popover de recommandation)

| # | Problème (fait observé) | Impact | Piste |
|---|---|---|---|
| P8 | La carte affiche déjà chip primaire plein « ✓ THEME » + secondaire contour « ◻ THEME », frontière ▮/┄, explication, et un éventail d'actions (Accepter/Confirmer/Valider + Permuter/Retirer 2ⁿᵈ/Choisir/Annuler override). **L'éventail d'actions est large et les libellés se recouvrent** (Accepter vs Confirmer vs Valider). | Surcharge de choix (loi de Hick) au moment où il faut décider vite. La distinction Accepter/Confirmer/Valider n'est pas évidente ; le geste « par défaut » n'est pas saillant. | Hiérarchiser : une action primaire claire selon le niveau (1-clic en C1/C2, set+toggle en C3, décision explicite en C4/C5) ; actions secondaires repliées. |
| P9 | La carte est **bien dotée en multi-label** mais elle est le **seul** endroit où le set primaire/secondaire est explicite ; dès qu'on ferme le popover, cette richesse ne se retrouve ni dans le document, ni dans le plan. | Le multi-label vit dans un état éphémère (popover) au lieu d'un état persistant et lisible. Discontinuité entre décision et trace. | Propager le rendu primaire/secondaire (plein/pointillé, `＋N`) du popover vers document + plan. |
| P10 | La carte n'**explicite pas la règle Cx appliquée** au moment de valider (le code Cx est affiché, mais pas « validé via le triage — règle Cx »). | L'action reste implicite : l'annotateur valide sans nommer ce qu'il fait, ce qui nuit à la traçabilité perçue et à la formation des débutants. | Nommer la règle au geste (tooltip/microcopie) — principe « 1 action nommée ». |

### 3.4 Inspecteur

| # | Problème (fait observé) | Impact | Piste |
|---|---|---|---|
| P11 | L'inspecteur expose palette de thèmes, nature, certitude 0–3, Valider, evidence/rationale, comparateur par juge — mais **aucune affordance « + thème secondaire »** ni toggle multi-label hors d'un cas C3. | Le multi-label est *de facto* réservé aux conflits structurés (C3) ; un annotateur qui VEUT ajouter un secondaire sur une clause non conflictuelle n'a pas de porte d'entrée. Le backend le permet, l'UI non. | Affordance « + thème secondaire » dans la zone Thèmes + toggle 🏷 en tête de zone (cf. principe « deux portes d'entrée »). |
| P12 | La **certitude 0–3** et le **niveau Cx** sont deux échelles distinctes présentées sans lien explicite ; rien ne dit que le triage_level ≠ certitude. | Confusion de modèles mentaux : l'annotateur peut croire que C3 = « peu sûr » alors que C3 = cas qualitatif (multi-label, neutre). Mauvaise priorisation. | Clarifier visuellement que C3 est *qualitatif* (couleur violette hors gradient) et non un « moins bon » niveau ; séparer certitude et niveau. |
| P13 | Le **comparateur par juge** montre les positions divergentes, mais l'inspecteur ne **différencie pas visuellement les 3 provenances** (pré-annot / moteur / manuel) dans sa zone d'état. | L'inspecteur, qui est l'endroit de la décision fine, n'aide pas à voir d'où vient l'état courant — incohérent avec l'en-tête de clause. | Reprendre le trio ★/⚡/✎ dans la zone d'état de l'inspecteur. |

## 4. Frictions transverses (synthèse)

| Thème | Problème | Impact global | Piste directrice |
|---|---|---|---|
| **3 types de validation indistincts** | Pré-annotation, moteur et manuel partagent ✓/◷ ; seul l'en-tête les sépare, avec une 3ᵉ grammaire. | Confiance « plate » dans une clause validée ; reviewer aveugle à l'origine ; ré-apprentissage du code par zone. | Canal **Provenance = forme** (★/⚡/✎), couleur = état, **partout** (piste + chip + en-tête + inspecteur). |
| **Multi-label invisible dans le plan** | Le backend gère 1 primaire + N secondaires ; aucune surface ne le montre hors du popover. | Impossible de jauger la couverture multi-label à l'échelle du document ; vérification clause par clause. | Canal **Multi-label** : chip plein vs pointillé `+`, pastille `＋N` sur le ClauseChip. |
| **Provenance cantonnée à l'en-tête** | L'info la plus utile pour la confiance n'est qu'à un seul endroit, dans une 3ᵉ convention. | Lecture redondante (piste pour l'état, en-tête pour l'origine) ; charge cognitive sur un geste ultra-répété. | Unifier les emplacements sous la même source de vérité visuelle. |
| **Pas de toggle ni de feedback à la validation C3** | Le set multi-label se pose sans confirmation < 200 ms ni annulation immédiate. | Doute post-action, risque de double-pose, friction sur le cas le plus fréquent du corpus conflictuel. | Toggle 🏷 réversible + feedback bleu clair instantané. |
| **C1–C5 sans action claire** | Le niveau est affiché (overlay opt-in, badge) mais ne porte pas d'affordance d'action adaptée. | L'annotateur voit la difficulté mais pas le geste attendu ; tout passe par le même flux quel que soit le niveau. | Action **adaptative** : 1-clic ⚡ en C1/C2 ; set+toggle en C3 ; décision manuelle ✎ obligatoire et alerte ❗ en C4/C5. |

## 5. Quick wins vs chantiers

- **Quick wins (faible coût, fort retour)** : pastille `＋N` sur le ClauseChip (P2) ;
  unification des glyphes de provenance entre piste et en-tête (P4/P5) ; nommage de la règle Cx
  au moment de valider (P10).
- **Chantiers (refonte de surface)** : toggle 🏷 réversible + feedback C3 dans le document
  (P7) ; affordance « + thème secondaire » dans l'inspecteur (P11) ; hiérarchisation des
  actions de la SuggestionCard (P8).

> Les pistes ci-dessus sont des **directions**, pas des specs : les composants cibles,
> états et gestes sont définis dans `02_conception/` et `03_specifications/`.
