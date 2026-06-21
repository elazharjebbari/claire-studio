"use client";

/**
 * Fil d'Ariane + bouton retour — situe l'utilisateur par rapport à la racine de
 * l'app et offre une remontée explicite (chaque segment cliquable) ainsi qu'un
 * retour arrière (← navigateur). Masqué sur les écrans immersifs plein écran
 * (workspace d'annotation, revue). navigation.md §2 (profondeur ≤ 3 clics).
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Home } from "lucide-react";
import { useProject } from "@/lib/api/hooks";

const ADMIN_LABELS: Record<string, string> = {
  admin: "Administration",
  projects: "Campagnes",
  corpora: "Corpus",
  schemes: "Schémas",
  preannotations: "Pré-annotations",
  translations: "Traductions",
  exports: "Exports",
  users: "Utilisateurs",
  audit: "Audit",
};

const LABELS: Record<string, string> = {
  home: "Accueil",
  projects: "Projets",
  docs: "Documents",
  compare: "Comparer",
  settings: "Préférences",
  public: "Projets publiés",
  help: "Documentation",
  history: "Historique",
  insights: "Insights",
};

interface Crumb {
  label: string;
  href: string;
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const router = useRouter();
  const segs = pathname.split("/").filter(Boolean);

  // Écrans immersifs : pas de chrome de navigation secondaire.
  const immersive = segs[0] === "annotate" || segs[0] === "review";

  // Résolution du nom de projet quand on est sous /projects/<slug>.
  const projectSlug = segs[0] === "projects" && segs[1] ? segs[1] : "";
  const { data: project } = useProject(projectSlug);

  if (immersive || segs.length === 0) return null;

  const isAdmin = segs[0] === "admin";
  const crumbs: Crumb[] = [{ label: "Accueil", href: "/home" }];

  segs.forEach((seg, i) => {
    if (i === 0 && seg === "home") return; // racine "Accueil" déjà ajoutée
    const href = "/" + segs.slice(0, i + 1).join("/");
    let label: string;
    if (isAdmin) {
      label = ADMIN_LABELS[seg] ?? seg;
    } else if (segs[0] === "projects" && i === 1) {
      label = project?.name ?? seg; // slug -> nom lisible
    } else {
      label = LABELS[seg] ?? decodeURIComponent(seg);
    }
    crumbs.push({ label, href });
  });

  return (
    <nav
      aria-label="Fil d'Ariane"
      data-testid="breadcrumbs"
      className="flex h-9 shrink-0 items-center gap-1 border-b border-line bg-bg px-3 text-sm"
    >
      <button
        type="button"
        onClick={() => router.back()}
        aria-label="Revenir en arrière"
        title="Revenir en arrière"
        className="mr-1 flex h-6 w-6 items-center justify-center rounded-md text-ink-muted hover:bg-panel-muted hover:text-ink"
      >
        <ArrowLeft size={15} aria-hidden />
      </button>
      <ol className="flex min-w-0 items-center gap-1">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.href} className="flex min-w-0 items-center gap-1">
              {i > 0 && <ChevronRight size={13} aria-hidden className="shrink-0 text-ink-muted" />}
              {last ? (
                <span aria-current="page" className="truncate font-medium text-ink">
                  {i === 0 && <Home size={13} aria-hidden className="mr-1 inline" />}
                  {c.label}
                </span>
              ) : (
                <Link
                  href={c.href}
                  className="flex items-center gap-1 truncate text-ink-muted hover:text-ink hover:underline"
                >
                  {i === 0 && <Home size={13} aria-hidden />}
                  {c.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
