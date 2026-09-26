"use client";

/** Documents d'un projet : 1 ligne PAR document + statut de MA session (ADR-001).
 *
 * Deux lectures selon le compte :
 * — annotateur : le statut de sa session et le bouton « Annoter » ;
 * — invité (accès reviewer) : les sessions EXISTANTES (A1, A2, A3) ouvertes en lecture d'un
 *   clic, sans assignation ni création de session — le projet de campagne est gelé, et
 *   l'annotation libre se fait dans le projet bac à sable, proposé en tête de page.
 */

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectDocuments, useProject, useMe, useProjects } from "@/lib/api/hooks";
import { createAnnotation } from "@/lib/api/endpoints";
import { isAdminRole } from "@/lib/roles";
import { Panel } from "@/components/ui/primitives";
import { DocStatusBadge } from "@/components/projects/DocStatusBadge";
import { ProjectLockControl } from "@/components/projects/ProjectLockControl";

export default function ProjectDocs({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const { data: project } = useProject(params.slug);
  const { data: me } = useMe();
  const isAdmin = isAdminRole(me?.role);
  const isGuest = !!me?.isGuest;
  // Un invité lit les sessions des autres : on demande la matrice (sans `mine`), que le
  // serveur n'expose qu'aux superviseurs et aux reviewers.
  const { data: docs } = useProjectDocuments(params.slug, { mine: !isGuest });
  const { data: projects } = useProjects();
  const [opening, setOpening] = useState<string | null>(null);

  const documents = docs?.results ?? [];
  // Projet où l'invité PEUT annoter (bac à sable) : le premier projet où il n'est pas gelé.
  const sandbox = isGuest
    ? (projects?.results ?? []).find((p) => p.slug !== params.slug && !p.locked)
    : undefined;
  const readOnly = isGuest || Boolean(project?.locked);

  async function open(externalId: string) {
    if (opening) return;
    setOpening(externalId);
    try {
      const ann = await createAnnotation({ project: params.slug, document: externalId });
      router.push(`/annotate/${ann.id}`);
    } finally {
      setOpening(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">
            Documents · {project?.name ?? params.slug}
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {isGuest
              ? "Cliquez sur un annotateur pour lire sa session, ou sur « Comparer » pour les voir côte à côte."
              : "Liste de travail : statut de ma session et accès à l'annotation (1 ligne par document)."}
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/admin/projects"
            data-testid="manage-campaign"
            className="shrink-0 rounded-md border border-line bg-panel px-3 py-1.5 text-sm font-medium text-ink hover:bg-panel-muted"
          >
            <span className="text-accent">Gérer la campagne</span> →
          </Link>
        )}
      </div>

      {isGuest && (
        <div
          data-testid="guest-banner"
          className="mb-4 rounded-md border border-line bg-panel px-3 py-2 text-xs text-ink-muted"
        >
          Lecture seule : cette campagne est gelée et ses {documents.length} documents sont
          annotés par A1, A2 et A3. Ouvrez une session pour la lire, la{" "}
          <Link href={`/projects/${params.slug}/gold`} className="text-accent hover:underline">
            Résolution GOLD
          </Link>{" "}
          pour voir comment le gold est construit.
          {sandbox && (
            <>
              {" "}Pour annoter vous-même, ouvrez{" "}
              <Link
                href={`/projects/${sandbox.slug}/docs`}
                data-testid="guest-sandbox-link"
                className="text-accent hover:underline"
              >
                {sandbox.name}
              </Link>{" "}
              : les 50 mêmes contrats vous y sont attribués.
            </>
          )}
        </div>
      )}

      {isAdmin && (
        <p className="mb-4 rounded-md border border-line bg-panel-muted px-3 py-2 text-xs text-ink-muted">
          Vous êtes administrateur. L'attribution aux annotateurs et la supervision se font
          dans la{" "}
          <Link href="/admin/projects" className="text-accent hover:underline">
            Console admin → Campagnes
          </Link>
          . Cette liste montre <strong className="text-ink">votre propre</strong> session.
        </p>
      )}
      {isAdmin && project && (
        <div className="mb-4">
          <ProjectLockControl
            slug={params.slug}
            locked={Boolean(project.locked)}
            lockedBy={project.lockedBy}
          />
        </div>
      )}
      <Panel className="divide-y divide-line">
        {documents.map((d) => {
          const status = d.mySession?.status ?? "unstarted";
          const assigned = d.mySession?.assigned;
          const sessions = (d.sessions ?? []).filter((s) => s.annotationId);
          return (
            <div key={d.document.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-medium text-ink">{d.document.title}</div>
                <div className="text-xs text-ink-muted">
                  {d.document.nSentences} phrases · {d.document.language}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {isGuest ? (
                  <>
                    {sessions.map((s) => (
                      <Link
                        key={s.annotatorId}
                        href={`/annotate/${s.annotationId}`}
                        data-testid={`read-session-${d.document.externalId}-${s.annotatorId}`}
                        title={`Lire la session de ${s.displayName}`}
                        className="rounded border border-line px-2 py-0.5 text-xs font-medium text-ink hover:bg-panel-muted"
                      >
                        {s.displayName.replace(/^Annotator\s*/, "")}
                      </Link>
                    ))}
                    {sessions.length === 0 && (
                      <span className="text-xs text-ink-muted">Aucune session</span>
                    )}
                    {sessions[0] && (
                      <Link
                        href={`/compare?a=${sessions[0].annotationId}&document=${encodeURIComponent(d.document.id)}&project=${encodeURIComponent(params.slug)}&doc=${encodeURIComponent(d.document.title)}`}
                        data-testid={`compare-doc-${d.document.externalId}`}
                        className="text-sm text-accent hover:underline"
                      >
                        Comparer →
                      </Link>
                    )}
                  </>
                ) : (
                  <>
                    <DocStatusBadge
                      status={status}
                      locked={Boolean(d.mySession?.locked) || Boolean(project?.locked)}
                    />
                    <button
                      type="button"
                      disabled={opening === d.document.externalId || readOnly}
                      onClick={() => open(d.document.externalId)}
                      data-testid={`open-doc-${d.document.externalId}`}
                      className="text-sm text-accent hover:underline disabled:opacity-50"
                    >
                      {opening === d.document.externalId
                        ? "Ouverture…"
                        : assigned || status !== "unstarted"
                          ? "Annoter →"
                          : "Annoter (libre) →"}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {documents.length === 0 && (
          <div className="px-4 py-6 text-sm text-ink-muted">Aucun document.</div>
        )}
      </Panel>
    </div>
  );
}
