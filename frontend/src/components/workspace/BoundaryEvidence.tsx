"use client";

/**
 * BoundaryEvidence (P5, N-way) — aperçu d'arbitrage ouvert depuis une frontière via l'icône
 * « œil ». Onglets DYNAMIQUES : un par juge présent + « Comparer » (toutes les propositions).
 * Refonte UX : popover élargi en mode comparaison, cartes EMPILÉES pleine largeur (plus de
 * cellule vide), accent couleur par thème, en-tête d'accord clair (icônes lucide), espaces
 * lisibles. Chaque carte : thème + nature, evidence cité, rationale, bouton « Choisir » qui
 * adopte toute la frontière (resolveDivergenceRange).
 *
 * Positionné en popover `fixed` borné au viewport, fermé au clic extérieur et à Échap.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeftRight, Check, CheckCircle2, Scale, X } from "lucide-react";

import { useWorkspaceStore } from "@/store/workspace";
import { getThemeToken } from "@/lib/tokens";
import { cn } from "@/lib/cn";
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

  const present = useMemo(() => judges.filter((j) => j.detail), [judges]);
  const multi = present.length >= 2;

  const [tab, setTab] = useState<string>(present[0]?.id ?? COMPARE);
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
    resolveDivergenceRange(detail.anchorIndex, detail.endIndex, judgeId, detail.theme);
    onClose();
  };

  const themes = present.map((j) => j.detail!.theme);
  const allAgree = multi && themes.every((t) => t === themes[0]);
  const isCompare = tab === COMPARE;
  // Élargi en comparaison (cartes empilées lisibles) ; compact sinon.
  const width = isCompare && multi ? "w-[26rem]" : "w-80";

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Aperçu d'arbitrage de la frontière"
      data-testid="boundary-evidence"
      tabIndex={-1}
      className={cn(
        "fixed z-50 max-h-[80vh] overflow-auto rounded-xl border border-line bg-elevated text-sm text-ink shadow-2xl outline-none",
        width,
      )}
      style={style}
    >
      {/* En-tête */}
      <div ref={focusRef} tabIndex={-1} className="flex items-center justify-between border-b border-line px-3 py-2 outline-none">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          <Scale size={13} aria-hidden /> Arbitrage de frontière
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer l'aperçu"
          className="rounded p-0.5 text-ink-muted hover:bg-panel-muted hover:text-ink"
        >
          <X size={15} aria-hidden />
        </button>
      </div>

      <div className="p-3">
        {present.length === 0 ? (
          <p className="rounded-md border border-line bg-panel-muted/30 px-3 py-3 text-xs text-ink-muted">
            Aucun modèle ne propose de frontière ici.
          </p>
        ) : (
          <>
            {multi && (
              <div
                data-testid="boundary-agreement"
                className={cn(
                  "mb-2.5 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium",
                  allAgree
                    ? "bg-success/10 text-success"
                    : "bg-warning/10 text-warning",
                )}
              >
                {allAgree ? <CheckCircle2 size={14} aria-hidden /> : <AlertTriangle size={14} aria-hidden />}
                {allAgree
                  ? `Accord des ${present.length} modèles — ${getThemeToken(themes[0]!).label}`
                  : `Divergence entre ${present.length} modèles — votre arbitrage`}
              </div>
            )}

            <div role="tablist" className="mb-2.5 flex flex-wrap gap-1" aria-label="Modèle">
              {present.map((j) => (
                <TabButton key={j.id} id={j.id} current={tab} setTab={setTab}>
                  {j.label}
                </TabButton>
              ))}
              {multi && (
                <TabButton id={COMPARE} current={tab} setTab={setTab} icon={<ArrowLeftRight size={12} aria-hidden />}>
                  Comparer
                </TabButton>
              )}
            </div>

            {isCompare ? (
              // Cartes EMPILÉES pleine largeur (lisibles, aucune cellule vide).
              <div className="flex flex-col gap-2">
                {present.map((j) => (
                  <EvidenceCard key={j.id} judgeId={j.id} name={j.label} detail={j.detail} onAdopt={adopt} showName />
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
    </div>
  );
}

function TabButton({
  id,
  current,
  setTab,
  children,
  icon,
}: {
  id: string;
  current: string;
  setTab: (t: string) => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const active = current === id;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-testid={`boundary-tab-${id === "__compare__" ? "compare" : id}`}
      onClick={() => setTab(id)}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
        active ? "bg-accent/15 text-ink ring-1 ring-accent/30" : "text-ink-muted hover:bg-panel-muted",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function EvidenceCard({
  judgeId,
  name,
  detail,
  onAdopt,
  showName,
}: {
  judgeId: string;
  name: string;
  detail: JudgeDetail | null;
  onAdopt: (judgeId: string, detail: JudgeDetail | null) => void;
  showName?: boolean;
}) {
  if (!detail) {
    return (
      <div
        data-testid={`boundary-card-${judgeId}`}
        className="rounded-md border border-dashed border-line bg-panel-muted/20 px-2.5 py-2 text-xs text-ink-muted"
      >
        {name} — pas de proposition ici.
      </div>
    );
  }
  const token = getThemeToken(detail.theme);
  return (
    <div
      data-testid={`boundary-card-${judgeId}`}
      className="flex flex-col gap-1.5 rounded-md border border-line bg-panel-muted/30 py-2 pl-2.5 pr-2 text-xs"
      style={{ borderLeftColor: token.color, borderLeftWidth: 3 }}
    >
      <div className="flex items-center justify-between gap-2">
        {showName && <span className="text-[11px] font-semibold text-ink-muted">{name}</span>}
        <span className="ml-auto flex items-center gap-1 font-medium text-ink">
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: token.color }} />
          {token.label}
        </span>
      </div>
      {detail.legalNature && (
        <span className="self-start rounded bg-panel-muted px-1 text-[9px] uppercase tracking-wide text-ink-muted">
          {detail.legalNature}
        </span>
      )}
      {detail.evidence && (
        <p className="rounded border-l-2 border-line bg-bg/40 py-1 pl-2 italic text-ink-muted">
          « {detail.evidence} »
        </p>
      )}
      {detail.rationale && <p className="text-ink-muted">{detail.rationale}</p>}
      <button
        type="button"
        data-testid={`boundary-adopt-${judgeId}`}
        onClick={() => onAdopt(judgeId, detail)}
        className="mt-0.5 inline-flex items-center gap-1 self-start rounded-md border border-line px-2 py-0.5 text-[11px] font-medium text-ink transition-colors hover:border-accent/50 hover:bg-accent/10"
      >
        <Check size={12} aria-hidden /> Choisir {name}
      </button>
    </div>
  );
}
