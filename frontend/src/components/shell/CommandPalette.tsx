"use client";

/**
 * Command palette (⌘K) — saut rapide vers un document, export, bascule thème,
 * aide (navigation.md §2). Ouverture clavier globale, navigation ↑/↓/Enter, Esc.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUiStore } from "@/store/ui";
import { useCurrentProjectSlug } from "@/lib/useCurrentProject";

interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

export function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const router = useRouter();
  // Projet courant résolu sans slug en dur (H2) : les sauts « projet » pointent
  // vers le projet courant, ou vers la liste des projets s'il n'y en a pas.
  const projectSlug = useCurrentProjectSlug();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = useMemo(
    () => [
      { id: "go-resume", label: "Reprendre le travail", hint: "annotate", run: () => router.push("/") },
      { id: "go-projects", label: "Aller aux projets", run: () => router.push("/projects") },
      {
        id: "go-dashboard",
        label: "Tableau de bord du projet",
        run: () => router.push(projectSlug ? `/projects/${projectSlug}` : "/projects"),
      },
      {
        id: "go-docs",
        label: "Liste des documents",
        run: () => router.push(projectSlug ? `/projects/${projectSlug}/docs` : "/projects"),
      },
      { id: "go-export", label: "Lancer un export", hint: "admin", run: () => router.push("/admin/exports") },
      { id: "go-compare", label: "Comparer deux annotations", run: () => router.push("/compare") },
      { id: "toggle-theme", label: "Basculer thème clair / sombre", run: toggleTheme },
      { id: "go-settings", label: "Préférences", run: () => router.push("/settings") },
    ],
    [router, toggleTheme, projectSlug],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.hint?.includes(q));
  }, [commands, query]);

  // Raccourci global ⌘K / Ctrl+K.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === "Escape" && open) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Palette de commandes"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-line bg-elevated shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const cmd = filtered[active];
              if (cmd) {
                cmd.run();
                setOpen(false);
              }
            }
          }}
          placeholder="Tapez une commande ou cherchez…"
          aria-label="Commande"
          className="w-full border-b border-line bg-transparent px-4 py-3 text-ink placeholder:text-ink-muted"
        />
        <ul role="listbox" className="max-h-80 overflow-auto py-1">
          {filtered.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => {
                  c.run();
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${
                  i === active ? "bg-panel-muted text-ink" : "text-ink-muted"
                }`}
              >
                <span>{c.label}</span>
                {c.hint && <span className="text-xs text-ink-muted">{c.hint}</span>}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-sm text-ink-muted">Aucune commande</li>
          )}
        </ul>
      </div>
    </div>
  );
}
