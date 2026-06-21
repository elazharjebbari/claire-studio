"use client";

/**
 * « Mes annotations » — file de travail de l'annotateur (plan §F3).
 * Accès **robuste et fiable** au document à annoter : le bouton n'ouvre pas un id
 * d'annotation pré-câblé (fragile) mais appelle `createAnnotation` (get_or_create
 * INV-4, idempotent) qui garantit/retrouve MA session puis redirige. Gère erreurs
 * réseau (réessai) sans perte ni double création.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMe, useAssignments } from "@/lib/api/hooks";
import { useCurrentProjectSlug } from "@/lib/useCurrentProject";
import { createAnnotation } from "@/lib/api/endpoints";
import { Panel, Button, StatusPill } from "@/components/ui/primitives";
import type { Assignment } from "@/types/contract";

const TODO = ["pending", "unstarted", "unassigned", ""];
const DOING = ["in_progress", "draft"];
const DONE = ["done", "submitted", "in_review", "approved"];

export default function WorkQueue() {
  const slug = useCurrentProjectSlug();
  const { data: me } = useMe();
  const { data: assignments, isLoading } = useAssignments(slug);
  const router = useRouter();
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mine = (assignments?.results ?? []).filter(
    (a) => !me || a.assigneeId === String(me.id),
  );
  const groups: Array<{ key: string; label: string; items: Assignment[] }> = [
    { key: "doing", label: "En cours", items: mine.filter((a) => DOING.includes(a.status)) },
    { key: "todo", label: "À faire", items: mine.filter((a) => TODO.includes(a.status)) },
    { key: "done", label: "Terminé", items: mine.filter((a) => DONE.includes(a.status)) },
  ];

  async function open(a: Assignment) {
    if (!slug) return;
    setOpening(a.id);
    setError(null);
    try {
      // INV-4 : garantit/retrouve MA session pour ce document, puis ouvre.
      const ann = await createAnnotation({ project: slug, document: a.document.externalId });
      router.push(`/annotate/${ann.id}`);
    } catch {
      setError(`Impossible d'ouvrir « ${a.document.title} ». Vérifiez votre connexion et réessayez.`);
      setOpening(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Mes annotations</h1>
      <p className="mt-0.5 text-sm text-ink-muted">
        Vos documents à annoter sur votre <strong className="text-ink">session personnelle</strong>.
        Chacun annote seul ; la comparaison entre annotateurs sert l'accord (IAA) et la discussion.
      </p>

      {!slug && (
        <p className="mt-6 rounded-md border border-line bg-panel-muted px-3 py-2 text-sm text-ink-muted">
          Sélectionnez un projet dans la barre du haut pour voir vos documents assignés.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {slug && !isLoading && mine.length === 0 && (
        <p className="mt-6 rounded-md border border-line bg-panel-muted px-3 py-2 text-sm text-ink-muted">
          Rien ne vous est encore assigné sur ce projet. Un administrateur doit vous
          assigner des documents (Console admin → Campagnes → Assignations).
        </p>
      )}

      <div className="mt-6 space-y-6">
        {groups.map(
          (g) =>
            g.items.length > 0 && (
              <section key={g.key}>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
                  {g.label} · {g.items.length}
                </h2>
                <Panel className="divide-y divide-line">
                  {g.items.map((a) => (
                    <div key={a.id} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-ink">{a.document.title}</div>
                        <div className="text-xs text-ink-muted">
                          {a.document.nSentences} phrases · {a.document.language ?? "—"}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <StatusPill status={a.status} />
                        <Button
                          variant="primary"
                          disabled={opening === a.id}
                          onClick={() => open(a)}
                          data-testid={`open-${a.document.externalId}`}
                        >
                          {opening === a.id
                            ? "Ouverture…"
                            : g.key === "done"
                              ? "Revoir"
                              : a.annotationId
                                ? "Reprendre"
                                : "Annoter"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </Panel>
              </section>
            ),
        )}
      </div>
    </div>
  );
}
