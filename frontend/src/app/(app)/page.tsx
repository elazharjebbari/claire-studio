"use client";

/** Accueil — explication courte du produit + reprise rapide (navigation.md §1, §5). */

import Link from "next/link";
import { useAssignments, useProjects } from "@/lib/api/hooks";
import { Panel, Button, StatusPill } from "@/components/ui/primitives";

export default function HomePage() {
  const { data: projects } = useProjects();
  const { data: assignments } = useAssignments("claudette-gold-v1");
  // Défensif : une réponse inattendue (liste nue, erreur, champ manquant) ne doit
  // jamais white-screener l'accueil.
  const assignmentList = assignments?.results ?? [];
  const projectList = projects?.results ?? [];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-ink">CLAIRE Studio</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Atelier d’annotation de clauses contractuelles : segmentez le document en
        clauses, attribuez un thème (vocabulaire fermé), notez votre certitude, et
        appuyez-vous sur les pré-annotations LLM et l’overlay d’injustice CLAUDETTE pour
        repérer les zones sensibles. Tout se passe dans le workspace 3 panneaux.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Panel className="p-4">
          <h2 className="font-semibold text-ink">Reprendre le travail</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {assignmentList.map((a) => (
              <li key={a.id} className="flex items-center justify-between">
                <span className="text-sm text-ink">{a.document.title}</span>
                <div className="flex items-center gap-2">
                  <StatusPill status={a.status} />
                  {a.annotationId && (
                    <Link href={`/annotate/${a.annotationId}`}>
                      <Button variant="primary">Annoter</Button>
                    </Link>
                  )}
                </div>
              </li>
            ))}
            {assignmentList.length === 0 && (
              <li className="text-sm text-ink-muted">Aucune assignation pour l’instant.</li>
            )}
          </ul>
        </Panel>

        <Panel className="p-4">
          <h2 className="font-semibold text-ink">Mes projets</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {projects?.results.map((p) => (
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
