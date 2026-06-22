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
5. appliquer les pré-résolutions :
   - override anti-refuge (majorité précise + 1 refuge) → impose le précis (C2), trace override
   - cluster → multi-label (couple ∈ clusters) → garder les deux (C3)
   - refuge jamais en secondaire
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
  // — majorité 2/3 —
  if (hasMajority(counts)) {
    const maj = majorityLabel(counts), dis = dissidentLabel(counts);
    if (R.refuges.includes(dis))                       // override anti-refuge
      return mono('C2','confirm', maj, boundary,
        explainOverride(maj, dis), {kind:'refuge_to_precis', from: dis, to: maj});
    if (isCluster(maj, dis, R))                         // cluster → multi
      return multi('C3','validate_set', primaryOf([maj,dis],counts,R), boundary,
        explainCluster(maj, dis, R));
    return mono('C4','verify', maj, boundary, explainMajority(maj, dis));
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
- `hard` si 3/3 **ou** déclencheur structurel (numérotation/titre — heuristique lexicale).
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
