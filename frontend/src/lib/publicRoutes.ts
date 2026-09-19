/**
 * Routes PUBLIQUES : lisibles sans compte, jamais redirigées vers la connexion.
 *
 * Source unique pour l'AuthGate (auto-login de développement), le gestionnaire global de 401
 * et la synchronisation des préférences par compte (qui interroge `/me`). Avant cette liste,
 * un visiteur anonyme de la racine était renvoyé vers `/login?next=/` par le 401 de `/me` :
 * exactement le parcours d'un reviewer arrivant depuis le PDF du papier.
 */

const PUBLIC_PREFIXES = [
  "/presentation",
  "/public",
  "/login",
  "/signup",
  "/welcome",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/join",
];

export function isPublicPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
