"use client";

/** Écran public (chantier F) — liste des projets dont les résultats sont publiés. */

import Link from "next/link";
import { usePublicProjects } from "@/lib/api/hooks";
import { Panel } from "@/components/ui/primitives";

export default function PublicProjectsPage() {
  const { data } = usePublicProjects();
  const projects = data?.results ?? [];

  return (
    <main className="theme-light min-h-screen bg-bg text-ink">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
        <Link href="/welcome" className="text-lg font-semibold">
          <span className="font-display font-light tracking-[0.12em]">Pactiva</span>
        </Link>
        <Link href="/login" className="text-sm text-ink-muted hover:text-ink">
          Se connecter
        </Link>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-6">
        <h1 className="text-2xl font-semibold">Projets publiés</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Résultats d'annotation rendus publics par leurs responsables (lecture seule,
          agrégats). Les projets privés ne sont jamais exposés.
        </p>

        <ul className="mt-6 flex flex-col gap-3" data-testid="public-projects">
          {projects.map((p) => (
            <li key={p.slug}>
              <Link href={`/public/${p.slug}`}>
                <Panel className="flex items-center justify-between p-4 transition-colors hover:border-accent/50">
                  <div>
                    <h2 className="font-semibold text-ink">{p.name}</h2>
                    <p className="text-xs text-ink-muted">corpus : {p.corpusSlug}</p>
                  </div>
                  <span className="text-sm text-accent">Voir les résultats →</span>
                </Panel>
              </Link>
            </li>
          ))}
          {projects.length === 0 && (
            <li className="text-sm text-ink-muted" data-testid="public-empty">
              Aucun projet publié pour le moment.
            </li>
          )}
        </ul>
      </section>
    </main>
  );
}
