"use client";

/**
 * « Prêt pour la science » — l'écran qui remplace les requêtes SQL manuelles.
 *
 * Son rôle est de dire **ce qui bloque**, pas de féliciter : chaque ligne rouge ou orange
 * est actionnable, et le bandeau du haut met en avant le gain récupérable sans annoter
 * une phrase de plus.
 */

import { AlertTriangle, CheckCircle2, CircleAlert, Inbox } from "lucide-react";

import { Panel } from "@/components/ui/primitives";

import type { CampaignReadiness } from "./types";
import { buildLines, isArticleBlocked, recoverableWork, sortBlockers } from "./readiness";

const LEVEL_ICON = {
  ok: CheckCircle2,
  warn: CircleAlert,
  blocked: AlertTriangle,
} as const;

const LEVEL_CLASS = {
  ok: "text-success",
  warn: "text-warning",
  blocked: "text-danger",
} as const;

export function ReadinessPanel({ readiness }: { readiness: CampaignReadiness | null }) {
  const lines = buildLines(readiness);
  const recoverable = recoverableWork(readiness);
  const blockers = sortBlockers(readiness?.blockers ?? []);

  if (!readiness) {
    return (
      <Panel className="p-4" data-testid="readiness-empty">
        <p className="text-xs text-ink-muted">
          Aucun instantané d&apos;analyse : créez-en un pour voir l&apos;état de la campagne.
        </p>
      </Panel>
    );
  }

  return (
    <Panel className="p-4" data-testid="readiness-panel">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Prêt pour la science</h2>
        <span
          className={
            isArticleBlocked(lines)
              ? "text-[11px] font-medium text-danger"
              : "text-[11px] font-medium text-success"
          }
          data-testid="readiness-verdict"
        >
          {isArticleBlocked(lines) ? "matériau insuffisant" : "matériau suffisant"}
        </span>
      </header>

      <ul className="space-y-2">
        {lines.map((line) => {
          const Icon = LEVEL_ICON[line.level];
          const ratio = line.target ? Math.min(1, line.value / line.target) : 1;
          return (
            <li key={line.key} data-testid={`readiness-line-${line.key}`}>
              <div className="flex items-center gap-2 text-xs">
                <Icon className={`h-3.5 w-3.5 shrink-0 ${LEVEL_CLASS[line.level]}`} aria-hidden />
                <span className="flex-1 text-ink">{line.label}</span>
                <span className="font-mono text-ink-muted">
                  {line.value}
                  {line.target != null ? ` / ${line.target}` : ""}
                </span>
              </div>
              <div
                className="mt-1 h-1 overflow-hidden rounded-full bg-panel-muted"
                role="progressbar"
                aria-valuenow={line.value}
                aria-valuemin={0}
                aria-valuemax={line.target ?? line.value}
                aria-label={line.label}
              >
                <div
                  className={
                    line.level === "ok"
                      ? "h-full rounded-full bg-success"
                      : line.level === "warn"
                        ? "h-full rounded-full bg-warning"
                        : "h-full rounded-full bg-danger"
                  }
                  style={{ width: `${ratio * 100}%` }}
                />
              </div>
              {line.hint && <p className="mt-0.5 text-[10px] text-ink-muted">{line.hint}</p>}
            </li>
          );
        })}
      </ul>

      {recoverable.count > 0 && (
        <div
          className="mt-4 rounded border border-warning/40 bg-warning/5 p-3"
          data-testid="readiness-recoverable"
        >
          <div className="flex items-start gap-2">
            <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            <div className="text-xs">
              <p className="font-medium text-ink">
                {recoverable.count} annotation{recoverable.count > 1 ? "s" : ""} terminée
                {recoverable.count > 1 ? "s" : ""} mais non soumise
                {recoverable.count > 1 ? "s" : ""}
              </p>
              <p className="mt-1 text-ink-muted">
                {recoverable.sentences} phrases déjà validées restent invisibles aux calculs
                d&apos;accord. Les faire soumettre ne coûte aucune annotation supplémentaire.
              </p>
            </div>
          </div>
        </div>
      )}

      {blockers.length > 0 && (
        <ul className="mt-3 space-y-1" data-testid="readiness-blockers">
          {blockers.map((blocker) => (
            <li key={blocker.code} className="flex items-start gap-2 text-[11px]">
              <span
                className={
                  blocker.severity === "high"
                    ? "mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-danger"
                    : "mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warning"
                }
                aria-hidden
              />
              <span className="text-ink-muted">{blocker.message}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
