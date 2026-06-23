"use client";

/**
 * « Mes annotations » — file de travail de l'annotateur (ADR-001).
 * Source : `useProjectDocuments({mine})` → MES documents (1 ligne/document), groupés
 * par le statut de MA session (`mySession.status`, reflet réel de l'annotation) — et
 * non plus par `assignment.status` (qui ne se mettait jamais à jour après soumission).
 * Ouverture **robuste** via `createAnnotation` (get_or_create INV-4) : garantit/retrouve
 * MA session puis redirige, sans perte ni double création.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectDocuments } from "@/lib/api/hooks";
import { useCurrentProjectSlug } from "@/lib/useCurrentProject";
import { createAnnotation } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { Panel, Button, StatusPill } from "@/components/ui/primitives";
import type { ProjectDocument } from "@/types/contract";

const DOING = ["in_progress", "draft"];
const DONE = ["done", "submitted", "in_review", "approved"];

export default function WorkQueue() {
  const slug = useCurrentProjectSlug();
  const { data: docs, isLoading } = useProjectDocuments(slug, { mine: true });
  const router = useRouter();
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mes documents = ceux qui me sont assignés (ou déjà commencés).
  const mine = useMemo(
    () =>
      (docs?.results ?? []).filter(
        (d) =>
          d.mySession?.assigned ||
          (d.mySession?.status && d.mySession.status !== "unstarted"),
      ),
    [docs],
  );
  const statusOf = (d: ProjectDocument) => d.mySession?.status ?? "unstarted";
  const groups: Array<{ key: string; label: string; items: ProjectDocument[] }> = [
    { key: "doing", label: "En cours", items: mine.filter((d) => DOING.includes(statusOf(d))) },
    {
      key: "todo",
      label: "À faire",
      items: mine.filter((d) => !DOING.includes(statusOf(d)) && !DONE.includes(statusOf(d))),
    },
    { key: "done", label: "Terminé", items: mine.filter((d) => DONE.includes(statusOf(d))) },
  ];

  async function open(d: ProjectDocument) {
    if (!slug) return;
    setOpening(d.document.externalId);
    setError(null);
    try {
      // INV-4 : garantit/retrouve MA session pour ce document, puis ouvre.
      const ann = await createAnnotation({ project: slug, document: d.document.externalId });
      if (!ann?.id) throw new Error("réponse serveur sans identifiant d'annotation");
      router.push(`/annotate/${ann.id}`);
    } catch (e) {
      // Cause réelle remontée (statut/détail) pour diagnostiquer au lieu d'un message opaque.
      const detail =
        e instanceof ApiError
          ? `HTTP ${e.status}${e.status === 401 || e.status === 403 ? " — accès refusé (reconnectez-vous)" : ""}`
          : e instanceof Error
            ? e.message
            : "erreur inconnue";
      setError(`Impossible d'ouvrir « ${d.document.title} » (${detail}). Réessayez ; si le problème persiste, signalez-le.`);
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
                  {g.items.map((d) => (
                    <div key={d.document.id} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-ink">{d.document.title}</div>
                        <div className="text-xs text-ink-muted">
                          {d.document.nSentences} phrases · {d.document.language ?? "—"}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <StatusPill status={statusOf(d)} />
                        <Button
                          variant="primary"
                          disabled={opening === d.document.externalId}
                          onClick={() => open(d)}
                          data-testid={`open-${d.document.externalId}`}
                        >
                          {opening === d.document.externalId
                            ? "Ouverture…"
                            : g.key === "done"
                              ? "Revoir"
                              : DOING.includes(statusOf(d))
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
