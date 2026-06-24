# Schéma de config de campagne (`Project.settings.resolution{}`, typé/versionné)

```ts
interface ResolutionConfigV1 {
  v: number;
  llm: { role: 'ignore'|'tiebreak'|'signal'|'full'; weight: number; perJudge: Record<string,{role?,weight?}> }; // ids LIBRES
  annotatorWeights: Record<string, number>;   // userId -> poids (défaut 1)
  signalBonus: number;                          // décision humaine != LLM
  autoResolve: { absoluteAgreement: boolean; lowRiskLevels: ('C1'|'C2'|'C3'|'C4'|'C5')[]; manualLevels: (...)[] };
  arbiters: number[];                           // userIds (défaut leads+reviewers)
  visualizers: number[] | 'all_annotators';
  autoShare: boolean;                           // partage auto des arbitrages (défaut true, révocable)
  secondaryPolicy: 'optional'|'required'|'advisory';
  configChanges: { at: string; by: number; patch: object }[]; // traçabilité sans table
}
```

`mergeResolutionConfig(DEFAULTS, raw)` + `migrateResolutionConfig(raw)` calqués 1:1 sur
`mergeUiPrefs`/`migratePrefs` (whitelist par section, énumérations bornées, maps libres). Validé
serveur (poids∈[0,1], seuils cohérents, role∈enum, userIds ∈ memberships). Append auto à
`configChanges`. Gel via `Project.locked` (lecture seule + bandeau).

## Preset par défaut — « CONFIANCE AUX ANNOTATEURS »
`llm.role='tiebreak'`, `llm.weight=0.5`, `annotatorWeights={}` (tous=1), `signalBonus` actif,
`autoResolve.absoluteAgreement=true`, `lowRiskLevels=['C1','C2']`, `manualLevels=['C3','C4','C5']`,
`arbiters = memberships role∈{lead,reviewer}`, `autoShare=true`, `secondaryPolicy='advisory'`.

## TOUS les paramètres configurables (énumérés)
1. Prise en compte des LLM (role) + quand/comment + poids global + poids par juge.
2. Poids par annotateur. 3. signalBonus (humain≠LLM). 4. Accord absolu = 1 clic (on/off).
5. Niveaux auto vs manuels (C1–C5). 6. Qui peut **arbitrer** vs **visualiser**.
7. Partage auto des arbitrages (révocable). 8. Politique des secondaires (optional/required/advisory).
9. TTL du verrou d'arbitrage / inactivité. 10. Gel de campagne (verrou projet).
