"use client";

/**
 * UserMenu — nom d'utilisateur + menu déroulant (sous le nom) avec Paramètres et
 * Déconnexion. Présent dans la TopBar, donc disponible depuis TOUS les écrans applicatifs
 * (y compris le workspace d'annotation). Accessible : bouton aria-haspopup/expanded, menu
 * role=menu, fermeture par clic extérieur et Échap.
 *
 * Déconnexion : purge les jetons (tokenStore.clear via api.logout), VIDE le cache React
 * Query (évite d'exposer des données d'un compte au suivant) et recharge `/login` (reset
 * complet de l'état mémoire — stores Zustand inclus).
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut, Settings, UserCircle } from "lucide-react";

import { useMe } from "@/lib/api/hooks";
import { logout as apiLogout } from "@/lib/api/endpoints";
import { Badge } from "@/components/ui/primitives";

export function UserMenu() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onLogout = () => {
    apiLogout(); // purge les jetons (localStorage)
    qc.clear(); // vide tout le cache de requêtes (pas de fuite inter-comptes)
    // Rechargement dur de /login : reset complet de l'état mémoire (Zustand, etc.).
    window.location.assign("/login");
  };

  const name = me?.displayName ?? me?.username ?? "—";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        data-testid="user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border border-line bg-panel px-2 py-1 text-sm text-ink hover:bg-panel-muted"
      >
        <UserCircle size={16} aria-hidden className="text-ink-muted" />
        <span className="max-w-[12rem] truncate">{name}</span>
        {me?.role && <Badge>{me.role}</Badge>}
        <ChevronDown
          size={14}
          aria-hidden
          className={"text-ink-muted transition-transform " + (open ? "rotate-180" : "")}
        />
      </button>

      {open && (
        <div
          role="menu"
          data-testid="user-menu"
          aria-label="Menu utilisateur"
          className="absolute right-0 z-50 mt-1 w-60 overflow-hidden rounded-md border border-line bg-elevated shadow-xl"
        >
          <div className="border-b border-line px-3 py-2">
            <div className="truncate text-sm font-medium text-ink">{name}</div>
            {me?.email && <div className="truncate text-xs text-ink-muted">{me.email}</div>}
          </div>
          <Link
            href="/settings"
            role="menuitem"
            data-testid="user-menu-settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-panel-muted"
          >
            <Settings size={15} aria-hidden className="text-ink-muted" /> Paramètres
          </Link>
          <button
            type="button"
            role="menuitem"
            data-testid="user-menu-logout"
            onClick={onLogout}
            className="flex w-full items-center gap-2 border-t border-line px-3 py-2 text-left text-sm text-danger hover:bg-danger/10"
          >
            <LogOut size={15} aria-hidden /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
