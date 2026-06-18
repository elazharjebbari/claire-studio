import { test, expect } from "@playwright/test";

/**
 * F4 — Collaboration : cloche d'activité (« qui a annoté quoi ») + tableau de bord.
 * Squelette structuré.
 */

test.describe("Collaboration (F4)", () => {
  test("ouvre la cloche d'activité depuis la top bar", async ({ page }) => {
    await page.goto("/projects/claudette-gold-v1");
    await page.getByTestId("activity-bell").click();
    await expect(page.getByRole("dialog", { name: "Activité récente" })).toBeVisible();
  });

  test.fixme("affiche l'IAA et la progression par annotateur", async () => {
    // TODO.
  });
});
