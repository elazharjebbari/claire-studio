/**
 * Détection centralisée du mode d'exécution du frontend.
 *
 * - `MOCKS_ENABLED` : MSW intercepte les requêtes (mode démo / E2E Playwright).
 *   Dans ce mode, TOUTE la logique d'authentification (auto-login, garde,
 *   redirection 401, DebugBar) doit être DÉSACTIVÉE afin de ne pas casser les
 *   tests E2E qui tournent sans token.
 * - `REAL_MODE` : le frontend parle à l'API Django réelle (JWT requis).
 */

// Garde de sécurité : les mocks MSW ne peuvent JAMAIS être actifs dans un build de
// production, même si la variable d'env est laissée à "true" par erreur (évite
// d'exposer des données fictives type « Bruno » en prod).
export const MOCKS_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_MOCKS === "true" &&
  process.env.NODE_ENV !== "production";

/** Vrai quand on parle à un vrai backend (JWT requis). Inverse du mode mock. */
export const REAL_MODE = !MOCKS_ENABLED;

/** Auto-login dev : seulement en mode réel et si explicitement activé. */
export const AUTO_LOGIN_ENABLED =
  REAL_MODE && process.env.NEXT_PUBLIC_AUTO_LOGIN === "true";

export const AUTO_LOGIN_USER = process.env.NEXT_PUBLIC_AUTO_LOGIN_USER || "alice";
export const AUTO_LOGIN_PASSWORD =
  process.env.NEXT_PUBLIC_AUTO_LOGIN_PASSWORD || "claire-demo";

/**
 * Affichage de la barre de debug : uniquement en DÉVELOPPEMENT (mode réel local),
 * ou forcé explicitement via NEXT_PUBLIC_DEBUG=true. JAMAIS en production
 * (NODE_ENV === "production") — le bandeau ne doit pas être exposé aux visiteurs.
 */
export const DEBUG_BAR_ENABLED =
  (REAL_MODE && process.env.NODE_ENV !== "production") ||
  process.env.NEXT_PUBLIC_DEBUG === "true";

/** Dev runtime (utilisé pour le détail des stacks d'erreur). */
export const IS_DEV = process.env.NODE_ENV !== "production";
