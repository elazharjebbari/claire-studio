"use client";

/** Barre latérale repliable — navigation primaire contextuelle au projet (navigation.md §2). */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useUiStore } from "@/store/ui";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

function projectNav(slug: string | null): NavItem[] {
  const p = slug ?? "claudette-gold-v1";
  return [
    { href: `/projects/${p}`, label: "Tableau de bord", icon: "▣" },
    { href: `/projects/${p}/docs`, label: "Documents", icon: "▤" },
    { href: `/projects`, label: "Mes projets", icon: "▢" },
    { href: `/compare`, label: "Comparer", icon: "⇄" },
    { href: `/settings`, label: "Préférences", icon: "⚙" },
  ];
}

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Console admin", icon: "★" },
  { href: "/admin/corpora", label: "Corpus", icon: "⛁" },
  { href: "/admin/schemes", label: "Schémas", icon: "✎" },
  { href: "/admin/projects", label: "Campagnes", icon: "▦" },
  { href: "/admin/preannotations", label: "Pré-annotations", icon: "✦" },
  { href: "/admin/translations", label: "Traductions", icon: "🌐" },
  { href: "/admin/exports", label: "Exports", icon: "⤓" },
  { href: "/admin/users", label: "Utilisateurs", icon: "☺" },
  { href: "/admin/audit", label: "Audit", icon: "⏱" },
];

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const project = useUiStore((s) => s.currentProjectSlug);
  const pathname = usePathname();
  const items = projectNav(project);

  return (
    <nav
      aria-label="Navigation principale"
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-line bg-elevated transition-all",
        collapsed ? "w-14" : "w-56",
      )}
    >
      <div className="flex items-center justify-between px-3 py-3">
        {!collapsed && (
          <Link href="/" className="font-semibold text-ink">
            CLAIRE<span className="text-accent"> Studio</span>
          </Link>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Déplier la barre latérale" : "Replier la barre latérale"}
          aria-expanded={!collapsed}
          className="rounded-md p-1.5 text-ink-muted hover:bg-panel-muted hover:text-ink"
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <ul className="flex flex-col gap-0.5 px-2">
        {items.map((it) => {
          const active = pathname === it.href;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                  active ? "bg-panel-muted text-ink" : "text-ink-muted hover:bg-panel-muted hover:text-ink",
                )}
              >
                <span aria-hidden className="w-4 text-center">
                  {it.icon}
                </span>
                {!collapsed && <span className="truncate">{it.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto border-t border-line px-2 py-2">
        {!collapsed && (
          <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            Administration
          </p>
        )}
        <ul className="flex flex-col gap-0.5">
          {ADMIN_NAV.slice(0, collapsed ? 1 : ADMIN_NAV.length).map((it) => {
            const active = pathname === it.href;
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-panel-muted text-ink"
                      : "text-ink-muted hover:bg-panel-muted hover:text-ink",
                  )}
                >
                  <span aria-hidden className="w-4 text-center">
                    {it.icon}
                  </span>
                  {!collapsed && <span className="truncate">{it.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
