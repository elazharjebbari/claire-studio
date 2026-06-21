"use client";

/**
 * ComparePanel (P4 + point e) — comparaison visuelle des segmentations de 2 OU 3 juges
 * (Claude / Codex / Mistral), au choix de l'utilisateur.
 *
 * Disposition : une bande d'ACCORD N-way à gauche, puis un rail par juge sélectionné,
 * tous alignés sur la même échelle de phrases [0, n) :
 *  - bande   : statut par tranche (emerald = tous d'accord, amber = ≥2 thèmes distincts
 *              = conflit, slate = couverture partielle), regroupée en segments contigus.
 *  - rail    : blocs (runs) du juge, remplis par la couleur du thème + étiquette.
 * La hauteur d'un bloc est proportionnelle à son nombre de phrases (flex-grow). Le bloc
 * contenant la phrase focalisée est mis en valeur ; cliquer un bloc y saute. Les zones
 * de conflit (amber) sont clickables → 1re phrase du conflit (arbitrage via le menu).
 *
 * Un sélecteur permet de choisir les juges présents dans la zone (min 2). Drawer
 * togglable (store.showComparePanel). Toute la logique dérive de fonctions pures.
 */

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { getThemeToken } from "@/lib/tokens";
import type { Run } from "@/lib/runs";
import { segmentsFromRuns, conflictZones } from "@/lib/runs";
import { nextDivergence, prevDivergence, divergenceOrdinal } from "@/lib/divergence";

/** Un juge affiché dans la comparaison : runs (blocs) + thème par phrase (forward-fill). */
export interface CompareJudge {
  id: string;
  label: string;
  runs: Run[];
  byIndex: (string | null)[];
}

interface AgreeSegment {
  start: number;
  end: number;
  status: "agree" | "diverge" | "partial";
}

/**
 * Regroupe les phrases en segments d'accord contigus, N-way (généralise la version
 * pairwise). Ignore les phrases que personne ne couvre. Statut par phrase :
 *  - diverge : ≥ 2 thèmes DISTINCTS parmi les juges présents (conflit) ;
 *  - partial : tous les présents s'accordent mais tous les juges ne couvrent pas ;
 *  - agree   : tous les juges couvrent et s'accordent.
 */
