"use client";

/** Barre latérale repliable — navigation primaire contextuelle au projet (navigation.md §2). */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  LayoutDashboard,
  FileText,
  FolderKanban,
  Globe,
  GitCompareArrows,
  Settings2,
  ShieldCheck,
  Database,
  Tags,
  ClipboardList,
  Sparkles,
  Languages,
  Download,
  Users,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/brand/Logo";
import { useUiStore } from "@/store/ui";
import { useCurrentProjectSlug } from "@/lib/useCurrentProject";
import { useMe } from "@/lib/api/hooks";
import { isAdminRole } from "@/lib/roles";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Plus de slug en dur (H2) : les liens propres au projet n'apparaissent que si un
// projet courant est résolu ; sinon la nav reste générique (projets, comparer…).
function projectNav(slug: string | undefined): NavItem[] {
  const items: NavItem[] = [{ href: "/home", label: "Accueil", icon: Home }];
  if (slug) {
    items.push({ href: `/projects/${slug}`, label: "Tableau de bord", icon: LayoutDashboard });
    items.push({ href: `/projects/${slug}/docs`, label: "Documents", icon: FileText });
  }
  items.push({ href: `/projects`, label: "Mes projets", icon: FolderKanban });
  items.push({ href: `/public`, label: "Projets publiés", icon: Globe });
  items.push({ href: `/compare`, label: "Comparer", icon: GitCompareArrows });
  items.push({ href: `/settings`, label: "Préférences", icon: Settings2 });
  return items;
}

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Console admin", icon: ShieldCheck },
  { href: "/admin/corpora", label: "Corpus", icon: Database },
  { href: "/admin/schemes", label: "Schémas", icon: Tags },
  { href: "/admin/projects", label: "Campagnes", icon: ClipboardList },
  { href: "/admin/preannotations", label: "Pré-annotations", icon: Sparkles },
  { href: "/admin/translations", label: "Traductions", icon: Languages },
  { href: "/admin/exports", label: "Exports", icon: Download },
  { href: "/admin/users", label: "Utilisateurs", icon: Users },
  { href: "/admin/audit", label: "Audit", icon: ScrollText },
];

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const project = useCurrentProjectSlug();
  const pathname = usePathname();
  const items = projectNav(project);
  // Séparation admin / annotateur (chantier G) : la section Administration n'est
  // visible que pour les rôles admin/owner ; l'annotateur garde un espace focalisé.
  const { data: me } = useMe();
  const isAdmin = isAdminRole(me?.role);

  const renderItem = (it: NavItem, dense = false) => {
    const active = pathname === it.href;
    const Icon = it.icon;
    return (
      <li key={it.href}>
        <Link
          href={it.href}
          aria-current={active ? "page" : undefined}
          title={collapsed ? it.label : undefined}
          className={cn(
            "flex items-center gap-3 rounded-md px-2.5 text-sm transition-colors",
            dense ? "py-1.5" : "py-2",
            active ? "bg-panel-muted text-ink" : "text-ink-muted hover:bg-panel-muted hover:text-ink",
          )}
        >
          <Icon size={16} aria-hidden className="shrink-0" />
          {!collapsed && <span className="truncate">{it.label}</span>}
        </Link>
      </li>
    );
  };

  return (
    <nav
      aria-label="Navigation principale"
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-line bg-elevated transition-all",
        collapsed ? "w-14" : "w-56",
      )}
    >
      <div className="flex items-center justify-between px-3 py-3">
        <Link href="/home" aria-label="Pactiva — accueil" className="text-ink">
          <Logo size={20} withWordmark={!collapsed} />
        </Link>
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

      <ul className="flex flex-col gap-0.5 px-2">{items.map((it) => renderItem(it))}</ul>

      {isAdmin && (
        <div className="mt-auto border-t border-line px-2 py-2" data-testid="admin-nav">
          {!collapsed && (
            <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              Administration
            </p>
          )}
          <ul className="flex flex-col gap-0.5">
            {ADMIN_NAV.slice(0, collapsed ? 1 : ADMIN_NAV.length).map((it) => renderItem(it, true))}
          </ul>
        </div>
      )}
    </nav>
  );
}
