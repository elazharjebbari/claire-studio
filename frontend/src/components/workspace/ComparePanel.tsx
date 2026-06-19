"use client";

/**
 * ComparePanel (P4) — comparaison visuelle des segmentations Claude vs Codex.
 *
 * Trois rails verticaux alignés sur la même échelle de phrases [0, n) :
 *  - gauche  : blocs (runs) de Claude, remplis par la couleur du thème + étiquette.
 *  - centre  : bande d'ACCORD par tranche (emerald = accord, amber = divergence,
 *              slate = couverture partielle), regroupée en segments contigus.
 *  - droite  : blocs (runs) de Codex.
 * La hauteur d'un bloc est proportionnelle à son nombre de phrases (flex-grow). Le
 * bloc contenant la phrase focalisée est mis en valeur ; cliquer un bloc y saute.
 *
 * Drawer togglable (store.showComparePanel), affiché surtout en mode comparaison.
 * Toute la logique (runs, accord) est dérivée de fonctions pures déjà testées.
 */

import { getThemeToken } from "@/lib/tokens";
import type { Run } from "@/lib/runs";

interface AgreeSegment {
  start: number;
  end: number;
  status: "agree" | "diverge" | "partial";
}

/** Regroupe les phrases en segments d'accord contigus (ignore les phrases sans juge). */
function agreementSegments(
  claudeByIndex: (string | null)[],
  codexByIndex: (string | null)[],
  n: number,
): AgreeSegment[] {
  const segs: AgreeSegment[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = claudeByIndex[i] ?? null;
    const b = codexByIndex[i] ?? null;
    let status: AgreeSegment["status"] | null;
    if (a == null && b == null) status = null;
    else if (a != null && b != null) status = a === b ? "agree" : "diverge";
    else status = "partial";
    if (status == null) continue;
    const last = segs[segs.length - 1];
    if (last && last.status === status && last.end === i - 1) last.end = i;
    else segs.push({ start: i, end: i, status });
  }
  return segs;
}

const STATUS_COLOR: Record<AgreeSegment["status"], string> = {
  agree: "#34D399", // emerald-400
  diverge: "#FBBF24", // amber-400
  partial: "#64748B", // slate-500
};

function JudgeRail({
  label,
  runs,
  n,
  focused,
  onJump,
  testid,
}: {
  label: string;
  runs: Run[];
  n: number;
  focused: number;
  onJump: (index: number) => void;
  testid: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col" data-testid={testid}>
      <span className="mb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-line">
        {runs.map((r) => {
          const len = Math.max(1, r.end - r.start + 1);
          const token = r.theme ? getThemeToken(r.theme) : null;
          const isFocusedBlock = focused >= r.start && focused <= r.end;
          return (
            <button
              key={`${r.start}-${r.localId ?? "neutral"}`}
              type="button"
              data-testid={`${testid}-block-${r.start}`}
              onClick={() => onJump(r.start)}
              title={
                token ? `${token.label} — phrases ${r.start}–${r.end}` : `phrases ${r.start}–${r.end}`
              }
              style={{ flexGrow: len, backgroundColor: token ? `${token.color}33` : "transparent" }}
              className={
                "flex items-center justify-start gap-1 overflow-hidden border-b border-line/60 px-1.5 text-left text-[10px] leading-tight transition-[outline] last:border-b-0 hover:brightness-110 " +
                (isFocusedBlock ? "outline outline-1 -outline-offset-1 outline-accent" : "")
              }
            >
              {token && (
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: token.color }}
                />
              )}
              <span className="truncate text-ink">{token ? token.label : "—"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ComparePanel({
  claudeRuns,
  codexRuns,
  claudeByIndex,
  codexByIndex,
  n,
  focused,
  onJump,
  onClose,
}: {
  claudeRuns: Run[];
  codexRuns: Run[];
  claudeByIndex: (string | null)[];
  codexByIndex: (string | null)[];
  n: number;
  focused: number;
  onJump: (index: number) => void;
  onClose: () => void;
}) {
  const segs = agreementSegments(claudeByIndex, codexByIndex, n);

  return (
    <aside
      data-testid="compare-panel"
      aria-label="Comparaison Claude / Codex"
      className="flex h-full w-72 shrink-0 flex-col border-l border-line bg-elevated p-3"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink">
          Comparaison des blocs
        </h2>
        <button
          type="button"
          data-testid="compare-panel-close"
          aria-label="Fermer le panneau comparatif"
          onClick={onClose}
          className="rounded px-1 text-ink-muted hover:bg-panel-muted"
        >
          ✕
        </button>
      </div>

      <div className="flex min-h-0 flex-1 gap-1.5">
        <JudgeRail
          label="Claude"
          runs={claudeRuns}
          n={n}
          focused={focused}
          onJump={onJump}
          testid="compare-claude"
        />

        {/* Bande d'accord centrale. */}
        <div className="flex w-3 flex-col pt-4" data-testid="compare-agreement-strip">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded">
            {segs.map((sgmt) => (
              <div
                key={`${sgmt.start}-${sgmt.status}`}
                data-status={sgmt.status}
                title={
                  (sgmt.status === "agree"
                    ? "Accord"
                    : sgmt.status === "diverge"
                      ? "Divergence"
                      : "Couverture partielle") + ` — phrases ${sgmt.start}–${sgmt.end}`
                }
                style={{
                  flexGrow: Math.max(1, sgmt.end - sgmt.start + 1),
                  backgroundColor: STATUS_COLOR[sgmt.status],
                }}
              />
            ))}
          </div>
        </div>

        <JudgeRail
          label="Codex"
          runs={codexRuns}
          n={n}
          focused={focused}
          onJump={onJump}
          testid="compare-codex"
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-muted">
        <span className="flex items-center gap-1">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR.agree }} />
          accord
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR.diverge }} />
          divergence
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR.partial }} />
          partiel
        </span>
      </div>
    </aside>
  );
}
