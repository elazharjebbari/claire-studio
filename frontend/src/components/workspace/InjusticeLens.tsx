"use client";

/**
 * InjusticeLens — « loupe d'injustice » CLAUDETTE (dossier docs/pactiva/dossier-injustice-hover).
 *
 * Deux modes sur une phrase MARQUÉE injuste :
 *  - `preview` : aperçu PASSIF au survol (role=tooltip, pointer-events-none) — sévérité max
 *    + catégories + « cliquez pour les détails ».
 *  - `pinned`  : fiche COMPLÈTE au clic/clavier (role=dialog, Échap + clic-extérieur + focus) —
 *    une carte par catégorie (badge sévérité glyphe+libellé+jauge, sens, thèmes associés),
 *    évidence (phrase surlignée + repère indicatif étiqueté), rappel pédagogique.
 *
 * Couleur de catégorie via tokens ; sévérité via échelle sémantique + glyphe + libellé +
 * jauge (jamais la couleur seule). Zéro hex en dur hors couleurs issues des tokens.
 */

import { useEffect } from "react";
import { AlertTriangle, ShieldAlert, ShieldCheck, Scale, X } from "lucide-react";
import { getThemeToken } from "@/lib/tokens";
import { severityMeta, type SeverityTone, type SeverityIcon } from "@/lib/unfairnessMeta";
import { highlightEvidence } from "@/lib/highlightEvidence";
import type { UnfairnessCategory } from "@/types/contract";
import type { UnfairnessMark } from "./useUnfairness";
import { useAnchoredPosition } from "./useAnchoredPosition";

