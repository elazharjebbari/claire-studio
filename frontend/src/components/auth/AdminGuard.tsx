"use client";

/**
 * AdminGuard — garde de RÔLE pour la console d'administration (chantier G).
 *
 * Séparation nette admin / annotateur : les routes /admin/* sont réservées aux
 * rôles admin/owner. L'authentification est déjà assurée en amont par AuthGuard
 * (layout (app)) ; ce garde ajoute uniquement le contrôle de rôle, via /me.
 *
 * - Pendant le chargement de /me → état neutre « Vérification des droits… ».
 * - Rôle non admin → 403 explicite (pas de redirection silencieuse), avec retour
 *   vers l'espace annotateur.
 * - En mode mock, /me renvoie l'utilisateur de démo (admin) : la console reste
 *   accessible aux E2E, comme attendu.
 */

import Link from "next/link";
import { useMe } from "@/lib/api/hooks";
import { isAdminRole } from "@/lib/roles";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading } = useMe();

  if (isLoading) {
    return (
      <div
        data-testid="admin-checking"
        className="flex h-full items-center justify-center text-ink-muted"
      >
        Vérification des droits…
      </div>
    );
  }

  if (!isAdminRole(me?.role)) {
    return (
      <div
        data-testid="admin-forbidden"
        className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
      >
        <h1 className="text-lg font-semibold text-ink">Accès réservé</h1>
        <p className="max-w-sm text-sm text-ink-muted">
          La console d’administration est réservée aux administrateurs. Votre rôle
          actuel ne dispose pas de ces droits.
        </p>
        <Link
          href="/home"
          className="inline-flex items-center rounded-md border border-line bg-panel px-3 py-1.5 text-sm font-medium hover:bg-panel-muted"
        >
          Retour à l’espace d’annotation
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
