"use client";

/**
 * PreferencesPopover — foyer des préférences PAR COMPTE (badge « mon compte ») : auto-
 * pré-annotation (switch + modèle), disposition par défaut des panneaux, réinitialisation,
 * et indicateur de synchronisation. Branché sur le store de prefs (source unique). Déclencheur
 * `SlidersHorizontal` homogène aux boutons de la toolbar ; panneau Échap / clic extérieur.
 */

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X, RotateCcw } from "lucide-react";
import { PrefSwitch } from "@/components/ui/PrefSwitch";
import { usePrefsStore } from "@/store/prefs";
import { LLM_JUDGES, llmJudgeLabel } from "@/lib/llmJudges";
import type { UiPrefsPanels } from "@/lib/prefs/schema";

const PANEL_ROWS: { key: keyof UiPrefsPanels; label: string }[] = [
  { key: "inspectorOpen", label: "Inspecteur ouvert" },
  { key: "sidebarCollapsed", label: "Barre latérale repliée" },
  { key: "historyOpen", label: "Historique ouvert" },
  { key: "commentsOpen", label: "Commentaires ouverts" },
  { key: "triageOpen", label: "File de triage ouverte" },
];

export function PreferencesPopover() {
  const prefs = usePrefsStore((s) => s.prefs);
  const setPanel = usePrefsStore((s) => s.setPanel);
  const setPrefill = usePrefsStore((s) => s.setPrefill);
  const reset = usePrefsStore((s) => s.reset);
  const syncStatus = usePrefsStore((s) => s.syncStatus);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const prefill = prefs.prefill;
  const statusText: Record<string, string> = { saving: "Enregistrement…", saved: "✓ Enregistré", idle: "" };

  return (
    <div ref={rootRef} className="relative" data-testid="prefs-popover">
      <button
        type="button"
        data-testid="prefs-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="Préférences d'affichage (mon compte)"
        className={
          "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors hover:bg-panel-muted " +
          (open ? "border-accent/40 bg-accent/10 text-ink" : "border-line text-ink-muted")
        }
      >
        <SlidersHorizontal size={14} aria-hidden /> Préférences
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Préférences d'affichage"
          data-testid="prefs-card"
          className="absolute right-0 top-full z-50 mt-1.5 w-80 rounded-lg border border-line bg-elevated p-3 text-left shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Préférences d'affichage</h3>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                mon compte
              </span>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setOpen(false)}
                className="rounded p-0.5 text-ink-muted hover:bg-panel-muted hover:text-ink"
              >
                <X size={14} aria-hidden />
              </button>
            </div>
          </div>

          {/* Auto-pré-annotation */}
          <section className="mb-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Auto-pré-annotation
            </p>
            <div className="flex items-center justify-between gap-2 py-1">
              <span className="text-sm text-ink">
                À l'ouverture d'un document vierge
                <span className="block text-[11px] text-ink-muted">
                  Pré-remplit avec le modèle choisi (jamais d'écrasement).
                </span>
              </span>
              <PrefSwitch
                checked={prefill.enabled}
                disabled={!prefill.judge}
                label="Activer l'auto-pré-annotation"
                data-testid="prefs-autoprefill-switch"
                onChange={(next) => setPrefill({ enabled: next })}
              />
            </div>
            <div className="mt-1 flex flex-wrap gap-1" role="radiogroup" aria-label="Modèle d'auto-pré-annotation">
              {LLM_JUDGES.map((j) => {
                const active = prefill.judge === j.id;
                return (
                  <button
                    key={j.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-testid={`prefs-autoprefill-model-${j.id}`}
                    onClick={() => setPrefill({ judge: j.id, enabled: prefill.enabled || true })}
                    className={
                      "rounded px-2 py-0.5 text-xs font-medium transition-colors " +
                      (active ? "bg-accent/15 text-ink ring-1 ring-accent/40" : "text-ink-muted hover:bg-panel-muted")
                    }
                  >
                    {llmJudgeLabel(j.id)}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Disposition des panneaux (états par défaut) */}
          <section className="mb-3 border-t border-line/60 pt-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Disposition par défaut
            </p>
            <ul className="flex flex-col">
              {PANEL_ROWS.map((row) => (
                <li key={row.key} className="flex items-center justify-between gap-2 py-1">
                  <span className="text-sm text-ink">{row.label}</span>
                  <PrefSwitch
                    checked={prefs.panels[row.key]}
                    label={row.label}
                    data-testid={`prefs-panel-${row.key}`}
                    onChange={(next) => setPanel(row.key, next)}
                  />
                </li>
              ))}
            </ul>
          </section>

          <div className="flex items-center justify-between border-t border-line/60 pt-2">
            <span
              data-testid="prefs-sync-status"
              role="status"
              aria-live="polite"
              className="text-[11px] text-ink-muted"
            >
              {statusText[syncStatus] ?? ""}
            </span>
            <button
              type="button"
              data-testid="prefs-reset"
              onClick={reset}
              className="inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink"
            >
              <RotateCcw size={12} aria-hidden /> Réinitialiser
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
