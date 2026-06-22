# Architecture cible

Système d'annotation assistée = **un moteur de règles pur** (piloté par une spec YAML
unique) branché sur l'**infra N-way existante**, exposé par **deux surfaces UX** (File de
triage + carte de suggestion inline), persistant des **clauses multi-label** auditables.

## 1. Vue d'ensemble (couches)
```
┌────────────────────────────────────────── FRONTEND (Next.js) ──────────────────────────────────────────┐
│  Surfaces UX                                                                                             │
│   • TriageQueue (mode file, clavier-first)         • SuggestionCard (inline: SentenceMenu/Inspector)     │
│        │                          │                          │                                          │
│        └──────────────┬───────────┴──────────────────────────┘                                         │
│                       ▼                                                                                  │
│  Moteur de triage (PUR, TS)  src/lib/triage/                                                             │
│   triageEngine(votes, boundaryVotes, rules) → { level C1..C5, proposal{labels[],boundary}, explanation } │
│        ▲ consomme                                   ▲ règles                                            │
│        │  preByJudge · agreementNway · runs         │  RULES (constante générée depuis le YAML)         │
│  Données réactives (déjà là) : useLlmAgreement, runs.ts, llmAgreement.ts, llmJudges.ts                  │
│        │ écrit via                                                                                       │
│        ▼  store/workspace (DraftClause.themes[], boundary, triageLevel) + autosave                       │
└──────────────────────────────────────────────┬──────────────────────────────────────────────────────────┘
                                                │ API camelCase (React Query)
┌───────────────────────────────────────────── BACKEND (Django/DRF) ─────────────────────────────────────┐
│  Annotations API : add_clause · clauses:batch (NEW) · validate-set · set-boundary · swap-primary         │
│  Modèle : Annotation · Clause (+ boundary_type/support, triage_level) · ClauseTheme (NEW, role)          │
│  Service triage (miroir Python, batch/oracle)  ──lit──▶  RULES (même YAML)                               │
│  Consolidation oracle (clauses multi-label) · audit[] · provenance(votes K juges)                        │
│  Mesure : α MASI / κ par thème / Pk-WindowDiff (iaa_multilabel)                                          │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                       ▲
            RULES source unique : moteur/07-regles-routage.yaml  (refuges, clusters, préséance, priorité, aliases)
            → build:rules génère  frontend/src/lib/triage/rules.generated.ts  ET  backend .../triage/rules.py
```

## 2. Composants (responsabilités)
### Moteur (pur, partagé via spec)
- **`triageEngine`** (TS, `src/lib/triage/engine.ts`) : fonction **pure**
  `(themeVotes: Record<judge,string>, boundaryVotes: Record<judge,boolean>, rules) →
  TriageResult`. Aucune dépendance React/DOM ⇒ testable au µs.
- **`TriageResult`** : `{ level: 'C1'|…|'C5', action, labelMode: mono|multi|open,
  labels: {label, role, support}[], candidates: string[], boundary: {type, support},
  override?: {kind:'refuge_to_precis', from, to}, explanation: Explanation }`.
- **`Explanation`** (déterministe) : `{ context: VotesView, decision: string, logic: RuleTrace }`
  → alimente directement la carte (« pourquoi ce cas »).
- **Règles** : `RULES` (généré du YAML) = `{ refuges[], clusters[][], precedence{}, priority[], themeAliases{} }`.

### Surfaces UX
- **`TriageQueue`** (`src/components/workspace/triage/TriageQueue.tsx`) : file ordonnée
  par niveau, navigation clavier, gestes par niveau (lot, 1 clic, valider set, arbitrer).
- **`SuggestionCard`** (`src/components/workspace/triage/SuggestionCard.tsx`) : carte
  compacte montée dans `SentenceMenu` (par phrase), `BoundaryEvidence` (frontière) et
  `InspectorPanel` (clause sélectionnée). Affiche niveau + explication + CTA Accepter +
  affordances (permuter, retirer 2nd, choisir autre, scinder/fusionner).
- **`MultiThemePalette`** (extension de `NaturePicker`) : sélection multi (primaire/secondaires).

### Store
- `DraftClause` : `theme:string` → `themes: ThemeTag[]` (1 primary + N secondary),
  `boundary: {type, support}`, `triageLevel?`. Actions : `batchAccept(range)`,
  `validateSet(localId)`, `swapPrimary(localId, label)`, `removeSecondary(localId, label)`,
  `setBoundaryType(localId, type)`, `acceptSuggestion(localId)`, `undoOverride(localId)`.

### Backend
- `ClauseTheme` (enfant), `Clause.boundary_type/boundary_support/triage_level`.
- Endpoints : `POST …/clauses:batch` (lot C1), `PATCH /clauses/{id}` étendu (themes[],
  boundary), `validate-set`. Service `triage/` (miroir) + consolidation oracle + audit.

## 3. Principes d'architecture
1. **Une seule source de règles** (YAML) → générée pour les deux runtimes ⇒ pas de
   divergence ; un changement de règle = nouvelle version + ré-exécution (cf. protocole §9).
2. **Moteur pur** ⇒ tests exhaustifs sans DOM ni réseau (les 5 niveaux, overrides,
   préséance, clusters) ; **parité** front/back testée sur le même corpus d'items.
3. **Réactivité** : le triage est recalculé **côté client** depuis `preByJudge` quand la
   version/juges changent → UX instantanée, zéro round-trip.
4. **Rétro-compatibilité** : mono = `themes=[{primary}]` ; les écrans existants
   fonctionnent ; migration de données triviale.
5. **Traçabilité native** : `provenance` (votes) + `audit[]` (overrides, validation) sur
   chaque clause ; tout override réversible.
6. **Dégradation gracieuse** : < 2 juges ⇒ pas de triage (carte masquée), l'annotation
   manuelle reste disponible.

## 4. Flux nominal (résumé ; séquence détaillée en `04-sequence-triage.puml`)
1. Pré-annotations K juges (≥2) chargées (`preByJudge`).
2. Le moteur calcule, par phrase, `TriageResult` (niveau + proposition + explication).
3. **File de triage** : l'annotateur traite par niveau (lot C1 ; 1 clic C2/C4 ; set C3 ;
   arbitrage C5) ; ou édite **inline** via la carte.
4. Chaque validation écrit la clause multi-label (themes[], boundary, triage_level, audit)
   via l'API (batch pour C1).
5. Consolidation oracle + mesure α MASI/κ/Pk (back) ; suivi des métriques.

## 5. Interfaces clés (signatures)
```ts
// src/lib/triage/engine.ts
export function triageEngine(
  themeVotes: Record<string, string>,          // {claude:'ACCEPTABLE_USE', codex:'ACCEPTABLE_USE', mistral:'LICENSE_IP'}
  boundaryVotes: Record<string, boolean>,      // {claude:true, codex:true, mistral:true}
  rules: Rules,
): TriageResult;

export interface TriageResult {
  level: 'C1'|'C2'|'C3'|'C4'|'C5';
  action: 'batch_accept'|'confirm'|'validate_set'|'verify'|'arbitrate';
  labelMode: 'mono'|'multi'|'open';
  labels: { label: string; role: 'primary'|'secondary'; support: number }[];
  candidates: string[];
  boundary: { type: 'hard'|'soft'; support: number };
  override?: { kind: 'refuge_to_precis'; from: string; to: string };
  explanation: { context: string; decision: string; logic: string };
}
```
