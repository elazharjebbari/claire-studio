"use client";

/**
 * Top bar — sélecteur de projet, ⌘K, avancement perso, bascule thème, cloche
 * d'activité, menu utilisateur (navigation.md §2).
 */

import { useEffect } from "react";
import Link from "next/link";
import { BookOpen, HelpCircle, Sun, Moon, ShieldCheck } from "lucide-react";
import { useUiStore } from "@/store/ui";
import { useMe, useProjects } from "@/lib/api/hooks";
import { isAdminRole } from "@/lib/roles";
import { ActivityBell } from "./ActivityBell";
import { Badge } from "@/components/ui/primitives";

export function TopBar() {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const setPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const currentProject = useUiStore((s) => s.currentProjectSlug);
  const setProject = useUiStore((s) => s.setCurrentProject);
  const { data: me } = useMe();
  const { data: projects } = useProjects();
  const isAdmin = isAdminRole(me?.role);

  // R4 — auto-sélection : dès que des projets sont chargés et qu'aucun n'est
  // courant, sélectionner (et persister) le premier. La nav projet-dépendante
  // (file de travail, breadcrumbs, schéma) résout ainsi sans manipulation.
  useEffect(() => {
    if (!currentProject && projects?.results?.length) {
      setProject(projects.results[0]!.slug);
    }
  }, [currentProject, projects, setProject]);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-elevated px-3">
      <label className="sr-only" htmlFor="project-select">
        Projet courant
      </label>
      <select
        id="project-select"
        data-testid="project-select"
        value={currentProject ?? ""}
        onChange={(e) => setProject(e.target.value || null)}
        className="rounded-md border border-line bg-panel px-2 py-1 text-sm text-ink"
      >
        <option value="">Sélectionner un projet…</option>
        {projects?.results.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        data-testid="open-command-palette"
        onClick={() => setPaletteOpen(true)}
        className="flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-1 text-sm text-ink-muted hover:text-ink"
        aria-label="Ouvrir la palette de commandes (Cmd+K)"
      >
        <span>Rechercher…</span>
        <kbd className="rounded bg-panel-muted px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        {isAdmin && (
          <Link
            href="/admin"
            data-testid="admin-console-link"
            aria-label="Console d'administration"
            title="Console d'administration (corpus, campagnes, assignations, utilisateurs…)"
            className="flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1 text-sm font-medium text-ink hover:bg-panel-muted"
          >
            <ShieldCheck size={15} aria-hidden className="text-accent" /> Console admin
          </Link>
        )}
        <Link
          href="/help"
          data-testid="docs-link"
          aria-label="Documentation"
          title="Documentation — comprendre le corpus & bien annoter"
          className="flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1 text-sm text-ink hover:bg-panel-muted"
        >
          <BookOpen size={15} aria-hidden /> Documentation
        </Link>
        <Link
          href="/help"
          data-testid="help-link"
          aria-label="Centre d'aide"
          title="Centre d'aide"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-panel text-ink hover:bg-panel-muted"
        >
          <HelpCircle size={16} aria-hidden />
        </Link>
        <ActivityBell />
        <button
          type="button"
          data-testid="theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Passer au thème clair" : "Passer au thème sombre"}
          className="flex items-center justify-center rounded-md border border-line bg-panel px-2 py-1 text-ink hover:bg-panel-muted"
        >
          {theme === "dark" ? <Sun size={15} aria-hidden /> : <Moon size={15} aria-hidden />}
        </button>

        <div className="flex items-center gap-2 rounded-md border border-line bg-panel px-2 py-1">
          <span className="text-sm text-ink">{me?.displayName ?? me?.username ?? "—"}</span>
          {me?.role && <Badge>{me.role}</Badge>}
        </div>
      </div>
    </header>
  );
}