export interface InjusticeLensProps {
  mode: "preview" | "pinned";
  x: number;
  y: number;
  /** Marques de la phrase, triées par sévérité ↓ (cf. useUnfairnessMarks). */
  marks: UnfairnessMark[];
  /** Texte de la phrase (pour l'évidence surlignée). */
  sentenceText: string;
  /** Fermeture (mode épinglé). */
  onClose?: () => void;
  /** Survol de la carte elle-même (mode aperçu hoverable) : maintenir/refermer. */
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const SEVERITY_ICON: Record<SeverityIcon, typeof ShieldCheck> = {
  "shield-check": ShieldCheck,
  "alert-triangle": AlertTriangle,
  "shield-alert": ShieldAlert,
};

// Échelle sémantique (classes Tailwind, pas de hex). text/bg/border + remplissage jauge.
const TONE: Record<SeverityTone, { text: string; chip: string; fill: string; empty: string }> = {
  low: { text: "text-emerald-300", chip: "bg-emerald-400/10 border-emerald-400/30", fill: "bg-emerald-400", empty: "bg-emerald-400/20" },
  mid: { text: "text-amber-300", chip: "bg-amber-400/10 border-amber-400/30", fill: "bg-amber-400", empty: "bg-amber-400/20" },
  high: { text: "text-rose-300", chip: "bg-rose-400/10 border-rose-400/40", fill: "bg-rose-400", empty: "bg-rose-400/20" },
};

function Gauge({ level, tone }: { level: number; tone: SeverityTone }) {
  const t = TONE[tone];
  return (
    <span aria-hidden className="inline-flex items-center gap-0.5">
      {[1, 2, 3].map((i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= level ? t.fill : t.empty}`} />
      ))}
    </span>
  );
}

function SeverityBadge({ level }: { level: number }) {
  const sev = severityMeta(level);
  if (!sev) return null;
  const t = TONE[sev.tone];
  const Icon = SEVERITY_ICON[sev.icon];
  return (
    <span
      data-testid="severity-badge"
      data-tone={sev.tone}
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${t.chip} ${t.text}`}
    >
      <Icon size={12} aria-hidden /> N{level} · {sev.label}
      <Gauge level={level} tone={sev.tone} />
    </span>
  );
}

function CategoryCard({ mark }: { mark: UnfairnessMark }) {
  return (
    <div className="flex flex-col gap-1" data-testid={`injustice-card-${mark.category}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: mark.color }} />
        <span className="font-mono text-[10px] font-bold text-ink-muted">{mark.category}</span>
        <span className="font-semibold text-ink">{mark.label}</span>
        <span className="ml-auto">
          <SeverityBadge level={mark.level} />
        </span>
      </div>
      {mark.sense && <p className="text-ink-muted">{mark.sense}</p>}
      {mark.relatedThemes.length > 0 && (
        <p className="text-[11px] text-ink-muted">
          <span className="text-ink-muted/70">Thème associé : </span>
          {mark.relatedThemes.map((code, i) => (
            <span key={code}>
              {i > 0 && " · "}
              <span className="text-ink">{getThemeToken(code).label}</span>
            </span>
          ))}
          <span className="ml-1 rounded bg-panel-muted px-1 text-[9px] uppercase text-ink-muted">indicatif</span>
        </p>
      )}
    </div>
  );
}

function Evidence({ marks, sentenceText }: { marks: UnfairnessMark[]; sentenceText: string }) {
  const categories = marks.map((m) => m.category as UnfairnessCategory);
  const segments = highlightEvidence(sentenceText, categories);
  const hasHint = segments.some((s) => s.mark);
  return (
    <div className="flex flex-col gap-1" data-testid="injustice-evidence">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
        Évidence <span className="font-normal lowercase tracking-normal">(phrase marquée)</span>
      </div>
      <p className="rounded border-l-2 border-amber-300/60 bg-amber-300/10 px-2 py-1 italic text-ink">
        {segments.map((s, i) =>
          s.mark ? (
            <mark
              key={i}
              data-testid="evidence-hint"
              className="bg-transparent font-medium text-amber-200 underline decoration-amber-300/70 decoration-dotted underline-offset-2"
            >
              {s.text}
            </mark>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
      </p>
      {hasHint && (
        <p className="text-[10px] text-ink-muted">
          ⓘ Repère <strong>indicatif</strong> (souligné) — non vérifié ; la donnée CLAUDETTE est par phrase.
        </p>
      )}
    </div>
  );
}

export function InjusticeLens({
  mode,
  x,
  y,
  marks,
  sentenceText,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: InjusticeLensProps) {
  const { ref, style } = useAnchoredPosition(x, y);
  const pinned = mode === "pinned";

  // Mode épinglé : Échap + clic-extérieur + focus initial (patron BoundaryEvidence).
  useEffect(() => {
    if (!pinned) return;
    const el = ref.current;
    el?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    }
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose?.();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinned, onClose]);

  const lead = marks[0];
  if (!lead) return null;
  const maxLevel = lead.level; // trié ↓
  const count = marks.length;

  // En-tête (synthèse) — partagé.
  const header = (
    <div className="flex shrink-0 items-start justify-between gap-2 border-b border-line/60 p-3.5 pb-2.5">
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 font-semibold text-ink">
          <Scale size={14} aria-hidden className="text-ink-muted" />
          Clause potentiellement injuste
          <span className="rounded bg-panel-muted px-1 text-[9px] uppercase text-ink-muted">overlay</span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted">
          {count} catégorie{count > 1 ? "s" : ""} · sévérité max <SeverityBadge level={maxLevel} />
        </span>
      </div>
      {pinned && (
        <button
          type="button"
          data-testid="injustice-lens-close"
          onClick={onClose}
          aria-label="Fermer"
          className="rounded p-0.5 text-ink-muted hover:bg-panel-muted hover:text-ink"
        >
          <X size={14} aria-hidden />
        </button>
      )}
    </div>
  );

  // Corps (cartes + évidence + rappel) — partagé aperçu/épinglé.
  const body = (
    <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto p-3.5">
      {marks.map((m) => (
        <CategoryCard key={m.category} mark={m} />
      ))}
      <div className="border-t border-line/60 pt-2.5">
        <Evidence marks={marks} sentenceText={sentenceText} />
      </div>
      <p className="rounded-md border border-line bg-panel-muted/30 px-2 py-1.5 text-[10px] text-ink-muted">
        ⓘ La <strong>catégorie d'injustice</strong> (overlay CLAUDETTE) est distincte de votre
        <strong> thème</strong> de segmentation. Les deux coexistent.
      </p>
    </div>
  );

  // ── Aperçu HOVERABLE (survol) : carte riche que l'on peut survoler pour lire/scroller.
  // pointer-events-auto + handlers de maintien ; ne capture pas le clic de la phrase
  // (le déclencheur est la marque, pas la fiche). Footer = aide clavier.
  if (!pinned) {
    return (
      <div
        ref={ref}
        role="tooltip"
        data-testid="injustice-lens-preview"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="fixed z-40 flex max-h-[70vh] w-[22rem] max-w-[90vw] flex-col overflow-hidden rounded-xl border border-line bg-elevated text-xs text-ink shadow-2xl animate-fade-in"
        style={style}
      >
        {header}
        {body}
      </div>
    );
  }

  // ── Fiche ÉPINGLÉE (clavier Entrée/Espace) : dialog accessible (Échap/clic-extérieur).
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Détails de la clause injuste"
      tabIndex={-1}
      data-testid="injustice-lens-pinned"
      className="fixed z-50 flex max-h-[70vh] w-[22rem] max-w-[90vw] flex-col overflow-hidden rounded-xl border border-line bg-elevated text-xs text-ink shadow-2xl outline-none"
      style={style}
    >
      {header}
      {body}
    </div>
  );
}
