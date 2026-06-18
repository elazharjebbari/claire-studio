import { test, expect } from "@playwright/test";

/**
 * F4 / F10 — Collaboration : cloche d'activité (« qui a annoté quoi ») + tableau
 * de bord projet avec accord inter-annotateurs (IAA, κ de Cohen). S'appuie sur MSW.
 */

test.describe("Collaboration (F4) & IAA", () => {
  test("ouvre la cloche d'activité depuis la top bar", async ({ page }) => {
    await page.goto("/projects/claudette-gold-v1");
    await page.getByTestId("activity-bell").click();
    const dialog = page.getByRole("dialog", { name: "Activité récente" });
    await expect(dialog).toBeVisible();
    // Les événements des fixtures sont listés (Alice / Bruno).
    await expect(dialog).toContainText("Alice");
  });

  test("affiche l'IAA : accord global, frontières et κ par thème", async ({ page }) => {
    await page.goto("/projects/claudette-gold-v1");
    const iaa = page.getByTestId("iaa-dashboard");
    await expect(iaa).toBeVisible();
    // Accord global et frontières.
    await expect(page.getByTestId("iaa-global")).toContainText("0.78");
    await expect(page.getByTestId("iaa-boundaries")).toContainText("0.71");
    // κ par thème : au moins un thème connu est rendu sous forme de barre.
    await expect(page.getByTestId("iaa-theme-META")).toContainText("0.94");
    await expect(page.getByTestId("iaa-theme-MISC_BOILERPLATE")).toContainText("0.41");
  });
});