export function agreementSegments(
  byIndexList: (string | null)[][],
  judgeCount: number,
  n: number,
): AgreeSegment[] {
  const segs: AgreeSegment[] = [];
  for (let i = 0; i < n; i += 1) {
    const present = byIndexList.map((b) => b[i] ?? null).filter((t): t is string => t != null);
    let status: AgreeSegment["status"] | null;
    if (present.length === 0) status = null;
    else if (new Set(present).size >= 2) status = "diverge";
    else if (present.length < judgeCount) status = "partial";
    else status = "agree";
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
  focused,
  onJump,
  testid,
}: {
  label: string;
  runs: Run[];
  focused: number;
  onJump: (index: number) => void;
  testid: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col" data-testid={testid}>
      <span className="mb-1 truncate text-center text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
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
  judges,
  allJudges,
  selectedIds,
  onToggleJudge,
  n,
  focused,
  onJump,
  onClose,
}: {
  /** Juges sélectionnés, dans l'ordre d'affichage. */
  judges: CompareJudge[];
  /** Tous les juges disponibles (avec données) — pour le sélecteur. */
  allJudges: { id: string; label: string }[];
  selectedIds: string[];
  onToggleJudge: (id: string) => void;
  n: number;
  focused: number;
  onJump: (index: number) => void;
  onClose: () => void;
}) {
  const segs = agreementSegments(
    judges.map((j) => j.byIndex),
    judges.length,
    n,
  );
  // Ancres de conflit N-way (≥2 thèmes distincts) → navigation des désaccords.
  const divAnchors = conflictZones(
    judges.map((j) => ({ segments: segmentsFromRuns(j.runs) })),
    n,
  ).map((z) => z.start);
  const divOrdinal = divergenceOrdinal(divAnchors, focused);
  const labels = judges.map((j) => j.label).join(" / ");

  return (
    <aside
      data-testid="compare-panel"
      aria-label={`Comparaison ${labels}`}
      className={
        "flex h-full shrink-0 flex-col border-l border-line bg-elevated p-3 " +
        (judges.length >= 3 ? "w-96" : "w-72")
      }
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
          className="inline-flex items-center rounded px-1 text-ink-muted hover:bg-panel-muted"
        >
          <X size={14} aria-hidden />
        </button>
      </div>

      {/* Sélecteur de juges (point e) : choisir 2 ou 3 modèles dans la zone (min 2). */}
      {allJudges.length > 2 && (
        <div
          data-testid="compare-judge-select"
          className="mb-2 flex flex-wrap items-center gap-1"
          role="group"
          aria-label="Juges à comparer"
        >
          {allJudges.map((j) => {
            const on = selectedIds.includes(j.id);
            const lastTwo = on && selectedIds.length <= 2; // retrait interdit (min 2)
            return (
              <button
                key={j.id}
                type="button"
                data-testid={`compare-judge-toggle-${j.id}`}
                aria-pressed={on}
                disabled={lastTwo}
                onClick={() => onToggleJudge(j.id)}
                title={lastTwo ? "Au moins 2 juges requis" : on ? `Retirer ${j.label}` : `Ajouter ${j.label}`}
                className={
                  "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 " +
                  (on
                    ? "border-accent/50 bg-accent/15 text-ink"
                    : "border-line text-ink-muted hover:bg-panel-muted")
                }
              >
                {j.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Navigation des conflits depuis le panneau (saute + recentre). */}
      {divAnchors.length > 0 && (
        <div
          data-testid="compare-divergence-nav"
          className="mb-2 flex items-center gap-2 rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[11px]"
        >
          <span className="font-medium text-ink">Désaccords</span>
          <span data-testid="compare-divergence-counter" className="font-mono text-ink-muted">
            {divOrdinal > 0 ? `${divOrdinal} / ${divAnchors.length}` : `– / ${divAnchors.length}`}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              data-testid="compare-divergence-prev"
              aria-label="Désaccord précédent"
              onClick={() => {
                const t = prevDivergence(divAnchors, focused);
                if (t != null) onJump(t);
              }}
              className="inline-flex items-center rounded border border-line px-1 py-0.5 text-ink hover:bg-panel-muted"
            >
              <ChevronLeft size={13} aria-hidden />
            </button>
            <button
              type="button"
              data-testid="compare-divergence-next"
              aria-label="Désaccord suivant"
              onClick={() => {
                const t = nextDivergence(divAnchors, focused);
                if (t != null) onJump(t);
              }}
              className="inline-flex items-center rounded border border-line px-1 py-0.5 text-ink hover:bg-panel-muted"
            >
              <ChevronRight size={13} aria-hidden />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-1.5">
        {/* Bande d'accord N-way (à gauche). */}
        <div className="flex w-3 flex-col pt-4" data-testid="compare-agreement-strip">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded">
            {segs.map((sgmt) => {
              const title =
                (sgmt.status === "agree"
                  ? "Accord"
                  : sgmt.status === "diverge"
                    ? "Conflit — cliquer pour arbitrer"
                    : "Couverture partielle") + ` — phrases ${sgmt.start}–${sgmt.end}`;
              const style = {
                flexGrow: Math.max(1, sgmt.end - sgmt.start + 1),
                backgroundColor: STATUS_COLOR[sgmt.status],
              } as const;
              if (sgmt.status === "diverge") {
                return (
                  <button
                    key={`${sgmt.start}-${sgmt.status}`}
                    type="button"
                    data-status={sgmt.status}
                    data-testid={`compare-diverge-${sgmt.start}`}
                    title={title}
                    style={style}
                    onClick={() => onJump(sgmt.start)}
                    className="w-full cursor-pointer hover:brightness-110"
                  />
                );
              }
              return (
                <div key={`${sgmt.start}-${sgmt.status}`} data-status={sgmt.status} title={title} style={style} />
              );
            })}
          </div>
        </div>

        {/* Un rail par juge sélectionné. */}
        {judges.map((j) => (
          <JudgeRail
            key={j.id}
            label={j.label}
            runs={j.runs}
            focused={focused}
            onJump={onJump}
            testid={`compare-${j.id}`}
          />
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-muted">
        <span className="flex items-center gap-1">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR.agree }} />
          accord
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR.diverge }} />
          conflit
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR.partial }} />
          partiel
        </span>
      </div>
    </aside>
  );
}
