"use client";

/**
 * « Nouvelle expérience » — le maillon qui manquait entre un jeu de données construit et
 * un run lancé. Jusqu'ici, la seule façon d'aller de l'un à l'autre était `manage.py shell`
 * ou `curl` : le catalogue de presets (`pipeline-presets.yaml`) était entièrement écrit
 * mais jamais lu par aucun code.
 *
 * Deux modes sur le MÊME objet, comme prévu par `03_UX_UI.md` §3.3 : le mode guidé pose
 * `{...preset.config, datasetId}` ; le mode expert édite le JSON obtenu — jamais deux
 * chemins de construction différents.
 *
 * Flux en trois temps, parce que le modèle de données sépare Experiment (config figée,
 * réutilisable) de Run (une exécution) : créer l'expérience → l'estimer (durée, GPU,
 * nombre de runs si sweep) → lancer. Créer une expérience ne coûte rien à exécuter ; ce
 * n'est que l'étape « lancer » qui engage un calcul.
 */

import { useEffect, useMemo, useState } from "react";
import { FlaskConical, Loader2, Rocket, TriangleAlert } from "lucide-react";

import { Button, Panel } from "@/components/ui/primitives";
import { ApiError } from "@/lib/api/client";

import {
  createExperiment,
  estimateExperiment,
  launchExperiment,
  listDatasets,
  listPresets,
} from "./api";
import type { DatasetSummary, EstimateResponse, ExperimentSummary, Preset, PresetCatalog } from "./types";

type Mode = "guided" | "expert";

function apiErrorDetail(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as { detail?: string; path?: string } | undefined;
    if (body?.detail) return body.path ? `${body.path} : ${body.detail}` : body.detail;
  }
  return error instanceof Error ? error.message : "erreur inconnue";
}

function baseConfig(preset: Preset | null, datasetId: string): Record<string, unknown> {
  const config: Record<string, unknown> = preset
    ? { ...preset.config }
    : {
        task: "T1_primary",
        preprocess: { detokenize: "regex_rules" },
        model: { family: "tfidf_linear" },
        evaluation: { split: { scheme: "group_kfold_document", k: 5 }, humanCeiling: true },
      };
  return { version: 1, seed: 42, ...config, datasetId };
}

