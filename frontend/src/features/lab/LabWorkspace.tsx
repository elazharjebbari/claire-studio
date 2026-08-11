"use client";

/**
 * Espace de travail du Lab : datasets, runs, cible de calcul.
 *
 * Réservé aux rôles lead/reviewer (l'API le vérifie aussi) : un annotateur n'a rien à
 * faire ici, et surtout ne doit pas y découvrir un classement de ses pairs.
 */

import { useEffect, useState } from "react";
import { Database, FlaskConical, Server } from "lucide-react";

import { Panel } from "@/components/ui/primitives";

import { DatasetBuilder } from "./DatasetBuilder";
import { RunList } from "./RunList";
import { ComputeSettings } from "./ComputeSettings";
import { listDatasets } from "./api";
import type { DatasetSummary } from "./types";

type Tab = "datasets" | "runs" | "compute";

const TABS: Array<{ id: Tab; label: string; icon: typeof Database }> = [
  { id: "datasets", label: "Jeux de données", icon: Database },
  { id: "runs", label: "Expériences", icon: FlaskConical },
  { id: "compute", label: "Calcul", icon: Server },
];

export function LabWorkspace({ slug }: { slug: string }) {
  const [tab, setTab] = useState<Tab>("datasets");
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);

  useEffect(() => {
    listDatasets(slug)
      .then(setDatasets)
      .catch(() => setDatasets([]));
  }, [slug, tab]);

  return (
    <div className="space-y-4 p-4" data-testid="lab-workspace">
      <header>
        <h1 className="text-lg font-semibold text-ink">Lab</h1>
        <p className="text-xs text-ink-muted">
          Jeux de données figés, expériences reproductibles, exécution locale ou Grid&apos;5000.
        </p>
      </header>

      <nav className="flex gap-1 border-b border-line" role="tablist">
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
      </nav>

      {tab === "datasets" && (
        <div className="space-y-4">
          <DatasetBuilder slug={slug} />
          <Panel className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-ink">
              Jeux de données existants ({datasets.length})
            </h3>
            {datasets.length === 0 ? (
              <p className="text-xs text-ink-muted">
                Aucun jeu de données : construisez-en un ci-dessus pour lancer des expériences.
              </p>
            ) : (
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
                      <td className="py-1 font-mono text-[10px] text-ink-muted">
                        {dataset.fingerprint.slice(0, 12)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      )}

      {tab === "runs" && <RunList slug={slug} />}
      {tab === "compute" && <ComputeSettings />}
    </div>
  );
}
