/**
 * Types de la campagne expérimentale — miroir exact des enveloppes produites par
 * `research/experiments/run_campaign.py`.
 *
 * Le fichier `campaign.json` est la SOURCE : aucun chiffre n'est saisi dans l'interface.
 * Chaque valeur affichée dans la vue « prêt pour l'article » remonte à l'expérience qui
 * l'a produite, à son dataset, à sa configuration et à la version du code.
 */

export type ExperimentStatus = "draft" | "stale" | "preliminary" | "validated" | "final";

export interface Gate {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
  /** Une porte bloquante en échec interdit le statut « validé ». */
  blocking: boolean;
}

export interface PaperMetric {
  key: string;
  label: string;
  value: number | string | null;
  ci: [number, number] | null;
  unit: string;
  note: string;
  higherIsBetter: boolean | null;
}

export interface ExperimentData {
  datasetFingerprint?: string;
  taxonomy?: string;
  labelSource?: string;
  populations?: string[];
  partitionId?: string;
}

export interface Provenance {
  codeVersion: string;
  codeClean: boolean;
  taxonomySpecVersion: number;
  taxonomySpecFingerprint: string;
  python: string;
  platform: string;
  executedAt: string;
}

export interface PaperExperiment {
  id: string;
  rq: string;
  title: string;
  question: string;
  hypothesis: string;
  protocol: string;
  summary: string;
  metricsDeclared: string[];
  limits: string[];
  dependsOn: string[];
  data: ExperimentData;
  config: Record<string, unknown>;
  metrics: PaperMetric[];
  results: Record<string, unknown>;
  uncertainty: string;
  interpretation: string;
  gates: Gate[];
  status: ExperimentStatus;
  artifacts: string[];
  provenance: Provenance;
}

export interface Campaign {
  campaignVersion: number;
  rqLabels: Record<string, string>;
  dataset: {
    fingerprint?: string;
    documents?: number;
    sentences?: number;
    annotations?: number;
  };
  goldState: Record<string, number>;
  experiments: PaperExperiment[];
}

export const STATUS_META: Record<
  ExperimentStatus,
  { label: string; hint: string; cls: string }
> = {
  final: {
    label: "Final",
    hint: "Validé et gelé pour publication.",
    cls: "border-success/50 bg-success/10 text-success",
  },
  validated: {
    label: "Validé",
    hint: "Toutes les conditions de validité sont réunies : citable dans l'article.",
    cls: "border-success/40 bg-success/10 text-success",
  },
  preliminary: {
    label: "Préliminaire",
    hint: "Le calcul est bon, mais une condition de publication manque encore.",
    cls: "border-warning/40 bg-warning/10 text-warning",
  },
  stale: {
    label: "Périmé",
    hint: "Calculé sur un instantané qui n'est plus celui du corpus final.",
    cls: "border-danger/40 bg-danger/10 text-danger",
  },
  draft: {
    label: "Brouillon",
    hint: "Ne rien en tirer.",
    cls: "border-line bg-panel-muted text-ink-muted",
  },
};

/** Un résultat est-il citable tel quel dans l'article ? */
export function isPaperReady(experiment: PaperExperiment): boolean {
  return experiment.status === "validated" || experiment.status === "final";
}
