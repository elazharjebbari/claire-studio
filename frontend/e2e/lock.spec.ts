import { test, expect } from "@playwright/test";

/**
 * Verrouillage / déverrouillage (point 2). Verrou MANUEL via la toolbar (indépendant
 * du gate de soumission) : bandeau persistant + passage en lecture seule, puis
 * déverrouillage avec confirmation et retour en édition.
 */
test.use({ viewport: { width: 1440, height: 900 } });

test.describe("Verrouillage du document", () => {
  test("verrouiller → bandeau + lecture seule ; déverrouiller → édition", async ({ page }) => {
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();

    // État initial : non verrouillé, le cadenas propose « Verrouiller ».
    const lockBtn = page.getByTestId("toolbar-lock");
    await expect(lockBtn).toBeVisible();
    await expect(page.getByTestId("lock-banner")).toHaveCount(0);

    // Verrouiller.
    await lockBtn.click();
    await expect(page.getByTestId("lock-banner")).toBeVisible();
    // Lecture seule : la soumission est désactivée tant que verrouillé.
    await expect(page.getByTestId("submit-btn")).toBeDisabled();
    // Le cadenas bascule sur « Verrouillé » (déverrouillage).
    await expect(page.getByTestId("toolbar-unlock")).toBeVisible();

    // Déverrouiller : confirmation requise.
    await page.getByTestId("toolbar-unlock").click();
    await expect(page.getByTestId("unlock-dialog")).toBeVisible();
    await page.getByTestId("unlock-confirm").click();

    // Retour en édition : bandeau parti, soumission de nouveau possible.
    await expect(page.getByTestId("lock-banner")).toHaveCount(0);
    await expect(page.getByTestId("submit-btn")).toBeEnabled();
  });

  test("verrou NIVEAU PROJET : l'admin gèle puis dégèle la campagne", async ({ page }) => {
    // Console projet → onglet Publication → bascule de verrou de campagne.
    page.on("dialog", (d) => d.accept()); // confirme le gel (toutes sessions)
    await page.goto("/admin/projects/claudette-gold-v1");
    await page.getByTestId("tab-publish").click();
    const btn = page.getByTestId("toggle-project-lock");
    await expect(btn).toHaveText(/Verrouiller le projet/);
    // Verrouiller : le bouton reflète l'état (refetch projet).
    await btn.click();
    await expect(btn).toHaveText(/Déverrouiller le projet/);
    // Déverrouiller (pas de confirmation requise pour lever le gel).
    await btn.click();
    await expect(btn).toHaveText(/Verrouiller le projet/);
  });

  test("déverrouillage annulable", async ({ page }) => {
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();
    await page.getByTestId("toolbar-lock").click();
    await expect(page.getByTestId("lock-banner")).toBeVisible();

    await page.getByTestId("toolbar-unlock").click();
    await page.getByTestId("unlock-cancel").click();
    // Annulé : toujours verrouillé.
    await expect(page.getByTestId("unlock-dialog")).toHaveCount(0);
    await expect(page.getByTestId("lock-banner")).toBeVisible();
  });
});
