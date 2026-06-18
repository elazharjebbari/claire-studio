"use client";

/**
 * Auto-login dev (mode réel uniquement).
 *
 * Idempotent / singleton de module : robuste au double-montage React StrictMode
 * et aux re-rendus — un seul POST /auth/login en vol à la fois. À utiliser
 * UNIQUEMENT en mode réel (jamais en mode mock, où l'auth est désactivée).
 */

import { login } from "@/lib/api/endpoints";
import { tokenStore } from "@/lib/api/client";
import { AUTO_LOGIN_USER, AUTO_LOGIN_PASSWORD } from "@/lib/env";

let inFlight: Promise<void> | null = null;

/**
 * Garantit qu'un access token est présent en lançant un login si nécessaire.
 * Renvoie la même promesse pour tous les appelants concurrents (singleton).
 * Réinitialise le singleton après chaque résolution pour permettre un nouvel
 * essai (bouton « Réessayer » après échec backend).
 */
export function ensureAutoLogin(
  username: string = AUTO_LOGIN_USER,
  password: string = AUTO_LOGIN_PASSWORD,
): Promise<void> {
  if (tokenStore.getAccess()) return Promise.resolve();
  if (inFlight) return inFlight;
  inFlight = login(username, password)
    .then(() => undefined)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
