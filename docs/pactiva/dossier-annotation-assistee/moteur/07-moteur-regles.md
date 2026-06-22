# Moteur de triage — routage, override, primaire, frontière, explication

Le moteur est une **fonction pure** : `(themeVotes, boundaryVotes, RULES) → TriageResult`.
Aucune dépendance réseau/DOM. La spec `07-regles-routage.yaml` en est l'**unique source**
(générée en `rules.generated.ts` pour le front et `rules.py` pour le back ; parité testée).

## 1. Étapes du moteur (déterministe, ordonné)
```
1. normaliser les votes via theme_aliases (codes protocole → codes scheme app)
2. compter l'accord thème : unanime 3/3 | majorité 2/3 | éclaté 1/1/1
3. compter l'accord frontière (is_block_start) : support = nb de true ; type = hard si 3/3
   (ou trigger numérotation/titre) sinon soft si majorité
4. router (arbre §1 du protocole) → level, action, labelMode
5. appliquer les pré-résolutions, dans CET ordre (priorité substantielle, ordre-indépendant) :
   - **cluster → multi-label** (un dissident ∈ couple de cluster avec la majorité, tous deux
     non-refuges) → garder les deux (C3). **Le cluster PRIME sur l'override** (testé sur tous
     les dissidents, pas seulement celui de tête → correct en K≥4).
   - **majorité-refuge → C5** : si la majorité est elle-même un refuge (κ très bas), ce n'est
     pas une majorité fiable à « vérifier » → arbitrage (jamais un refuge primaire « verify »).
   - **override anti-refuge** : majorité PRÉCISE et **tous** les dissidents sont des refuges →
     impose le précis (C2), trace override réversible.
   - sinon → C4 (vérifier le minoritaire). **refuge jamais en secondaire** ; refuge primaire
     autorisé seulement en C1/C2 unanime.
6. choisir le primaire : préséance → majorité → priorité
7. construire l'explication {context, decision, logic} à partir de la branche empruntée
8. renvoyer TriageResult
```

## 2. Pseudo-code (référence d'implémentation)
```ts
function triageEngine(themeVotes, boundaryVotes, R): TriageResult {
  const themes = mapValues(themeVotes, t => R.themeAliases[t] ?? t);
  const counts = tally(themes);                       // {theme: n}
  const bSupport = countTrue(boundaryVotes);
  const bType = (bSupport === total(boundaryVotes) || hasStructuralTrigger()) ? 'hard' : 'soft';
  const boundary = { type: bType, support: bSupport };

  // — thème unanime 3/3 —
  if (isUnanimous(counts)) {
    const lvl = bType === 'hard' ? 'C1' : 'C2';
    return mono(lvl, lvl==='C1'?'batch_accept':'confirm', sole(counts), boundary,
      explainUnanimous(themes, lvl, boundary));
  }
  // — majorité stricte (>moitié) — ordre : cluster > refuge-majorité > override > C4 —
  if (hasMajority(counts)) {
    const maj = majorityLabel(counts);
    const nonMaj = ranked.filter(x => x.label !== maj);
    const partner = nonMaj.find(x => !isRefuge(maj) && !isRefuge(x.label) && isCluster(maj, x.label, R));
    if (partner)                                        // cluster (tous dissidents) → multi
      return multi('C3','validate_set', primaryOf([maj, partner.label], counts, R), boundary, ...);
    if (isRefuge(maj))                                  // majorité = refuge → arbitrage
      return open('C5','arbitrate', candidates, boundary, ...);
    if (nonMaj.length && nonMaj.every(x => isRefuge(x.label)))  // tous dissidents refuges
      return mono('C2','confirm', maj, boundary, ..., {kind:'refuge_to_precis', from: dissidentTop, to: maj});
    return mono('C4','verify', maj, boundary, ...);     // dissident précis non-clusterisé
  }
  // — éclaté 1/1/1 —
  const clusterPair = firstClusterPair(themes, R);      // un couple présent, sans refuge
  if (clusterPair) return multi('C3','validate_set', primaryOf(clusterPair,counts,R), boundary,
        explainCluster(...clusterPair, R));
  return open('C5','arbitrate', candidates(themes), boundary, explainArbitrate(themes));
}
```

## 3. Choix du primaire (`primaryOf`)
1. **préséance** (`RULES.precedence`) : si le couple a une direction, le primaire est imposé
   (ex. `LICENSE_IP > ACCEPTABLE_USE`).
2. sinon **majorité de votes** (le plus voté est primaire).
3. sinon **liste de priorité** (`RULES.priority`, refuges en queue).
Le secondaire = l'autre membre du cluster. **Jamais** un refuge en secondaire.

## 4. Frontière dure/molle
- `support` = nb de juges avec `is_block_start = true`.
- `hard` si 3/3 **ou** déclencheur structurel. ⚠️ Le moteur **pur** n'a pas le texte : la
  promotion 2/3→dure par numérotation/titre est fournie par la couche appelante via
  `opts.structuralHardTrigger` (défaut faux) — détection lexicale en amont, hors moteur.
- `soft` si majorité (2/3) d'origine thématique → la carte propose **Fusionner / Scinder**.
- Un glissement de sujet intra-clause **ne crée pas** de frontière → multi-label.

## 5. Explication déterministe (le « pourquoi »)
La carte affiche trois lignes, **dérivées de la branche** :
- **Contexte** : les votes des K juges (`claude:ACCEPTABLE_USE · codex:ACCEPTABLE_USE · mistral:LICENSE_IP`).
- **Décision** : le set recommandé + frontière (`multi : LICENSE_IP (primaire) + ACCEPTABLE_USE (secondaire) · frontière dure 3/3`).
- **Logique** : la règle qui s'applique, avec sa justification mesurée
  (`couple de cluster → chevauchement réel ; primaire par préséance LICENSE_IP>ACCEPTABLE_USE`)
  ou (`override anti-refuge : MISC est le thème le moins fiable, κ=0,27`).
Gabarits dans `07-regles-routage.yaml > explanations`. Aucun appel LLM ; tout est traçable.

## 6. Garde-fous intégrés
- **< 2 juges** : le moteur renvoie `level=null` → la carte est masquée (annotation manuelle).
- **Code inconnu** : `theme_aliases` le route vers un code fermé ; sinon on l'écarte (jamais `OTHER_*`).
- **Versionnement** : `RULES.version` est inscrit dans l'`audit[]` de chaque clause → on sait
  quelle version de règles a produit la suggestion (re-triage possible).

## 7. Parité front/back
Un jeu d'**items de référence** (un par niveau + cas limites : override, cluster sans
majorité, éclaté avec cluster, frontière molle) sert de **golden set** : `triageEngine` (TS)
et `triage.py` (Python) doivent produire **le même** `level`+`proposal` (test de parité).
