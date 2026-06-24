/**
 * Moteur de scoring GOLD (PUR, miroir EXACT du backend `claire/projects/gold_scoring.py`).
 *
 * Décide, PAR PHRASE, le gold à partir des votes : électorat PONDÉRÉ où les annotateurs
 * pèsent PLUS que les LLM. La parité TS/PY est verrouillée par un golden partagé
 * (cf. dossier docs/pactiva/dossier-gold-tech/02-scoring-engine.md, ADR-003).
 *
 * - Les ANNOTATEURS font autorité ; les LLM aident selon `llmRole`.
 * - Décision humaine ≠ consensus LLM (`humanDissent`) = SIGNAL FORT → jamais d'auto.
 * - Classification strict / majority / divergence (sur les annotateurs).
 * - Niveaux d'auto : auto_1click (accord absolu) / auto (peu risqué) / manual.
 */

export const ANNOTATOR_WEIGHT_DEFAULT = 3.0;
export const LLM_WEIGHT_DEFAULT = 1.0;
export const LOW_CONFIDENCE = 0.34;
export const SECONDARY_MIN_ANNOTATORS = 2;
export const LLM_UNANIMOUS_MIN = 3;
export const MAJORITY_RATIO = 2 / 3;

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
  llmWeight: number;
  llmRole: LlmRole;
  perAnnotator: Record<string, number>;
  perLlm: Record<string, number>;
  secondaryMinAnnotators: number;
  reliability: Record<string, number>;
}

export interface GoldScore {
  primary: string | null;
  secondaries: string[];
  agreementClass: AgreementClass;
  confidence: number;
  riskBand: RiskBand;
  humanDissent: boolean;
  humanBlock: string | null;
  llmBlock: string | null;
  autoLevel: AutoLevel;
  tally: Record<string, number>;
}

export function defaultConfig(): ScoringConfig {
  return {
    annotatorWeight: ANNOTATOR_WEIGHT_DEFAULT,
    llmWeight: LLM_WEIGHT_DEFAULT,
    llmRole: "tiebreak",
    perAnnotator: {},
    perLlm: {},
    secondaryMinAnnotators: SECONDARY_MIN_ANNOTATORS,
    reliability: {},
  };
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function weightOf(v: Vote, cfg: ScoringConfig): number {
  if (v.isLlm) return cfg.perLlm[v.voterId] ?? cfg.llmWeight;
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
  const validRoles: LlmRole[] = ["ignore", "tiebreak", "signal", "full"];
  const role: LlmRole = validRoles.includes(cfg.llmRole) ? cfg.llmRole : "tiebreak";

  const norm = (v: Vote): Vote => ({ ...v, secondaries: v.secondaries ?? [] });
  const all = votes.map(norm);
  const humans = all.filter((v) => !v.isLlm);
  const llms = all.filter((v) => v.isLlm);
  const coveringHumans = humans.filter((v) => v.primary !== null);
  const coveringLlms = llms.filter((v) => v.primary !== null);

  const humanTally = tally(humans, cfg);
  const llmTally = tally(llms, cfg);
  const humanBlock = argmax(humanTally);
  const llmBlock = argmax(llmTally);

  // ── Électorat de décision selon le rôle des LLM ──
  let decision: Record<string, number>;
  if (role === "full") {
    decision = { ...humanTally };
    for (const [k, w] of Object.entries(llmTally)) decision[k] = (decision[k] ?? 0) + w;
  } else if (role === "tiebreak") {
    decision = { ...humanTally };
    const vals = Object.values(humanTally);
    if (vals.length > 0) {
      const top = Math.max(...vals);
      const tied = Object.keys(humanTally).filter((k) => humanTally[k] === top);
      if (tied.length > 1) for (const k of tied) decision[k] = (decision[k] ?? 0) + (llmTally[k] ?? 0);
    }
  } else {
    decision = { ...humanTally }; // ignore | signal
  }
  if (Object.keys(decision).length === 0 && role !== "ignore" && Object.keys(llmTally).length > 0) {
    decision = { ...llmTally };
  }

  const primary = argmax(decision);

  // ── Confiance = soutien pondéré du primaire sur l'électorat de confiance ──
  // Humains toujours ; LLM sauf rôle 'ignore' (un renfort LLM concordant remonte la confiance).
  const supportVotes = coveringHumans.concat(role === "ignore" ? [] : coveringLlms);
  const supportTotal = supportVotes.reduce((acc, v) => acc + weightOf(v, cfg), 0);
  const supportTop = supportVotes
    .filter((v) => v.primary === primary)
    .reduce((acc, v) => acc + weightOf(v, cfg), 0);
  const support = supportTotal > 0 ? supportTop / supportTotal : 0;
  const reliability = primary ? cfg.reliability[primary] ?? 1.0 : 0;
  const confidence = Math.round(clamp01(support) * reliability * 10000) / 10000;

  // ── Signal fort ──
  const humanDissent = humanBlock !== null && llmBlock !== null && humanBlock !== llmBlock;

  // ── Classification (sur les annotateurs) ──
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

  // ── Bande de risque ──
  let riskBand: RiskBand;
  if (agreementClass === "divergence" || humanDissent || confidence < LOW_CONFIDENCE) riskBand = "high";
  else if (agreementClass === "strict" && !humanDissent) riskBand = "low";
  else riskBand = "medium";

  // ── Niveau d'auto-résolution ──
  const secondariesIdentical =
    coveringHumans.length > 0 && new Set(coveringHumans.map(secKey)).size === 1;
  const llmUnanimous =
    coveringLlms.length >= LLM_UNANIMOUS_MIN && new Set(coveringLlms.map((v) => v.primary)).size === 1;
  const ratio = coveringHumans.length
    ? coveringHumans.filter((v) => v.primary === humanBlock).length / coveringHumans.length
    : 0;
  let autoLevel: AutoLevel;
  if (humanDissent) autoLevel = "manual";
  else if (agreementClass === "strict" && secondariesIdentical) autoLevel = "auto_1click";
  else if (ratio >= MAJORITY_RATIO - 1e-9 && llmUnanimous && llmBlock === humanBlock) autoLevel = "auto";
  else autoLevel = "manual";

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
