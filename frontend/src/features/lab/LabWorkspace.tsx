"use client";

/**
 * Espace de travail du Lab : datasets, runs, cible de calcul.
 *
 * Réservé aux rôles lead/reviewer (l'API le vérifie aussi) : un annotateur n'a rien à
 * faire ici, et surtout ne doit pas y découvrir un classement de ses pairs.
 */

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, Database, FlaskConical, Server } from "lucide-react";

import { Panel } from "@/components/ui/primitives";

import { ActiveRunIndicator } from "./ActiveRunIndicator";
import { DatasetBuilder } from "./DatasetBuilder";
import { ExperimentLauncher } from "./ExperimentLauncher";
import { RunList } from "./RunList";
import { ComputeSettings } from "./ComputeSettings";
import { ProgramsPanel } from "./ProgramsPanel";
import { listDatasets } from "./api";
import type { DatasetSummary } from "./types";

type Tab = "datasets" | "runs" | "programs" | "compute";

const TABS: Array<{ id: Tab; label: string; icon: typeof Database }> = [
  { id: "datasets", label: "Jeux de données", icon: Database },
  { id: "runs", label: "Expériences", icon: FlaskConical },
  { id: "programs", label: "Programmes", icon: BookOpen },
  { id: "compute", label: "Calcul", icon: Server },
];

export function LabWorkspace({ slug }: { slug: string }) {
  // `useSearchParams` exige un contexte Suspense — isolé dans un enfant pour ne pas
  // imposer un fallback de chargement à tout le Lab pour une simple lecture d'URL.
  return (
    <Suspense fallback={<div className="p-4 text-xs text-ink-muted">Chargement…</div>}>
      <LabWorkspaceInner slug={slug} />
    </Suspense>
  );
}

function LabWorkspaceInner({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "datasets";
  const initialMinAnnotators = searchParams.get("minAnnotators");
  const [tab, setTab] = useState<Tab>(
    TABS.some((t) => t.id === initialTab) ? initialTab : "datasets",
  );
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  // Force un remount (donc un refresh immédiat) de la liste des runs après un
  // lancement : sans ça, il faudrait attendre le sondage à 5 s de `RunList` pour voir
  // le nouveau run apparaître — un délai perceptible juste après avoir cliqué « Lancer ».
  const [runsRefreshKey, setRunsRefreshKey] = useState(0);
  // Preset pré-armé par l'action « Lancer » d'un programme — consommé par le lanceur.
  const [launcherPreset, setLauncherPreset] = useState<string | null>(null);

  useEffect(() => {
    listDatasets(slug)
      .then(setDatasets)
      .catch(() => setDatasets([]));
  }, [slug, tab]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4" data-testid="lab-workspace">
      <header>
        <h1 className="text-lg font-semibold text-ink">Lab</h1>
        <p className="text-xs text-ink-muted">
          Jeux de données figés, expériences reproductibles, exécution locale ou Grid&apos;5000.
        </p>
      </header>

      <nav className="flex items-center gap-1 border-b border-line" role="tablist">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={
                active
                  ? "flex items-center gap-1.5 border-b-2 border-accent px-3 py-2 text-xs font-medium text-ink"
                  : "flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-xs text-ink-muted hover:text-ink"
              }
              data-testid={`lab-tab-${item.id}`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {item.label}
            </button>
          );
        })}
        <ActiveRunIndicator slug={slug} />
      </nav>

      {tab === "datasets" && (
        <div className="space-y-4">
          <DatasetBuilder
            slug={slug}
            initialMinAnnotators={initialMinAnnotators ? Number(initialMinAnnotators) : undefined}
          />
          <Panel className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-ink">
              Jeux de données existants ({datasets.length})
            </h3>
            {datasets.length === 0 ? (
              <p className="text-xs text-ink-muted">
                Aucun jeu de données : construisez-en un ci-dessus pour lancer des expériences.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-ink-muted">
                      <th scope="col" className="py-1 text-left">Libellé</th>
                      <th scope="col" className="py-1 text-left">Maturité</th>
                      <th scope="col" className="py-1 text-right">Docs</th>
                      <th scope="col" className="py-1 text-right">Phrases</th>
                      <th scope="col" className="py-1 text-left">Empreinte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datasets.map((dataset) => (
                      <tr key={dataset.id} className="border-t border-line">
                        <td className="py-1 text-ink">{dataset.label || "—"}</td>
                        <td className="py-1 text-ink-muted">{dataset.maturity}</td>
                        <td className="py-1 text-right text-ink">{dataset.nDocuments}</td>
                        <td className="py-1 text-right text-ink">{dataset.nSentences}</td>
                        <td className="py-1 font-mono text-xs text-ink-muted">
                          {dataset.fingerprint.slice(0, 12)}…
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}

      {tab === "runs" && (
        <div className="space-y-4">
          <ExperimentLauncher
            slug={slug}
            onLaunched={() => setRunsRefreshKey((k) => k + 1)}
            initialPresetId={launcherPreset}
          />
          <RunList key={runsRefreshKey} slug={slug} />
        </div>
      )}
      {tab === "programs" && (
        <ProgramsPanel
          slug={slug}
          onLaunchPreset={(presetId) => {
            setLauncherPreset(presetId);
            setTab("runs");
          }}
        />
      )}
      {tab === "compute" && <ComputeSettings />}
    </div>
  );
}
