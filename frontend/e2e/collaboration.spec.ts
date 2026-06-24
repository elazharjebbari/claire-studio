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

  test("affiche les statuts par document (point 2)", async ({ page }) => {
    await page.goto("/projects/claudette-gold-v1");
    const badges = page.getByTestId("doc-status-badge");
    await expect(badges.first()).toBeVisible();
    // Le document en cours (fixture) est un brouillon → badge « Brouillon ».
    await expect(badges.filter({ hasText: "Brouillon" }).first()).toBeVisible();
  });

  test("affiche la concordance avec les modèles (point 4) : meilleur modèle + LLM↔LLM", async ({ page }) => {
    await page.goto("/projects/claudette-gold-v1");
    const panel = page.getByTestId("concordance-panel");
    await expect(panel).toBeVisible();
    await expect(page.getByTestId("concordance-panel-best")).toContainText("Claude");
    await expect(page.getByTestId("concordance-panel-best")).toContainText("82%");
    await expect(page.getByTestId("concordance-panel-llm-mean")).toBeVisible();
  });
});