export function ExperimentLauncher({ slug, onLaunched }: { slug: string; onLaunched: () => void }) {
  const [open, setOpen] = useState(false);
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [catalog, setCatalog] = useState<PresetCatalog | null>(null);
  const [mode, setMode] = useState<Mode>("guided");
  const [datasetId, setDatasetId] = useState("");
  const [presetId, setPresetId] = useState("");
  const [name, setName] = useState("");
  const [configText, setConfigText] = useState("");
  const [experiment, setExperiment] = useState<ExperimentSummary | null>(null);
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [launchedRunIds, setLaunchedRunIds] = useState<string[] | null>(null);

  useEffect(() => {
    if (!open) return;
    listDatasets(slug).then((rows) => {
      setDatasets(rows);
      if (!datasetId && rows[0]) setDatasetId(rows[0].id);
    });
    listPresets(slug).then(setCatalog);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slug]);

  const orderedPresets = useMemo(() => {
    if (!catalog) return [];
    const order = catalog.recommendedOrder;
    return [...catalog.presets].sort((a, b) => {
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [catalog]);

  const selectedPreset = orderedPresets.find((p) => p.id === presetId) ?? null;

  // Le mode guidé régénère le JSON à chaque changement de preset/dataset ; le mode
  // expert le laisse éditable tel quel — passer de l'un à l'autre ne perd jamais l'état,
  // conformément au principe « les deux modes éditent le même objet » du plan UX.
  useEffect(() => {
    if (mode === "guided" && datasetId) {
      setConfigText(JSON.stringify(baseConfig(selectedPreset, datasetId), null, 2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, presetId, datasetId]);

  const reset = () => {
    setExperiment(null);
    setEstimate(null);
    setLaunchedRunIds(null);
    setError(null);
    setName("");
    setPresetId("");
  };

  const onCreate = async () => {
    setError(null);
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(configText);
    } catch {
      setError("JSON invalide — vérifier la syntaxe avant de créer l'expérience.");
      return;
    }
    if (!datasetId) {
      setError("choisir un jeu de données");
      return;
    }
    setBusy(true);
    try {
      const created = await createExperiment(slug, {
        name: name || selectedPreset?.label || "expérience sans nom",
        task: String(config.task ?? "T1_primary"),
        dataset: datasetId,
        config,
      });
      setExperiment(created);
      const est = await estimateExperiment(slug, created.id);
      setEstimate(est);
    } catch (err) {
      setError(apiErrorDetail(err));
    } finally {
      setBusy(false);
    }
  };

  const onLaunch = async () => {
    if (!experiment) return;
    setBusy(true);
    setError(null);
    try {
      const result = await launchExperiment(slug, experiment.id);
      setLaunchedRunIds(result.runIds);
      if (result.runIds.length === 0 && result.duplicates.length > 0) {
        setError(
          "ces runs ont déjà été exécutés à l'identique — voir la liste des expériences",
        );
      }
      onLaunched();
    } catch (err) {
      setError(apiErrorDetail(err));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button
        icon={<FlaskConical size={14} aria-hidden />}
        onClick={() => setOpen(true)}
        data-testid="experiment-launcher-open"
      >
        Nouvelle expérience
      </Button>
    );
  }

  return (
    <Panel className="space-y-4 p-4" data-testid="experiment-launcher">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Nouvelle expérience</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false);
            reset();
          }}
        >
          Fermer
        </Button>
      </div>

      <label className="block text-xs">
        <span className="text-ink-muted">Jeu de données</span>
        <select
          className="mt-1 w-full rounded border border-line bg-panel-muted px-2 py-1 text-ink"
          value={datasetId}
          onChange={(e) => setDatasetId(e.target.value)}
          disabled={Boolean(experiment)}
          data-testid="experiment-dataset-select"
        >
          {datasets.length === 0 && <option value="">aucun jeu de données construit</option>}
          {datasets.map((dataset) => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.label || dataset.fingerprint.slice(0, 12)} · {dataset.nDocuments} docs
              · {dataset.nSentences} phrases
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs">
        <span className="text-ink-muted">Nom de l&apos;expérience</span>
        <input
          type="text"
          className="mt-1 w-full rounded border border-line bg-panel-muted px-2 py-1 text-ink"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={selectedPreset?.label ?? "ex. legal-bert baseline"}
          disabled={Boolean(experiment)}
        />
      </label>

      <div className="flex gap-1 border-b border-line" role="tablist">
        {(["guided", "expert"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            disabled={Boolean(experiment)}
            className={
              mode === m
                ? "border-b-2 border-accent px-3 py-1.5 text-xs font-medium text-ink"
                : "border-b-2 border-transparent px-3 py-1.5 text-xs text-ink-muted hover:text-ink"
            }
            data-testid={`experiment-mode-${m}`}
          >
            {m === "guided" ? "Mode guidé" : "Mode expert"}
          </button>
        ))}
      </div>

      {mode === "guided" && !experiment && (
        <div className="space-y-1.5" data-testid="preset-list">
          {orderedPresets.length === 0 && (
            <p className="text-xs text-ink-muted">
              Aucun preset disponible côté serveur — passer en mode expert.
            </p>
          )}
          {orderedPresets.map((preset) => (
            <label
              key={preset.id}
              className={
                presetId === preset.id
                  ? "flex items-start gap-2 rounded border border-accent bg-accent/5 p-2 text-xs"
                  : "flex items-start gap-2 rounded border border-line p-2 text-xs hover:border-accent/40"
              }
            >
              <input
                type="radio"
                name="preset"
                className="mt-0.5"
                checked={presetId === preset.id}
                onChange={() => setPresetId(preset.id)}
                data-testid={`preset-${preset.id}`}
              />
              <span>
                <span className="font-medium text-ink">{preset.label}</span>
                {preset.durationHint && (
                  <span className="ml-2 text-[10px] text-ink-muted">{preset.durationHint}</span>
                )}
                {preset.why && <span className="block text-[10px] text-ink-muted">{preset.why}</span>}
              </span>
            </label>
          ))}
        </div>
      )}

      {mode === "expert" && !experiment && (
        <label className="block text-xs">
          <span className="text-ink-muted">Configuration (JSON)</span>
          <textarea
            className="mt-1 h-64 w-full rounded border border-line bg-panel-muted p-2 font-mono text-[11px] text-ink"
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
            spellCheck={false}
            data-testid="experiment-config-json"
          />
        </label>
      )}

      {!experiment && (
        <Button
          icon={<FlaskConical size={14} aria-hidden />}
          loading={busy}
          disabled={!datasetId}
          onClick={onCreate}
          data-testid="experiment-create"
        >
          Créer et estimer
        </Button>
      )}

      {experiment && estimate && !launchedRunIds && (
        <div className="space-y-3 rounded border border-line p-3" data-testid="experiment-estimate">
          <p className="text-xs text-ink">
            <strong>{estimate.nRuns}</strong> run{estimate.nRuns > 1 ? "s" : ""} ·{" "}
            <strong>~{estimate.estimatedMinutes} min</strong>
            {estimate.requiresGpu && (
              <span className="ml-2 inline-flex items-center gap-1 text-warning">
                <TriangleAlert className="h-3 w-3" aria-hidden /> GPU requis
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <Button
              icon={<Rocket size={14} aria-hidden />}
              loading={busy}
              onClick={onLaunch}
              data-testid="experiment-launch"
            >
              Lancer
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      {launchedRunIds && launchedRunIds.length > 0 && (
        <p className="text-xs text-success" data-testid="experiment-launched">
          {launchedRunIds.length} run{launchedRunIds.length > 1 ? "s" : ""} en file — visible
          {launchedRunIds.length > 1 ? "s" : ""} dans la liste ci-dessous.
        </p>
      )}

      {busy && !experiment && (
        <p className="flex items-center gap-1.5 text-[11px] text-ink-muted">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> en cours…
        </p>
      )}
      {error && (
        <p className="text-[11px] text-danger" data-testid="experiment-error" role="alert">
          {error}
        </p>
      )}
    </Panel>
  );
}
