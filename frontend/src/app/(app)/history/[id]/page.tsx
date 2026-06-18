"use client";

/**
 * Historique & versions (F3) — timeline des AnnotationVersion + vue diff réelle
 * entre deux versions choisies (clauses ajoutées / supprimées / modifiées par
 * anchor_index et thème). CONTRACT §3 : /annotations/{id}/versions(/{n}/diff).
 */

import { useEffect, useMemo, useState } from "react";
import { useVersions, useVersionDiff } from "@/lib/api/hooks";
import { Panel, Button } from "@/components/ui/primitives";
import { DiffView } from "@/components/history/DiffView";
import { cn } from "@/lib/cn";

export default function HistoryPage({ params }: { params: { id: string } }) {
  const { data } = useVersions(params.id);
  const versions = useMemo(
    () => (data?.results ?? []).slice().sort((a, b) => a.number - b.number),
    [data],
  );

  // Sélection de deux versions à comparer (base → cible).
  const [fromNumber, setFromNumber] = useState<number | null>(null);
  const [toNumber, setToNumber] = useState<number | null>(null);

  // Par défaut : comparer la dernière version à la précédente.
  useEffect(() => {
    if (versions.length >= 2 && toNumber === null) {
      const last = versions[versions.length - 1]!;
      const prev = versions[versions.length - 2]!;
      setToNumber(last.number);
      setFromNumber(prev.number);
    } else if (versions.length === 1 && toNumber === null) {
      setToNumber(versions[0]!.number);
      setFromNumber(0);
    }
  }, [versions, toNumber]);

  const { data: diff, isLoading: diffLoading } = useVersionDiff(
    params.id,
    toNumber ?? undefined,
    fromNumber ?? undefined,
  );

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-6 py-8 lg:grid-cols-[260px_1fr]">
      {/* Timeline */}
      <div>
        <h1 className="mb-4 text-xl font-semibold text-ink">Historique des versions</h1>
        <ol className="relative ml-4 border-l border-line">
          {versions.map((v) => {
            const isFrom = v.number === fromNumber;
            const isTo = v.number === toNumber;
            return (
              <li key={v.id} className="mb-4 ml-4" data-testid="version-item">
                <span
                  className={cn(
                    "absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full",
                    isTo ? "bg-accent" : isFrom ? "bg-amber-400" : "bg-line",
                  )}
                />
                <Panel
                  className={cn(
                    "p-3 transition-colors",
                    (isFrom || isTo) && "border-accent/60",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink">
                      v{v.number}
                      {v.label ? ` · ${v.label}` : ""}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {new Date(v.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted">
                    {v.snapshot.clauses.length} clause(s) · certitude{" "}
                    {v.snapshot.global_certainty} · {v.authorId}
                  </p>
                  <div className="mt-2 flex gap-1">
                    <Button
                      variant={isFrom ? "primary" : "subtle"}
                      className="px-2 py-0.5 text-[11px]"
                      data-testid={`select-from-${v.number}`}
                      onClick={() => setFromNumber(v.number)}
                    >
                      Base
                    </Button>
                    <Button
                      variant={isTo ? "primary" : "subtle"}
                      className="px-2 py-0.5 text-[11px]"
                      data-testid={`select-to-${v.number}`}
                      onClick={() => setToNumber(v.number)}
                    >
                      Cible
                    </Button>
                  </div>
                </Panel>
              </li>
            );
          })}
          {versions.length === 0 && (
            <li className="ml-4 text-sm text-ink-muted">Aucune version enregistrée.</li>
          )}
        </ol>
      </div>

      {/* Diff */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-ink">Différences</h2>
        <Panel className="p-4">
          {diffLoading && <p className="text-sm text-ink-muted">Calcul du diff…</p>}
          {!diffLoading && diff && <DiffView diff={diff} />}
          {!diffLoading && !diff && (
            <p className="text-sm text-ink-muted">
              Sélectionnez une version de base et une cible dans la timeline.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
