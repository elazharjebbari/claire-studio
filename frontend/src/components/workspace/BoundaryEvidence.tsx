"use client";

/**
 * BoundaryEvidence (P5) — aperçu d'arbitrage ouvert DEPUIS une frontière de clause.
 * Affiche, pour le juge sélectionné (Claude / Codex) ou en mode « Comparer » (les
 * deux côte à côte), le thème proposé + l'evidence span cité + le rationale, afin
 * d'arbitrer sans ouvrir le menu complet de la phrase. Un bouton « Choisir »
 * referme la boucle audit → décision via resolveDivergence (réutilise P1).
 *
 * Positionné comme un popover `fixed` borné au viewport (useAnchoredPosition, P2),
 * fermé au clic extérieur et à Échap.
 */

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { getThemeToken } from "@/lib/tokens";
import { useAnchoredPosition } from "./useAnchoredPosition";
import type { JudgeDetail } from "./SentenceMenu";

type Tab = "claude" | "codex" | "compare";

export interface BoundaryEvidenceProps {
  x: number;
  y: number;
  claudeDetail: JudgeDetail | null;
  codexDetail: JudgeDetail | null;
  onClose: () => void;
}

export function BoundaryEvidence({
  x,
  y,
  claudeDetail,
  codexDetail,
  onClose,
}: BoundaryEvidenceProps) {
  const { ref, style } = useAnchoredPosition(x, y);
  const resolveDivergenceRange = useWorkspaceStore((s) => s.resolveDivergenceRange);

  // Onglet initial : le 1er juge disponible, sinon « comparer ».
  const initial: Tab = claudeDetail ? "claude" : codexDetail ? "codex" : "compare";
  const [tab, setTab] = useState<Tab>(initial);

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

  const adopt = (judge: "claude" | "codex", detail: JudgeDetail | null) => {
    if (!detail) return;
    // Adoption sur tout le segment du juge (toute la frontière), pas seulement l'ancre.
    resolveDivergenceRange(detail.anchorIndex, detail.endIndex, judge, detail.theme);
    onClose();
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Aperçu d'arbitrage de la frontière"
      data-testid="boundary-evidence"
      className="fixed z-50 max-h-[80vh] w-80 overflow-auto rounded-lg border border-line bg-elevated p-3 text-sm text-ink shadow-xl"
      style={style}
    >
      <div className="mb-2 flex items-center justify-between">
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

      <div role="tablist" className="mb-2 flex gap-1" aria-label="Modèle">
        <Tab id="claude" current={tab} setTab={setTab} disabled={!claudeDetail}>
          Claude
        </Tab>
        <Tab id="codex" current={tab} setTab={setTab} disabled={!codexDetail}>
          Codex
        </Tab>
        <Tab id="compare" current={tab} setTab={setTab} disabled={!claudeDetail && !codexDetail}>
          Comparer
        </Tab>
      </div>

      {tab === "compare" ? (
        <div className="grid grid-cols-2 gap-2">
          <EvidenceCard judge="claude" detail={claudeDetail} onAdopt={adopt} compact />
          <EvidenceCard judge="codex" detail={codexDetail} onAdopt={adopt} compact />
        </div>
      ) : tab === "claude" ? (
        <EvidenceCard judge="claude" detail={claudeDetail} onAdopt={adopt} />
      ) : (
        <EvidenceCard judge="codex" detail={codexDetail} onAdopt={adopt} />
      )}
    </div>
  );
}

function Tab({
  id,
  current,
  setTab,
  disabled,
  children,
}: {
  id: Tab;
  current: Tab;
  setTab: (t: Tab) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const active = current === id;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      data-testid={`boundary-tab-${id}`}
      onClick={() => setTab(id)}
      className={
        "rounded px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-40 " +
        (active ? "bg-accent/15 text-ink" : "text-ink-muted hover:bg-panel-muted")
      }
    >
      {children}
    </button>
  );
}

function EvidenceCard({
  judge,
  detail,
  onAdopt,
  compact,
}: {
  judge: "claude" | "codex";
  detail: JudgeDetail | null;
  onAdopt: (judge: "claude" | "codex", detail: JudgeDetail | null) => void;
  compact?: boolean;
}) {
  const name = judge === "claude" ? "Claude" : "Codex";
  if (!detail) {
    return (
      <div
        data-testid={`boundary-card-${judge}`}
        className="rounded-md border border-line bg-panel-muted/30 px-2 py-2 text-xs text-ink-muted"
      >
        {name} — pas de proposition ici.
      </div>
    );
  }
  const token = getThemeToken(detail.theme);
  return (
    <div
      data-testid={`boundary-card-${judge}`}
      className="flex flex-col gap-1.5 rounded-md border border-line bg-panel-muted/30 px-2 py-2 text-xs"
    >
      {compact && <span className="font-semibold text-ink-muted">{name}</span>}
      <span className="flex items-center gap-1 font-medium text-ink">
        <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: token.color }} />
        {token.label}
      </span>
      {detail.evidence && (
        <p className="border-l-2 border-line pl-2 italic text-ink-muted">« {detail.evidence} »</p>
      )}
      {detail.rationale && <p className="text-ink-muted">{detail.rationale}</p>}
      <button
        type="button"
        data-testid={`boundary-adopt-${judge}`}
        onClick={() => onAdopt(judge, detail)}
        className="mt-0.5 self-start rounded border border-line px-2 py-0.5 text-[11px] font-medium text-ink hover:bg-panel-muted"
      >
        Choisir {name}
      </button>
    </div>
  );
}
