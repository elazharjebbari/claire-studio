"use client";

/**
 * CollabBar (points 4b/7) — présence ambiante + invitation, NON envahissante.
 * Avatars empilés des participants (couleur d'identité + initiale), voyant de
 * connexion (live/dégradé), bouton « Inviter ». S'affiche uniquement si le flag
 * `presence` est actif (l'UI se conforme aux feature flags). Progressive disclosure :
 * rien en solo, discret à plusieurs.
 */

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace";
import { useFeatureFlags } from "@/lib/api/hooks";
import { useLivePresence } from "@/lib/collab/useLivePresence";
import { readableTextColor } from "@/lib/tokens";
import { ShareLinkDialog } from "./ShareLinkDialog";

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

export function CollabBar({ projectSlug }: { projectSlug?: string }) {
  const annotationId = useWorkspaceStore((s) => s.annotationId);
  const { data: flags } = useFeatureFlags();
  const presenceEnabled = Boolean(flags?.presence);
  // Présence temps réel (WebSocket) si l'infra est active, sinon repli REST.
  const { participants: people, live } = useLivePresence(annotationId, presenceEnabled);
  const [shareOpen, setShareOpen] = useState(false);

  if (!presenceEnabled) return null;

  return (
    <div data-testid="collab-bar" className="flex items-center gap-2">
      <span
        data-testid="collab-status"
        data-live={live || undefined}
        title={live ? "Temps réel actif" : "Hors-ligne (synchronisation REST)"}
        className="flex items-center gap-1 text-[11px] text-ink-muted"
      >
        <span
          aria-hidden
          className={"h-2 w-2 rounded-full " + (live ? "bg-emerald-400" : "bg-ink-muted/50")}
        />
      </span>

      <div className="flex -space-x-1.5" role="group" aria-label="Participants">
        {people.slice(0, 4).map((p) => (
          <span
            key={p.userId}
            data-testid={`presence-${p.userId}`}
            title={`${p.name}${p.focusSentence != null ? ` · phrase ${p.focusSentence}` : ""}`}
            className="flex h-5 w-5 items-center justify-center rounded-full border border-elevated text-[9px] font-semibold"
            style={{ backgroundColor: p.color, color: readableTextColor(p.color) }}
          >
            {initials(p.name)}
          </span>
        ))}
        {people.length > 4 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-elevated bg-panel-muted text-[9px] text-ink-muted">
            +{people.length - 4}
          </span>
        )}
      </div>

      {projectSlug && (
        <button
          type="button"
          data-testid="collab-invite"
          onClick={() => setShareOpen(true)}
          title="Inviter un collaborateur (lien de partage)"
          className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11px] text-ink-muted hover:bg-panel-muted"
        >
          <UserPlus size={13} aria-hidden /> Inviter
        </button>
      )}

      {shareOpen && projectSlug && (
        <ShareLinkDialog projectSlug={projectSlug} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}
