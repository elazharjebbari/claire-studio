/** Types de l'API du Lab — miroir de `claire/lab/serializers.py`. */

export type Maturity = "any" | "complete" | "submitted" | "gold";
export type Aggregation = "single" | "consensus" | "soft";
export type LabTask = "T1_primary" | "T2_multilabel" | "T3_boundary";

export type RunStatus =
  | "queued"
  | "waiting"
  | "running"
  | "succeeded"
  | "partial"
  | "failed"
  | "cancelled";

export interface ExcludedRow {
  document: string | null;
  annotator: string | null;
  reason: string;
  detail: string;
}

export interface PreflightReport {
  criteria: { maturity: Maturity; scope: Record<string, unknown>; k: number };
  nAnnotations: number;
  nDocuments: number;
  nSentences: number;
  documentsByAnnotatorCount: Record<string, number>;
  nMultiAnnotated: number;
  nTripleAnnotated: number;
  coverage: Record<string, string[]>;
  nearComplete: Array<{ document: string; annotator: string; completeness: number }>;
  labelDistribution: Record<string, { primary: number; secondary: number; total: number }>;
  rareThemes: string[];
  excluded: ExcludedRow[];
  excludedSummary: Record<string, number>;
  warnings: Array<{ code: string; message: string }>;
  splitsPreview: { scheme: string; k: number; feasible: boolean };
  wouldFingerprint: string;
}

export interface DatasetSummary {
  id: string;
  label: string;
  maturity: Maturity;
  aggregation: Aggregation;
  status: "building" | "ready" | "failed";
  fingerprint: string;
  nDocuments: number;
  nSentences: number;
  nAnnotations: number;
  createdAt: string;
}

export type ComputeTargetKind = "local" | "g5k";

export interface RunSummary {
  id: string;
  /** Identifiant de l'expérience parente — regroupement des runs d'un sweep. */
  experiment: string;
  experimentName: string;
  /** Preset d'origine de l'expérience (vide pour une expérience libre) — LA clé de
   * routage des vues de résultats ad-hoc (docs/pactiva-lab-resultats/04 §1). */
  preset: string;
  task: LabTask;
  status: RunStatus;
  progress: number;
  phase: string;
  macroF1: number | null;
  errorCode: string;
  createdAt: string;
  completedAt: string | null;
  /** Cible RÉELLEMENT utilisée par le worker (`run.config.compute.target`) — jamais
   * déduite d'ailleurs, voir `ExperimentRunSummarySerializer.get_compute_target`. */
  computeTarget: ComputeTargetKind;
  /** Site Grid'5000 déclaré dans la config (`compute.g5k.site`) — absent si non précisé
   * ou si la cible est locale. */
  computeSite: string | null;
  /** `null` tant que le worker n'a pas pris le run en charge (encore `queued`). */
  startedAt: string | null;
  /** Rafraîchi à CHAQUE cycle de sondage du worker, y compris pendant une attente
   * Grid'5000 — voir `runStatus.isStaleHeartbeat`. `null` avant la première prise en
   * charge. */
  heartbeatAt: string | null;
  /** `true` dès qu'un `POST .../cancel` a été accepté, AVANT que `status` ne bascule
   * réellement sur `cancelled` (l'annulation d'un job distant n'est pas instantanée). */
  cancelRequested: boolean;
}

export interface MetricCi {
  point?: number | null;
  low: number | null;
  high: number | null;
  nResamples?: number;
  confidence?: number;
  unit?: string;
  warning?: string;
}

export interface FoldStats {
  mean: number | null;
  std: number | null;
  min: number | null;
  max: number | null;
  n: number;
}

export interface AgreementClassStats {
  n: number;
  errors: number;
  rate: number | null;
}

export interface RunDetail extends RunSummary {
  config: Record<string, unknown>;
  // Ce sous-objet vient tel quel du `results.json` de `pactiva_lab` (snake_case,
  // Python idiomatique — le package ignore tout de Django) puis traverse le
  // middleware de camélisation DRF avant d'atteindre le front : chaque clé
  // ressort donc en camelCase, y compris à l'intérieur de ce JSONField générique.
  metrics: {
    task?: string;
    metrics?: Record<string, number | null | Record<string, unknown>> & {
      macroF1Ci?: MetricCi;
      foldStats?: Record<string, FoldStats>;
    };
    perFold?: Array<Record<string, number>>;
    perLabel?: Array<{
      label: string;
      f1: number;
      support: number;
      precision?: number;
      recall?: number;
    }>;
    humanCeiling?: {
      value: number | null;
      metric?: string;
      note?: string;
      pairs?: number;
      ci?: MetricCi;
    };
    errors?: Record<string, unknown> & {
      nErrors?: number;
      errorRate?: number;
      unfairErrorRate?: number | null;
      unfairSentences?: number;
      byAgreementClass?: Record<string, AgreementClassStats>;
      topConfusions?: Array<{ true: string; pred: string; count: number }>;
      lowestConfidenceErrors?: Array<Record<string, unknown>>;
    };
    dataset?: { fingerprint?: string; nDocuments?: number; nSentences?: number };
    environment?: Record<string, unknown>;
    preprocess?: string;
  };
  environment: Record<string, unknown>;
  externalJobId: string;
  errorDetail: string;
  attempt: number;
}

