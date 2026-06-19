"use client";

/**
 * ShareLinkDialog (points 4b/7) — génère un lien de partage signé expirable pour
 * inviter un collaborateur. À l'ouverture du lien, l'utilisateur AUTHENTIFIÉ rejoint
 * le projet (membership) — jamais d'accès anonyme (cf. dossier 06).
 */

import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { useCreateShareLink } from "@/lib/api/hooks";

export function ShareLinkDialog({ projectSlug, onClose }: { projectSlug: string; onClose: () => void }) {
  const create = useCreateShareLink(projectSlug);
  const [role, setRole] = useState<"annotator" | "reviewer">("annotator");
  const [days, setDays] = useState(7);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generate() {
    const expiresAt = new Date(Date.now() + days * 864e5).toISOString();
    create.mutate(
      { roleGranted: role, expiresAt },
      { onSuccess: (res) => setLink(res.url) },
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Inviter un collaborateur"
        data-testid="share-dialog"
        className="w-full max-w-md rounded-xl border border-line bg-elevated p-5 shadow-2xl"
      >
        <h2 className="mb-1 text-base font-semibold text-ink">Inviter à collaborer</h2>
        <p className="mb-4 text-xs text-ink-muted">
          Génère un lien signé expirable. L'invité rejoint le projet via son compte
          authentifié (aucun accès anonyme).
        </p>

        <div className="mb-3 flex items-center gap-3">
          <label className="text-xs text-ink-muted" htmlFor="share-role">
            Rôle
          </label>
          <select
            id="share-role"
            data-testid="share-role"
            value={role}
            onChange={(e) => setRole(e.target.value as "annotator" | "reviewer")}
            className="rounded-md border border-line bg-panel px-2 py-1 text-sm text-ink"
          >
            <option value="annotator">Annotateur</option>
            <option value="reviewer">Relecteur</option>
          </select>
          <label className="ml-2 text-xs text-ink-muted" htmlFor="share-days">
            Expire dans
          </label>
          <select
            id="share-days"
            data-testid="share-days"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-md border border-line bg-panel px-2 py-1 text-sm text-ink"
          >
            <option value={1}>1 j</option>
            <option value={7}>7 j</option>
            <option value={30}>30 j</option>
          </select>
        </div>

        {link ? (
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <input
                readOnly
                data-testid="share-link"
                value={link}
                className="flex-1 rounded-md border border-line bg-panel px-2 py-1 text-xs text-ink"
              />
              <Button
                variant="subtle"
                data-testid="share-copy"
                onClick={() => {
                  navigator.clipboard?.writeText(link).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? "Copié ✓" : "Copier"}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" data-testid="share-cancel" onClick={onClose}>
            Fermer
          </Button>
          <Button
            variant="primary"
            data-testid="share-generate"
            disabled={create.isPending}
            onClick={generate}
          >
            {create.isPending ? "Génération…" : "Générer le lien"}
          </Button>
        </div>
      </div>
    </div>
  );
}
