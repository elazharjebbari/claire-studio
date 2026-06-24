"use client";

/**
 * ProjectLockControl (point 2) — verrou de CAMPAGNE (niveau projet), réservé admin.
 * Gèle / dégèle l'édition de TOUTES les sessions de la campagne d'un seul geste, avec
 * confirmation (action structurante). Réutilise les endpoints admin lock/unlock projet.
 */

import { useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { useLockProject, useUnlockProject } from "@/lib/api/hooks";

export function ProjectLockControl({
  slug,
  locked,
  lockedBy,
}: {
  slug: string;
  locked: boolean;
  lockedBy?: string | null;
}) {
  const lock = useLockProject(slug);
  const unlock = useUnlockProject(slug);
  const [confirm, setConfirm] = useState(false);
  const pending = lock.isPending || unlock.isPending;

  function apply() {
    const m = locked ? unlock : lock;
    m.mutate(undefined, { onSettled: () => setConfirm(false) });
  }

  return (
    <div
      data-testid="project-lock-control"
      data-locked={locked ? "true" : "false"}
      className={
        "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm " +
        (locked
          ? "border-slate-400/40 bg-slate-400/10"
          : "border-line bg-panel-muted/40")
      }
    >
      <div className="flex items-center gap-2">
        {locked ? (
          <Lock size={15} aria-hidden className="text-slate-300" />
        ) : (
          <LockOpen size={15} aria-hidden className="text-ink-muted" />
        )}
        <span className="text-ink">
          {locked ? (
            <>
              <strong>Campagne verrouillée</strong>
              {lockedBy ? <span className="text-ink-muted"> · par {lockedBy}</span> : null}{" "}
              — toutes les sessions sont gelées (lecture seule).
            </>
          ) : (
            <>
              Campagne <strong>ouverte</strong> — l'annotation est active sur toutes les
              sessions.
            </>
          )}
        </span>
      </div>
      <button
        type="button"
        data-testid="project-lock-toggle"
        onClick={() => setConfirm(true)}
        className={
          "shrink-0 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors " +
          (locked
            ? "border-amber-400/50 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20"
            : "border-line text-ink-muted hover:bg-panel-muted hover:text-ink")
        }
      >
        {locked ? (
          <>
            <LockOpen size={13} aria-hidden /> Déverrouiller la campagne
          </>
        ) : (
          <>
            <Lock size={13} aria-hidden /> Verrouiller la campagne
          </>
        )}
      </button>

      {confirm && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setConfirm(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={locked ? "Déverrouiller la campagne" : "Verrouiller la campagne"}
            data-testid="project-lock-dialog"
            className="w-full max-w-md rounded-xl border border-line bg-elevated p-5 text-left shadow-2xl"
          >
            <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-ink">
              {locked ? (
                <LockOpen size={16} aria-hidden className="text-amber-300" />
              ) : (
                <Lock size={16} aria-hidden className="text-slate-300" />
              )}
              {locked ? "Déverrouiller la campagne ?" : "Verrouiller la campagne ?"}
            </h2>
            <p className="mb-4 text-xs text-ink-muted">
              {locked
                ? "L'édition redeviendra possible pour toutes les sessions d'annotation de la campagne."
                : "Toutes les sessions d'annotation de la campagne seront gelées (lecture seule). Les annotateurs ne pourront plus modifier leur travail tant que la campagne reste verrouillée."}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                data-testid="project-lock-cancel"
                onClick={() => setConfirm(false)}
                className="rounded-md border border-line px-3 py-1.5 text-sm text-ink hover:bg-panel-muted"
              >
                Annuler
              </button>
              <button
                type="button"
                data-testid="project-lock-confirm"
                disabled={pending}
                onClick={apply}
                className={
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 " +
                  (locked ? "bg-amber-500 hover:brightness-110" : "bg-slate-600 hover:brightness-110")
                }
              >
                {locked ? <LockOpen size={14} aria-hidden /> : <Lock size={14} aria-hidden />}
                {pending
                  ? "Application…"
                  : locked
                    ? "Déverrouiller"
                    : "Verrouiller"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