export type PaperId = "long" | "court";
export type PresetStage = "reference" | "criblage" | "confirmation" | "ablation";

export interface Preset {
  id: string;
  label: string;
  why?: string;
  durationHint?: string;
  note?: string;
  /** Bloc thématique (registre `themes` du catalogue) — classification décidée dans
   * docs/pactiva-lab/05_BLOCS_ET_PROGRAMMES.md. */
  theme?: string;
  /** Papiers servis par ce preset ([] = aucun papier central). */
  papers?: PaperId[];
  /** Étage du protocole : référence / criblage / confirmation / ablation. */
  stage?: PresetStage;
  config: Record<string, unknown>;
  sweep?: { mode: string; maxRuns?: number; axes?: Record<string, unknown[]> };
}

export interface PresetTheme {
  id: string;
  label: string;
  description?: string;
}

export interface PresetCatalog {
  presets: Preset[];
  recommendedOrder: string[];
  /** Registre ORDONNÉ des blocs thématiques du mode guidé. */
  themes: PresetTheme[];
}

/** Avancement d'un preset, DÉRIVÉ des runs réels (jamais un état stocké). */
export interface PresetStatus {
  nRuns: number;
  byStatus: Record<string, number>;
  lastRunAt: string | null;
  /** Expérience la plus récente pour ce preset×dataset — porte le lien résultats. */
  experimentId: string | null;
  validated: boolean;
}

export interface ProgramItem {
  preset: string;
  role: string;
}

export interface ExperimentProgram {
  id: string;
  label: string;
  paper: PaperId;
  goal: string;
  items: ProgramItem[];
}

export interface ProgramsResponse {
  programs: ExperimentProgram[];
  dataset: string | null;
  presetStatus: Record<string, PresetStatus>;
}

export interface ExperimentSummary {
  id: string;
  name: string;
  task: LabTask;
  dataset: string;
  datasetFingerprint: string;
  config: Record<string, unknown>;
  createdAt: string;
}

export interface EstimateResponse {
  nRuns: number;
  estimatedMinutes: number;
  requiresGpu: boolean;
}

export interface LaunchResponse {
  runIds: string[];
  duplicates: string[];
}

export interface ComputeCredential {
  id: number;
  kind: string;
  login: string;
  /** Jamais les secrets : seulement le fait qu'ils existent. Deux secrets DISTINCTS —
   * le mot de passe authentifie l'API, la clé SSH authentifie le transfert de fichiers
   * (Grid'5000 désactive l'authentification par mot de passe en SSH). */
  hasPassword: boolean;
  hasSshKey: boolean;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
  /** `null` = aucune clé SSH enregistrée (pas testable), distinct d'un test échoué. */
  lastTestSshOk: boolean | null;
  lastTestDetail: string;
}

export interface GpuCluster {
  site: string;
  cluster: string;
  node: string | null;
  gpuModel: string;
  gpuVramGb: number;
  gpuCount: number;
}

export interface GpuClusterCatalog {
  /** `true` si l'utilisateur a un mot de passe API enregistré — distingue « catalogue
   * informatif » de « prêt à réserver ». Le catalogue reste visible dans les deux cas. */
  configured: boolean;
  clusters: GpuCluster[];
}

export interface Blocker {
  code: string;
  message: string;
  severity: "high" | "medium";
}

export interface CampaignReadiness {
  documentsTotal: number;
  documentsAnnotated: number;
  documentsMultiAnnotatedSubmitted: number;
  documentsMultiAnnotatedComplete: number;
  documentsTripleAnnotated: number;
  documentsWithGold: number;
  completeButNotSubmitted: Array<{
    documentId: number;
    actorKey: string;
    validated: number;
    nSentences: number;
  }>;
  targets: { multiAnnotated: number; tripleAnnotated: number; goldFinalized: number };
  blockers: Blocker[];
}
