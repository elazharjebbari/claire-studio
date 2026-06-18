"use client";

/** Tableau de bord projet — progression, mes assignations, IAA, activité (F4). */

import Link from "next/link";
import { useEffect } from "react";
import { useAssignments, useProject, useProjectProgress, useActivity } from "@/lib/api/hooks";
import { Panel, Button, StatusPill } from "@/components/ui/primitives";
import { useUiStore } from "@/store/ui";

export default function ProjectDashboard({ params }: { params: { slug: string } }) {
  const { data: project } = useProject(params.slug);
  const { data: progress } = useProjectProgress(params.slug);
  const { data: assignments } = useAssignments(params.slug);
  const { data: activity } = useActivity(params.slug);
  const setProject = useUiStore((s) => s.setCurrentProject);

  useEffect(() => setProject(params.slug), [params.slug, setProject]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">{project?.name ?? params.slug}</h1>
        <Link href={`/projects/${params.slug}/docs`}>
          <Button variant="outline">Voir les documents</Button>
        </Link>
      </div>

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
          <h2 className="mb-2 font-semibold text-ink">Mes assignations</h2>
          <ul className="flex flex-col gap-2">
            {assignments?.results.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-sm">
                <span className="text-ink">{a.document.title}</span>
                <div className="flex items-center gap-2">
                  <StatusPill status={a.status} />
                  {a.annotationId && (
                    <Link href={`/annotate/${a.annotationId}`} className="text-accent hover:underline">
                      Annoter →
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="p-4">
          <h2 className="mb-2 font-semibold text-ink">Activité récente</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {activity?.results.map((ev) => (
              <li key={ev.id} className="text-ink-muted">
                <span className="text-ink">{ev.actorName}</span> {ev.verb.replace(/_/g, " ")}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
