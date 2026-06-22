"use client";

/**
 * RationaleHover (axe 1) — aperçu PASSIF au survol d'une phrase : « pourquoi ce thème ».
 *
 * Affiche le thème + le rationale HUMAIN (s'il existe) et, en condensé, ce que chaque
 * juge LLM présent propose (thème + rationale + evidence). Strictement en lecture :
 * `pointer-events-none` → ne capture jamais le pointeur, donc ne casse ni la sélection,
 * ni le long-press, ni le clic. L'édition reste dans le clic-droit (SentenceMenu) et
 * l'inspecteur. Positionné via useAnchoredPosition (borné au viewport), animé fade-in.
 *
 * Ne rend RIEN s'il n'y a aucune matière (pas de rationale humain ni de détail LLM) —
 * pour ne pas papilloter pendant la lecture.
 */

import { getThemeToken } from "@/lib/tokens";
import { useAnchoredPosition } from "./useAnchoredPosition";

export interface HoverJudge {
  label: string;
  theme: string;
  rationale: string | null;
  evidence: string | null;
  /** Nature juridique proposée par le juge (vocab LLM). */
  legalNature?: string | null;
}

export interface RationaleHoverProps {
  x: number;
  y: number;
  /** Thème de la clause HUMAINE couvrant la phrase (null si non annotée). */
  humanTheme: string | null;
  humanRationale: string | null;
  humanEvidence: string | null;
  judges: HoverJudge[];
}

export function RationaleHover({
  x,
  y,
  humanTheme,
  humanRationale,
  humanEvidence,
  judges,
}: RationaleHoverProps) {
  const { ref, style } = useAnchoredPosition(x, y);
  const hasHuman = !!(humanTheme && (humanRationale || humanEvidence));
  if (!hasHuman && judges.length === 0) return null;

  const trunc = (s: string | null, n = 220) =>
    s && s.length > n ? `${s.slice(0, n)}…` : s;

  return (
    <div
      ref={ref}
      role="tooltip"
      data-testid="rationale-hover"
      className="pointer-events-none fixed z-40 max-w-sm animate-fade-in rounded-lg border border-line bg-elevated p-3 text-xs text-ink shadow-xl"
      style={style}
    >
      {hasHuman && humanTheme && (
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 font-semibold text-ink">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: getThemeToken(humanTheme).color }}
            />
            {getThemeToken(humanTheme).label}
            <span className="ml-1 rounded bg-accent/15 px-1 text-[9px] font-medium text-accent">
              vous
            </span>
          </span>
          {humanRationale && <p className="text-ink-muted">{trunc(humanRationale)}</p>}
          {humanEvidence && (
            <p className="border-l-2 border-line pl-2 italic text-ink-muted">
              « {trunc(humanEvidence, 140)} »
            </p>
          )}
        </div>
      )}

      {judges.length > 0 && (
        <div className={hasHuman ? "mt-2 border-t border-line pt-2" : ""}>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            Propositions LLM
          </div>
          <div className="flex flex-col gap-1.5">
            {judges.map((j) => {
              const token = getThemeToken(j.theme);
              return (
                <div key={j.label} className="text-ink-muted">
                  <span className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: token.color }}
                    />
                    <span className="font-medium text-ink">{j.label}</span>
                    <span className="text-ink">· {token.label}</span>
                    {j.legalNature && (
                      <span className="rounded bg-panel-muted px-1 text-[9px] uppercase text-ink-muted">
                        {j.legalNature}
                      </span>
                    )}
                  </span>
                  {j.rationale && <p className="ml-3.5 mt-0.5">{trunc(j.rationale, 140)}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
