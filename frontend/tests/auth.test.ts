/**
 * Tests de la logique d'authentification front.
 *
 *  1. En MODE MOCK (NEXT_PUBLIC_ENABLE_MOCKS=true), l'auto-login est DÉSACTIVÉ :
 *     `ensureAutoLogin` est court-circuité côté flag (AUTO_LOGIN_ENABLED=false)
 *     et aucun POST /auth/login n'est émis par l'AuthGate. On vérifie le flag.
 *  2. En MODE RÉEL avec NEXT_PUBLIC_AUTO_LOGIN=true, `ensureAutoLogin` appelle
 *     l'endpoint login et stocke un token (singleton, idempotent).
 *
 * On manipule les variables d'env via vi.stubEnv + vi.resetModules pour que les
 * constantes de src/lib/env.ts soient recalculées à chaque import dynamique.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("flags d'auth selon le mode", () => {
  it("MODE MOCK → auto-login désactivé (AUTO_LOGIN_ENABLED=false)", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_MOCKS", "true");
    vi.stubEnv("NEXT_PUBLIC_AUTO_LOGIN", "true");
    const env = await import("@/lib/env");
    expect(env.MOCKS_ENABLED).toBe(true);
    expect(env.AUTO_LOGIN_ENABLED).toBe(false);
    expect(env.DEBUG_BAR_ENABLED).toBe(false);
  });

  it("MODE RÉEL + NEXT_PUBLIC_AUTO_LOGIN=true → auto-login activé", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_MOCKS", "false");
    vi.stubEnv("NEXT_PUBLIC_AUTO_LOGIN", "true");
    const env = await import("@/lib/env");
    expect(env.MOCKS_ENABLED).toBe(false);
    expect(env.AUTO_LOGIN_ENABLED).toBe(true);
    expect(env.DEBUG_BAR_ENABLED).toBe(true);
  });
});

describe("ensureAutoLogin (singleton)", () => {
  it("MODE RÉEL → effectue un login et stocke le token (un seul appel concurrent)", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_MOCKS", "false");
    vi.stubEnv("NEXT_PUBLIC_AUTO_LOGIN", "true");

    const endpoints = await import("@/lib/api/endpoints");
    const { tokenStore } = await import("@/lib/api/client");
    const { ensureAutoLogin } = await import("@/lib/auth");

    const loginSpy = vi
      .spyOn(endpoints, "login")
      .mockImplementation(async () => {
        tokenStore.set("acc", "ref");
        return { access: "acc", refresh: "ref" };
      });

    // Deux appels concurrents → un seul login en vol (idempotence StrictMode).
    await Promise.all([ensureAutoLogin(), ensureAutoLogin()]);

    expect(loginSpy).toHaveBeenCalledTimes(1);
    expect(tokenStore.getAccess()).toBe("acc");

    // Token déjà présent → pas de nouveau login.
    await ensureAutoLogin();
    expect(loginSpy).toHaveBeenCalledTimes(1);
  });
});
