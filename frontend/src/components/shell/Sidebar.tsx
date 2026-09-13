"use client";

/** Barre latérale repliable — navigation primaire contextuelle au projet (navigation.md §2). */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  Home,
  ListChecks,
  LayoutDashboard,
  FileText,
  BookOpenCheck,
  FlaskConical,
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
  Gavel,
  BarChart3,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/brand/Logo";
import { usePrefsStore } from "@/store/prefs";
import { useUiStore } from "@/store/ui";
import { useCurrentProjectSlug } from "@/lib/useCurrentProject";
import { useMe } from "@/lib/api/hooks";
import { isAdminRole } from "@/lib/roles";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

// Espaces de navigation NOMMÉS (ADR-001 : lever l'ambiguïté) — on distingue
// « Ma session » (où j'annote, mon travail) de « Collaboration » (comparer/échanger)
// et de « Corpus & projets ». Plus de slug en dur (H2) : les liens propres au projet
// n'apparaissent que si un projet courant est résolu.
function navGroups(slug: string | undefined): NavGroup[] {
  const session: NavItem[] = [{ href: "/work", label: "Mes annotations", icon: ListChecks }];
  if (slug) {
    session.push({ href: `/projects/${slug}`, label: "Tableau de bord", icon: LayoutDashboard });
  }
  const corpus: NavItem[] = [];
  if (slug) corpus.push({ href: `/projects/${slug}/docs`, label: "Documents", icon: FileText });
  if (slug)
    corpus.push({
      href: `/projects/${slug}/analysis`,
      label: "Analyse & qualité",
      icon: BarChart3,
    });
  if (slug) corpus.push({ href: `/projects/${slug}/gold`, label: "Résolution GOLD", icon: Gavel });
  // Le Lab (jeux de données figés + expériences) suit l'analyse : c'est la même
  // matière, vue sous l'angle de la production de résultats scientifiques.
  if (slug) corpus.push({ href: `/projects/${slug}/lab`, label: "Lab", icon: FlaskConical });
  // Les résultats de la campagne finale, organisés par question de recherche : le bout
  // de la chaîne (annoter → résoudre → mesurer → publier).
  if (slug)
    corpus.push({
      href: `/projects/${slug}/paper`,
      label: "Résultats de l'article",
      icon: BookOpenCheck,
    });
  corpus.push({ href: `/projects`, label: "Mes projets", icon: FolderKanban });
  corpus.push({ href: `/public`, label: "Projets publiés", icon: Globe });

  return [
    { items: [{ href: "/home", label: "Accueil", icon: Home }] },
    { label: "Ma session", items: session },
    { label: "Corpus & projets", items: corpus },
    { label: "Collaboration", items: [{ href: `/compare`, label: "Comparer", icon: GitCompareArrows }] },
    { items: [{ href: `/settings`, label: "Préférences", icon: Settings2 }] },
  ];
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
  // État PAR COMPTE (synchronisé serveur) : barre latérale repliée (desktop uniquement).
  const collapsed = usePrefsStore((s) => s.prefs.panels.sidebarCollapsed);
  const setPanel = usePrefsStore((s) => s.setPanel);
  const toggle = () => setPanel("sidebarCollapsed", !collapsed);
  // État transitoire (jamais persisté) : tiroir de navigation sous le point de rupture
  // `md` (768px). En dessous, la sidebar en flux (`w-56` fixes) ne laisse quasiment plus
  // de place au contenu — cf. audit UI Lab, docs/pactiva-lab-ui/01_AUDIT.md §2.1.
  const mobileOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileOpen = useUiStore((s) => s.setMobileNavOpen);
  const project = useCurrentProjectSlug();
  const pathname = usePathname();
  const groups = navGroups(project);
  // Séparation admin / annotateur (chantier G) : la section Administration n'est
  // visible que pour les rôles admin/owner ; l'annotateur garde un espace focalisé.
  const { data: me } = useMe();
  const isAdmin = isAdminRole(me?.role);

  // Le tiroir mobile ne doit jamais survivre à une navigation ni à Échap — sinon il
  // reste ouvert par-dessus la page suivante, une confusion classique de ce pattern.
  useEffect(() => {
    setMobileOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, setMobileOpen]);

  // Sur mobile, le tiroir est toujours en labels complets (c'est un panneau plein,
  // pas une barre qui dispute l'espace au contenu) : le repli icône-seule reste un
  // réglage desktop. `collapsed` seul déciderait à tort de l'affichage des libellés
  // aussi dans le tiroir mobile si l'utilisateur avait replié la sidebar desktop.
  const showLabels = mobileOpen || !collapsed;

  const renderItem = (it: NavItem, dense = false) => {
    const active = pathname === it.href;
    const Icon = it.icon;
    return (
      <li key={it.href}>
        <Link
          href={it.href}
          aria-current={active ? "page" : undefined}
          title={showLabels ? undefined : it.label}
          className={cn(
            "flex items-center gap-3 rounded-md px-2.5 text-sm transition-colors",
            dense ? "py-1.5" : "py-2",
            active ? "bg-panel-muted text-ink" : "text-ink-muted hover:bg-panel-muted hover:text-ink",
          )}
        >
          <Icon size={16} aria-hidden className="shrink-0" />
          {showLabels && <span className="truncate">{it.label}</span>}
        </Link>
      </li>
    );
  };

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fermer la navigation"
          data-testid="app-sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 cursor-default bg-black/50 md:hidden"
        />
      )}
      <nav
        aria-label="Navigation principale"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full w-56 flex-col border-r border-line bg-elevated",
          "transition-transform duration-200 md:relative md:z-auto md:translate-x-0 md:transition-[width]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:w-14" : "md:w-56",
        )}
      >
        <div className="flex items-center justify-between px-3 py-3">
          <Link href="/home" aria-label="Pactiva — accueil" className="text-ink">
            <Logo size={20} withWordmark={showLabels} />
          </Link>
          <button
            type="button"
            data-testid="app-sidebar-toggle"
            onClick={toggle}
            aria-label={collapsed ? "Déplier la barre latérale" : "Replier la barre latérale"}
            aria-expanded={!collapsed}
            className="hidden rounded-md p-1.5 text-ink-muted hover:bg-panel-muted hover:text-ink md:block"
          >
            {collapsed ? "»" : "«"}
          </button>
          <button
            type="button"
            data-testid="app-sidebar-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer la navigation"
            className="rounded-md p-1.5 text-ink-muted hover:bg-panel-muted hover:text-ink md:hidden"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto px-2">
          {groups.map((g, gi) =>
            g.items.length === 0 ? null : (
              <div key={g.label ?? `g${gi}`}>
                {g.label && showLabels && (
                  <p className="px-2.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                    {g.label}
                  </p>
                )}
                <ul className="flex flex-col gap-0.5">{g.items.map((it) => renderItem(it))}</ul>
              </div>
            ),
          )}
        </div>

        {isAdmin && (
          <div className="mt-auto border-t border-line px-2 py-2" data-testid="admin-nav">
            {showLabels && (
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                Administration
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {ADMIN_NAV.slice(0, showLabels ? ADMIN_NAV.length : 1).map((it) => renderItem(it, true))}
            </ul>
          </div>
        )}
      </nav>
    </>
  );
}
