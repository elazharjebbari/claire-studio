/**
 * Moteur de scoring GOLD (PUR, miroir EXACT du backend `claire/projects/gold_scoring.py`).
 *
 * Résolution PUREMENT inter-annotateurs : les conflits ne sont JAMAIS « annotateur vs LLM ».
 * Les LLM ne sont PAS parties au conflit — ils n'entrent ni dans la décision, ni dans la
 * classe d'accord, ni dans le risque, ni dans l'auto-résolution. Ils sont seulement exposés
 * (`llmBlock`) à titre de RÉFÉRENCE indicative. Parité TS/PY via golden partagé.
 */

export const ANNOTATOR_WEIGHT_DEFAULT = 1.0;
export const SECONDARY_MIN_ANNOTATORS = 2;
export const MAJORITY_RATIO = 2 / 3;

/** Conservé pour la config de campagne (les LLM y restent une RÉFÉRENCE, pas un votant). */
export type LlmRole = "ignore" | "tiebreak" | "signal" | "full";
export type AgreementClass = "strict" | "majority" | "divergence" | "empty";
export type RiskBand = "low" | "medium" | "high";
export type AutoLevel = "auto_1click" | "auto" | "manual";

export interface Vote {
  voterId: string;
  primary: string | null; // null = phrase non couverte par cette source
  secondaries?: string[];
  isLlm?: boolean;
}

export interface ScoringConfig {
  annotatorWeight: number;
  perAnnotator: Record<string, number>;
  secondaryMinAnnotators: number;
  reliability: Record<string, number>;
}

export interface GoldScore {
  primary: string | null;
  secondaries: string[];
  agreementClass: AgreementClass;
  confidence: number;
  riskBand: RiskBand;
  humanDissent: boolean; // DÉPRÉCIÉ : toujours false (les LLM ne créent jamais de conflit)
  humanBlock: string | null;
  llmBlock: string | null; // référence indicative (n'entre pas dans la décision)
  autoLevel: AutoLevel;
  tally: Record<string, number>;
}

export function defaultConfig(): ScoringConfig {
  return {
    annotatorWeight: ANNOTATOR_WEIGHT_DEFAULT,
    perAnnotator: {},
    secondaryMinAnnotators: SECONDARY_MIN_ANNOTATORS,
    reliability: {},
  };
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function weightOf(v: Vote, cfg: ScoringConfig): number {
  if (v.isLlm) return 1.0; // référence indicative uniquement (consensus llmBlock)
  return cfg.perAnnotator[v.voterId] ?? cfg.annotatorWeight;
}

function tally(votes: Vote[], cfg: ScoringConfig): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of votes) {
    if (v.primary === null || v.primary === undefined) continue;
    out[v.primary] = (out[v.primary] ?? 0) + weightOf(v, cfg);
  }
  return out;
}

/** Argmax avec départage LEXICOGRAPHIQUE (parité exacte avec le backend). */
function argmax(t: Record<string, number>): string | null {
  let best: string | null = null;
  let bestW = -Infinity;
  for (const k of Object.keys(t).sort()) {
    const w = t[k] ?? 0;
    if (w > bestW) {
      bestW = w;
      best = k;
    }
  }
  return best;
}

const sum = (t: Record<string, number>) => Object.values(t).reduce((a, b) => a + b, 0);

export function scoreSentence(votes: Vote[], config?: Partial<ScoringConfig>): GoldScore {
  const cfg: ScoringConfig = { ...defaultConfig(), ...(config ?? {}) };
  const norm = (v: Vote): Vote => ({ ...v, secondaries: v.secondaries ?? [] });
  const all = votes.map(norm);
  const humans = all.filter((v) => !v.isLlm);
  const llms = all.filter((v) => v.isLlm);
  const coveringHumans = humans.filter((v) => v.primary !== null);

  const humanTally = tally(humans, cfg);
  const llmTally = tally(llms, cfg);
  const humanBlock = argmax(humanTally);
  const llmBlock = argmax(llmTally); // référence indicative seulement

  // ── Électorat de décision = ANNOTATEURS uniquement ──
  const decision = { ...humanTally };
  const primary = argmax(decision);

  // ── Confiance = soutien pondéré des ANNOTATEURS pour le primaire ──
  const supportTotal = coveringHumans.reduce((acc, v) => acc + weightOf(v, cfg), 0);
  const supportTop = coveringHumans
    .filter((v) => v.primary === primary)
    .reduce((acc, v) => acc + weightOf(v, cfg), 0);
  const support = supportTotal > 0 ? supportTop / supportTotal : 0;
  const reliability = primary ? cfg.reliability[primary] ?? 1.0 : 0;
  const confidence = Math.round(clamp01(support) * reliability * 10000) / 10000;

  // ── Classification (annotateurs seuls) ──
  let agreementClass: AgreementClass;
  const secKey = (v: Vote) => [...new Set(v.secondaries ?? [])].sort().join("");
  if (coveringHumans.length === 0) {
    agreementClass = "empty";
  } else {
    const primaries = new Set(coveringHumans.map((v) => v.primary));
    const secSets = new Set(coveringHumans.map(secKey));
    if (primaries.size === 1 && secSets.size === 1) {
      agreementClass = "strict";
    } else {
      const humanTotal = sum(humanTally);
      if (humanBlock !== null && (humanTally[humanBlock] ?? 0) > humanTotal / 2) agreementClass = "majority";
      else agreementClass = "divergence";
    }
  }

  // ── Secondaires (≥ N annotateurs, hors primaire) ──
  const secCounts: Record<string, number> = {};
  for (const v of coveringHumans) {
    for (const s of new Set(v.secondaries ?? [])) if (s !== primary) secCounts[s] = (secCounts[s] ?? 0) + 1;
  }
  const secondaries = Object.keys(secCounts)
    .filter((s) => (secCounts[s] ?? 0) >= cfg.secondaryMinAnnotators)
    .sort();

  // ── Bande de risque (accord entre annotateurs uniquement) ──
  const riskBand: RiskBand =
    agreementClass === "divergence" ? "high" : agreementClass === "strict" ? "low" : "medium";

  // ── Auto-résolution (annotateurs seuls — aucun critère LLM) ──
  const secondariesIdentical =
    coveringHumans.length > 0 && new Set(coveringHumans.map(secKey)).size === 1;
  const ratio = coveringHumans.length
    ? coveringHumans.filter((v) => v.primary === humanBlock).length / coveringHumans.length
    : 0;
  let autoLevel: AutoLevel;
  if (agreementClass === "strict" && secondariesIdentical) autoLevel = "auto_1click";
  else if (agreementClass === "majority" && ratio >= MAJORITY_RATIO - 1e-9) autoLevel = "auto";
  else autoLevel = "manual";

  const humanDissent = false; // déprécié : les LLM ne créent jamais de conflit

  return {
    primary,
    secondaries,
    agreementClass,
    confidence,
    riskBand,
    humanDissent,
    humanBlock,
    llmBlock,
    autoLevel,
    tally: decision,
  };
}
