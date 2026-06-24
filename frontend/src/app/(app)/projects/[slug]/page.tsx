"use client";

/** Tableau de bord projet — Ma session, progression, IAA, activité (F4 / ADR-001). */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useProjectDocuments,
  useProject,
  useProjectProgress,
  useActivity,
  useMe,
} from "@/lib/api/hooks";
import { createAnnotation } from "@/lib/api/endpoints";
import { isAdminRole } from "@/lib/roles";
import { Panel, Button } from "@/components/ui/primitives";
import { IaaDashboard } from "@/components/projects/IaaDashboard";
import { ConcordancePanel } from "@/components/projects/ConcordancePanel";
import { DocStatusBadge } from "@/components/projects/DocStatusBadge";
import { ProjectLockControl } from "@/components/projects/ProjectLockControl";
import { useUiStore } from "@/store/ui";

export default function ProjectDashboard({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const { data: project } = useProject(params.slug);
  const { data: progress } = useProjectProgress(params.slug);
  const { data: me } = useMe();
  // Mes documents (1 entrée/document) — JAMAIS l'union des assignations (anti-doublon).
  const { data: docs } = useProjectDocuments(params.slug, { mine: true });
  const { data: activity } = useActivity(params.slug);
  const setProject = useUiStore((s) => s.setCurrentProject);
  const isAdmin = isAdminRole(me?.role);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => setProject(params.slug), [params.slug, setProject]);

  // Ma session = mes documents assignés (ou déjà commencés). Chacun annote seul.
  const mine = (docs?.results ?? []).filter(
    (d) => d.mySession?.assigned || (d.mySession?.status && d.mySession.status !== "unstarted"),
  );

  async function open(externalId: string) {
    if (opening) return;
    setOpening(externalId);
    try {
      // Ouvre TOUJOURS MA session (idempotent), jamais celle d'un autre.
      const ann = await createAnnotation({ project: params.slug, document: externalId });
      router.push(`/annotate/${ann.id}`);
    } finally {
      setOpening(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">{project?.name ?? params.slug}</h1>
        <Link href={`/projects/${params.slug}/docs`}>
          <Button variant="outline">Voir les documents</Button>
        </Link>
      </div>

      {isAdmin && (
        <p className="mt-3 rounded-md border border-line bg-panel-muted px-3 py-2 text-xs text-ink-muted">
          Vous êtes administrateur. La <strong className="text-ink">supervision</strong>{" "}
          (matrice document × annotateur, avancement, accès en lecture aux sessions) est
          dans la{" "}
          <Link href="/admin/projects" className="text-accent hover:underline">
            Console admin → Campagnes
          </Link>
          . Ci-dessous : <strong className="text-ink">votre propre</strong> session d'annotation.
        </p>
      )}

      {/* Verrou de CAMPAGNE (admin) : gèle/dégèle toutes les sessions, avec confirmation. */}
      {isAdmin && project && (
        <div className="mt-4">
          <ProjectLockControl
            slug={params.slug}
            locked={Boolean(project.locked)}
            lockedBy={project.lockedBy}
          />
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-4">
        {[
          ["Documents", `${progress?.annotatedDocuments ?? 0}/${progress?.totalDocuments ?? 0}`],
          ["Soumis", progress?.submittedDocuments ?? 0],
          ["Approuvés", progress?.approvedDocuments ?? 0],
          ["IAA", progress?.iaa != null ? progress.iaa.toFixed(2) : "—"],
        ].map(([label, value]) => (
          <Panel key={label} className="p-4 text-center">
            <div className="text-2xl font-semibold text-ink">{value}</div>
            <div className="text-xs uppercase text-ink-muted">{label}</div>
          </Panel>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Panel className="p-4">
          <h2 className="mb-1 font-semibold text-ink">Ma session</h2>
          <p className="mb-2 text-xs text-ink-muted">
            Vos documents à annoter, sur <strong className="text-ink">votre</strong> session
            personnelle (1 ligne par document).
          </p>
          <ul className="flex flex-col gap-2">
            {mine.map((d) => (
              <li key={d.document.id} className="flex items-center justify-between text-sm">
                <span className="truncate text-ink">{d.document.title}</span>
                <div className="flex items-center gap-2">
                  <DocStatusBadge
                    status={d.mySession?.status ?? "unstarted"}
                    locked={Boolean(d.mySession?.locked) || Boolean(project?.locked)}
                  />
                  <button
                    type="button"
                    disabled={opening === d.document.externalId}
                    onClick={() => open(d.document.externalId)}
                    data-testid={`open-${d.document.externalId}`}
                    className="text-accent hover:underline disabled:opacity-50"
                  >
                    {opening === d.document.externalId ? "Ouverture…" : "Annoter →"}
                  </button>
                </div>
              </li>
            ))}
            {mine.length === 0 && (
              <li className="text-sm text-ink-muted">
                Rien ne vous est encore assigné sur cette campagne.
              </li>
            )}
          </ul>
        </Panel>

        <Panel className="p-4">
          <h2 className="mb-2 font-semibold text-ink">Activité récente</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {(activity?.results ?? []).map((ev) => (
              <li key={ev.id} className="text-ink-muted">
                <span className="text-ink">{ev.actorName}</span> {ev.verb.replace(/_/g, " ")}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {progress?.concordance && (
        <div className="mt-6">
          <ConcordancePanel data={progress.concordance} />
        </div>
      )}

      <div className="mt-6">
        {progress?.iaaDetail ? (
          <IaaDashboard detail={progress.iaaDetail} />
        ) : (
          <Panel className="p-4 text-sm text-ink-muted" data-testid="iaa-dashboard-empty">
            L’accord inter-annotateurs sera calculé dès qu’au moins deux annotateurs auront
            soumis le même document.
          </Panel>
        )}
      </div>
    </div>
  );
}
