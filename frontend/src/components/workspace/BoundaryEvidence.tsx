"use client";

/**
 * BoundaryEvidence (P5, N-way) — aperçu d'arbitrage ouvert depuis une frontière via
 * l'icône « œil ». Onglets DYNAMIQUES : un par juge présent (Claude / Codex / Mistral /
 * …) + « Comparer » (toutes les propositions côte à côte). Chaque carte montre le thème
 * proposé, la NATURE JURIDIQUE du juge, l'evidence span cité et le rationale, avec un
 * bouton « Choisir » qui adopte la frontière (resolveDivergenceRange).
 *
 * Positionné en popover `fixed` borné au viewport (useAnchoredPosition), fermé au clic
 * extérieur et à Échap, navigable au clavier (focus piégé à l'ouverture).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { getThemeToken } from "@/lib/tokens";
import { useAnchoredPosition } from "./useAnchoredPosition";
import type { JudgeEntry, JudgeDetail } from "./SentenceMenu";

const COMPARE = "__compare__";

export interface BoundaryEvidenceProps {
  x: number;
  y: number;
  /** Juges configurés + leur détail à la frontière (null si non couverte). */
  judges: JudgeEntry[];
  onClose: () => void;
}

export function BoundaryEvidence({ x, y, judges, onClose }: BoundaryEvidenceProps) {
  const { ref, style } = useAnchoredPosition(x, y);
  const resolveDivergenceRange = useWorkspaceStore((s) => s.resolveDivergenceRange);

  // Juges réellement présents à cette frontière (avec une proposition).
  const present = useMemo(() => judges.filter((j) => j.detail), [judges]);
  const multi = present.length >= 2;

  // Onglet initial : 1er juge présent, sinon « comparer ».
  const [tab, setTab] = useState<string>(present[0]?.id ?? COMPARE);
  // Réaligne l'onglet si la frontière change et que l'onglet courant n'est plus présent.
  useEffect(() => {
    if (tab !== COMPARE && !present.some((j) => j.id === tab)) {
      setTab(present[0]?.id ?? COMPARE);
    }
  }, [present, tab]);

  const focusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    focusRef.current?.focus();
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, ref]);

  const adopt = (judgeId: string, detail: JudgeDetail | null) => {
    if (!detail) return;
    // Adoption sur TOUT le segment du juge (toute la frontière), pas seulement l'ancre.
    resolveDivergenceRange(detail.anchorIndex, detail.endIndex, judgeId, detail.theme);
    onClose();
  };

  // Accord/divergence des juges présents (badge d'en-tête).
  const themes = present.map((j) => j.detail!.theme);
  const allAgree = multi && themes.every((t) => t === themes[0]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Aperçu d'arbitrage de la frontière"
      data-testid="boundary-evidence"
      tabIndex={-1}
      className="fixed z-50 max-h-[80vh] w-80 overflow-auto rounded-lg border border-line bg-elevated p-3 text-sm text-ink shadow-xl outline-none"
      style={style}
    >
      <div ref={focusRef} tabIndex={-1} className="mb-2 flex items-center justify-between outline-none">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          Arbitrage — preuves
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer l'aperçu"
          className="rounded px-1 text-ink-muted hover:bg-panel-muted"
        >
          ✕
        </button>
      </div>

      {present.length === 0 ? (
        <p className="rounded-md border border-line bg-panel-muted/30 px-2 py-2 text-xs text-ink-muted">
          Aucun modèle ne propose de frontière ici.
        </p>
      ) : (
        <>
          {multi && (
            <p
              data-testid="boundary-agreement"
              className={
                "mb-2 text-xs font-medium " + (allAgree ? "text-emerald-400" : "text-amber-400")
              }
            >
              {allAgree
                ? `✓ Accord — ${getThemeToken(themes[0]!).label}`
                : `✗ Divergence (${present.length} modèles)`}
            </p>
          )}
          <div role="tablist" className="mb-2 flex flex-wrap gap-1" aria-label="Modèle">
            {present.map((j) => (
              <TabButton key={j.id} id={j.id} current={tab} setTab={setTab}>
                {j.label}
              </TabButton>
            ))}
            {multi && (
              <TabButton id={COMPARE} current={tab} setTab={setTab}>
                Comparer
              </TabButton>
            )}
          </div>

          {tab === COMPARE ? (
            <div className="grid grid-cols-2 gap-2">
              {present.map((j) => (
                <EvidenceCard key={j.id} judgeId={j.id} name={j.label} detail={j.detail} onAdopt={adopt} compact />
              ))}
            </div>
          ) : (
            (() => {
              const j = present.find((p) => p.id === tab) ?? present[0]!;
              return <EvidenceCard judgeId={j.id} name={j.label} detail={j.detail} onAdopt={adopt} />;
            })()
          )}
        </>
      )}
    </div>
  );
}

function TabButton({
  id,
  current,
  setTab,
  children,
}: {
  id: string;
  current: string;
  setTab: (t: string) => void;
  children: React.ReactNode;
}) {
  const active = current === id;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-testid={`boundary-tab-${id === "__compare__" ? "compare" : id}`}
      onClick={() => setTab(id)}
      className={
        "rounded px-2 py-0.5 text-xs font-medium transition-colors " +
        (active ? "bg-accent/15 text-ink ring-1 ring-accent/30" : "text-ink-muted hover:bg-panel-muted")
      }
    >
      {children}
    </button>
  );
}

function EvidenceCard({
  judgeId,
  name,
  detail,
  onAdopt,
  compact,
}: {
  judgeId: string;
  name: string;
  detail: JudgeDetail | null;
  onAdopt: (judgeId: string, detail: JudgeDetail | null) => void;
  compact?: boolean;
}) {
  if (!detail) {
    return (
      <div
        data-testid={`boundary-card-${judgeId}`}
        className="rounded-md border border-line bg-panel-muted/30 px-2 py-2 text-xs text-ink-muted"
      >
        {name} — pas de proposition ici.
      </div>
    );
  }
  const token = getThemeToken(detail.theme);
  return (
    <div
      data-testid={`boundary-card-${judgeId}`}
      className="flex flex-col gap-1.5 rounded-md border border-line bg-panel-muted/30 px-2 py-2 text-xs"
    >
      {compact && <span className="font-semibold text-ink-muted">{name}</span>}
      <span className="flex flex-wrap items-center gap-1 font-medium text-ink">
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: token.color }} />
        {token.label}
        {detail.legalNature && (
          <span className="rounded bg-panel-muted px-1 text-[9px] uppercase text-ink-muted">
            {detail.legalNature}
          </span>
        )}
      </span>
      {detail.evidence && (
        <p className="border-l-2 border-line pl-2 italic text-ink-muted">« {detail.evidence} »</p>
      )}
      {detail.rationale && <p className="text-ink-muted">{detail.rationale}</p>}
      <button
        type="button"
        data-testid={`boundary-adopt-${judgeId}`}
        onClick={() => onAdopt(judgeId, detail)}
        className="mt-0.5 self-start rounded border border-line px-2 py-0.5 text-[11px] font-medium text-ink transition-colors hover:bg-accent/10 hover:border-accent/50"
      >
        Choisir {name}
      </button>
    </div>
  );
}
