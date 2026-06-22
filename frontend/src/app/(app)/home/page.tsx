"use client";

/** Accueil applicatif (/home) — reprise rapide du travail (navigation.md §1, §5). */

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectDocuments, useProjects } from "@/lib/api/hooks";
import { useCurrentProjectSlug } from "@/lib/useCurrentProject";
import { createAnnotation } from "@/lib/api/endpoints";
import { Panel, Button, StatusPill } from "@/components/ui/primitives";

export default function HomePage() {
  const router = useRouter();
  const { data: projects } = useProjects();
  // Défensif : une réponse inattendue (liste nue, erreur, champ manquant) ne doit
  // jamais white-screener l'accueil.
  const projectList = projects?.results ?? [];
  // Projet « courant » résolu sans slug en dur (H2) : store UI → 1er projet API.
  const currentSlug = useCurrentProjectSlug();
  // ADR-001 : « Reprendre le travail » = MES documents (1 ligne/document), jamais
  // l'union des assignations (qui affichait tout pour un admin).
  const { data: docs } = useProjectDocuments(currentSlug, { mine: true });
  const mine = (docs?.results ?? []).filter(
    (d) => d.mySession?.assigned || (d.mySession?.status && d.mySession.status !== "unstarted"),
  );
  const [opening, setOpening] = useState<string | null>(null);

  async function open(externalId: string) {
    if (!currentSlug || opening) return;
    setOpening(externalId);
    try {
      const ann = await createAnnotation({ project: currentSlug, document: externalId });
      router.push(`/annotate/${ann.id}`);
    } finally {
      setOpening(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold text-ink">Atelier Pactiva</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Atelier d’annotation de clauses contractuelles : segmentez le document en
        clauses, attribuez un thème (vocabulaire fermé), notez votre certitude, et
        appuyez-vous sur les pré-annotations LLM et l’overlay d’injustice CLAUDETTE pour
        repérer les zones sensibles. Tout se passe dans le workspace 3 panneaux.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Panel className="p-4">
          <h2 className="font-semibold text-ink">Reprendre le travail</h2>
          <p className="mt-0.5 text-xs text-ink-muted">Votre session personnelle (1 ligne par document).</p>
          <ul className="mt-3 flex flex-col gap-2">
            {mine.map((d) => (
              <li key={d.document.id} className="flex items-center justify-between">
                <span className="text-sm text-ink">{d.document.title}</span>
                <div className="flex items-center gap-2">
                  <StatusPill status={d.mySession?.status ?? "unstarted"} />
                  <Button
                    variant="primary"
                    disabled={opening === d.document.externalId}
                    onClick={() => open(d.document.externalId)}
                  >
                    {opening === d.document.externalId ? "Ouverture…" : "Annoter"}
                  </Button>
                </div>
              </li>
            ))}
            {mine.length === 0 && (
              <li className="text-sm text-ink-muted">Aucune assignation pour l’instant.</li>
            )}
          </ul>
        </Panel>

        <Panel className="p-4">
          <h2 className="font-semibold text-ink">Mes projets</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {projectList.map((p) => (
              <li key={p.slug} className="flex items-center justify-between">
                <span className="text-sm text-ink">{p.name}</span>
                <Link href={`/projects/${p.slug}`} className="text-sm text-accent hover:underline">
                  Ouvrir →
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
