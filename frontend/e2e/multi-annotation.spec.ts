import { test, expect, type Page } from "@playwright/test";

/**
 * Multi-annotation (e2e) — signaux d'ÉTANCHÉITÉ et de SUPERVISION côté UI :
 *  - workspace : bannière de session (« Ma session » vs « Lecture seule ») ;
 *  - sélecteur de documents : 1 entrée par document (jamais l'union des sessions) ;
 *  - console admin : matrice « Suivi des sessions » document × annotateur.
 * S'appuie sur MSW (mode démo).
 */

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("Multi-annotation — étanchéité & supervision (UI)", () => {
  test("workspace : bannière de session + sélecteur sans doublon", async ({ page }: { page: Page }) => {
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();
    // La bannière de session indique clairement le mode (édition vs lecture seule).
    await expect(page.getByTestId("session-banner")).toBeVisible();
    // Sélecteur : aucune option de document en double.
    await page.getByTestId("document-switcher-button").click();
    const options = page.locator('[data-testid^="document-option-"]');
    const ids = await options.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("admin : matrice de suivi des sessions (document × annotateur)", async ({ page }: { page: Page }) => {
    await page.goto("/admin/projects/claudette-gold-v1");
    await page.getByTestId("tab-sessions").click();
    await expect(page.getByTestId("sessions-matrix")).toBeVisible();
    // Accès « œil » en lecture seule à des sessions d'annotateurs (supervision).
    const eyes = page.locator('[data-testid^="session-view-"]');
    expect(await eyes.count()).toBeGreaterThan(0);
  });
});
