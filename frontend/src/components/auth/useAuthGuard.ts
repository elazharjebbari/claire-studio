"use client";

/**
 * Garde d'authentification (MODE RÉEL, auto-login DÉSACTIVÉ).
 *
 * Si on est en mode réel, que l'auto-login n'est pas activé et qu'aucun access
 * token n'est stocké → redirige vers /login en mémorisant la page demandée
 * (?next=...), pour y revenir après connexion.
 *
 * En mode mock OU quand l'auto-login est activé, le hook est inerte (les E2E ne
 * sont jamais redirigés ; l'auto-login gère déjà l'obtention du token).
 */

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { tokenStore } from "@/lib/api/client";
import { AUTO_LOGIN_ENABLED, MOCKS_ENABLED } from "@/lib/env";

/** Vrai quand le rendu peut continuer (autorisé, ou garde inactive). */
export function useAuthGuard(): boolean {
  const router = useRouter();
  const pathname = usePathname();
  const guardActive = !MOCKS_ENABLED && !AUTO_LOGIN_ENABLED;
  const [allowed, setAllowed] = useState(!guardActive);

  useEffect(() => {
    if (!guardActive) {
      setAllowed(true);
      return;
    }
    if (tokenStore.getAccess()) {
      setAllowed(true);
      return;
    }
    const next = encodeURIComponent(pathname || "/");
    router.replace(`/login?next=${next}`);
    setAllowed(false);
  }, [guardActive, pathname, router]);

  return allowed;
}
