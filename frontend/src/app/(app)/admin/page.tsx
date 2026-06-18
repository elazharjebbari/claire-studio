"use client";

/** Console admin — pilotage (navigation.md §1, réservé admin/owner). */

import Link from "next/link";
import { Panel } from "@/components/ui/primitives";

const SECTIONS: Array<[string, string, string]> = [
  ["/admin/corpora", "Corpus & documents", "Import CLAUDETTE, gestion des pièces."],
  ["/admin/schemes", "Schémas d'annotation", "Vocab fermé versionné, clone (F11)."],
  ["/admin/projects", "Campagnes", "Membres, assignations, consignes."],
  ["/admin/preannotations", "Pré-annotations", "Import & mapping LLM claude/codex (F2)."],
  ["/admin/translations", "Traductions", "Dossiers file-based (F8)."],
  ["/admin/exports", "Exports", "Multi-format explicatif (F5)."],
  ["/admin/users", "Utilisateurs", "Rôles & accès."],
  ["/admin/audit", "Audit", "Journal d'activité global (F4)."],
];

export default function AdminHome() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-4 text-xl font-semibold text-ink">Console d’administration</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(([href, title, desc]) => (
          <Link key={href} href={href}>
            <Panel className="h-full p-4 transition-colors hover:border-accent/50">
              <h2 className="font-semibold text-ink">{title}</h2>
              <p className="mt-1 text-sm text-ink-muted">{desc}</p>
            </Panel>
          </Link>
        ))}
      </div>
    </div>
  );
}
