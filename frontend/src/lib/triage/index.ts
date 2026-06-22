/** Moteur de triage (protocole confiance graduée + multi-label). Point d'entrée. */
export { triageEngine } from "./engine";
export { RULES } from "./rules";
export type {
  TriageResult,
  TriageLevel,
  HumanAction,
  LabelMode,
  DisagreementType,
  ProposedLabel,
  ProposedBoundary,
  TriageOverride,
  TriageExplanation,
  Rules,
  ThemeVotes,
  BoundaryVotes,
} from "./types";
