"use client";

/**
 * SubmitDialog (point 2) — soumission VERSIONNÉE. À la soumission, l'annotateur nomme
 * (requis) et décrit (optionnel) la version. On crée une AnnotationVersion de
 * soumission (snapshot immuable côté backend) puis on passe l'annotation en
 * `submitted`. Les versions coexistent.
 *
 * Modal accessible (role=dialog, focus piégé minimal, Échap, clic extérieur), avec un
 * aperçu des statistiques figées (#clauses, certitude moyenne).
 */

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/primitives";

export interface SubmitDialogProps {
  /** Stats d'aperçu (figées dans la version). */
  stats: { clauses: number; meanCertainty: number | null };
  busy?: boolean;
  /** Point d : si défini, la soumission est BLOQUÉE (toutes les phrases pas validées). */
  blockReason?: string | null;
  onCancel: () => void;
  onConfirm: (payload: { name: string; description: string }) => void;
}

export function SubmitDialog({ stats, busy, blockReason, onCancel, onConfirm }: SubmitDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const canSubmit = name.trim().length > 0 && !busy && !blockReason;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Soumettre une version"
        data-testid="submit-dialog"
        className="w-full max-w-md rounded-xl border border-line bg-elevated p-5 shadow-2xl"
      >
        <h2 className="mb-1 text-base font-semibold text-ink">Soumettre une version</h2>
        <p className="mb-4 text-xs text-ink-muted">
          Cette version est figée (snapshot immuable) et coexiste avec les précédentes.
        </p>

        {blockReason && (
          <div
            data-testid="submit-block-reason"
            role="alert"
            className="mb-4 rounded-md border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-xs text-amber-200"
          >
            ⚠ {blockReason} — validez toutes les phrases avant de soumettre. Les
            pré-annotations ne comptent pas tant qu'elles ne sont pas validées.
          </div>
        )}

        <label className="mb-1 block text-xs font-medium text-ink-muted" htmlFor="version-name">
          Nom de la version *
        </label>
        <input
          id="version-name"
          ref={ref}
          data-testid="version-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex. v1 — relecture clauses de résiliation"
          className="mb-3 w-full rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-ink"
        />

        <label
          className="mb-1 block text-xs font-medium text-ink-muted"
          htmlFor="version-description"
        >
          Description (optionnelle)
        </label>
        <textarea
          id="version-description"
          data-testid="version-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Ce qui a changé, points d'attention pour le relecteur…"
          className="mb-3 w-full rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-ink"
        />

        <div className="mb-4 flex items-center gap-3 rounded-md border border-line bg-panel-muted/40 px-3 py-2 text-xs text-ink-muted">
          <span>{stats.clauses} clause{stats.clauses > 1 ? "s" : ""}</span>
          <span>·</span>
          <span>
            certitude moy.{" "}
            <span className="font-mono text-ink">
              {stats.meanCertainty == null ? "—" : stats.meanCertainty.toFixed(2)}
            </span>
          </span>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" data-testid="submit-cancel" onClick={onCancel}>
            Annuler
          </Button>
          <Button
            variant="primary"
            data-testid="submit-confirm"
            disabled={!canSubmit}
            onClick={() => onConfirm({ name: name.trim(), description: description.trim() })}
          >
            {busy ? "Soumission…" : "Soumettre"}
          </Button>
        </div>
      </div>
    </div>
  );
}
