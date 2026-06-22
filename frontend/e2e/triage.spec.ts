import { test, expect, type Page } from "@playwright/test";

/**
 * File de triage (e2e) — annotation assistée multi-label (protocole C1–C5).
 * Le bouton n'apparaît que pour le propriétaire (isMine) et sous TRIAGE_ENABLED (vrai en
 * mode mock). On ouvre la file, on vérifie la carte de suggestion (niveau + explication),
 * la navigation clavier, et une acceptation. S'appuie sur MSW (mode démo, ann-1 = u-alice).
 */

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("File de triage — carte de suggestion & gestes", () => {
  test("ouvre la file, affiche une suggestion, navigue et accepte", async ({ page }: { page: Page }) => {
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();

    // Bouton réservé au propriétaire + flag (mock).
    const toggle = page.getByTestId("toggle-triage");
    await expect(toggle).toBeVisible();
    await toggle.click();

    // La file s'ouvre, prête (≥ 2 juges dans le mock).
    const queue = page.getByTestId("triage-queue");
    await expect(queue).toBeVisible();
    await expect(page.getByTestId("triage-count-C1")).toBeVisible();

    // Carte de suggestion : badge de niveau + explication déterministe.
    await expect(page.getByTestId("suggestion-card")).toBeVisible();
    await expect(page.getByTestId("triage-badge")).toBeVisible();
    await expect(page.getByTestId("suggestion-logic")).toBeVisible();

    // Navigation clavier (j) — la position change.
    const posBefore = await page.getByTestId("triage-position").textContent();
    await page.keyboard.press("j");
    await expect(page.getByTestId("triage-position")).not.toHaveText(posBefore ?? "");

    // Acceptation (si la carte courante propose une action primaire, hors C5).
    const accept = page.getByTestId("suggestion-accept");
    if (await accept.isVisible().catch(() => false)) {
      await accept.click();
    }

    // Fermeture.
    await page.getByTestId("triage-close").click();
    await expect(queue).toBeHidden();
  });

  test("acceptation par lot C1 (un geste)", async ({ page }: { page: Page }) => {
    await page.goto("/annotate/ann-1");
    await page.getByTestId("toggle-triage").click();
    const batch = page.getByTestId("triage-batch-c1");
    if (await batch.isVisible().catch(() => false)) {
      await batch.click();
      // Le lot est consommé : le bouton disparaît (plus de C1 à traiter).
      await expect(batch).toBeHidden();
    }
  });
});
