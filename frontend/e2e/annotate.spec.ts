import { test, expect } from "@playwright/test";

/**
 * F1 — Simplifier l'annotation humaine. Couvre : ouverture du workspace 3 panneaux,
 * pose d'une frontière de clause au clic et au clavier (B), édition du thème,
 * certitude clavier (0–3), snapshot.
 */

test.describe("Workspace d'annotation (F1)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/annotate/ann-1");
    await expect(page.getByTestId("annotation-workspace")).toBeVisible();
  });

  test("affiche les trois panneaux", async ({ page }) => {
    await expect(page.getByRole("complementary", { name: "Plan du document" })).toBeVisible();
    await expect(page.getByRole("main", { name: "Document" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Inspecteur" })).toBeVisible();
  });

  test("pose une frontière de clause en cliquant une phrase", async ({ page }) => {
    // Une phrase sans ancre existante (index 12).
    await page.getByTestId("sentence-12").click();
    await expect(page.getByTestId("inspector")).toBeVisible();
    // La nouvelle clause apparaît dans le plan.
    await expect(page.getByTestId("clause-chip").filter({ hasText: "[12]" })).toBeVisible();
  });

  test("pose une frontière au clavier (B) puis règle la certitude (3)", async ({ page }) => {
    await page.getByTestId("sentence-8").click();
    // Déplacement clavier et pose d'ancre.
    await page.keyboard.press("j");
    await page.keyboard.press("b");
    // Certitude clavier sur la clause sélectionnée.
    await page.keyboard.press("3");
    await expect(page.getByTestId("certainty-3")).toHaveAttribute("aria-checked", "true");
  });

  test("change le thème via la palette", async ({ page }) => {
    await page.getByTestId("sentence-22").click();
    const input = page.getByLabel("Rechercher un thème");
    await input.fill("arbitrage");
    await page.getByTestId("theme-option-ARBITRATION_DISPUTES").click();
    await expect(
      page.getByTestId("inspector").getByText("Arbitrage & litiges"),
    ).toBeVisible();
  });

  test("snapshot via le bouton", async ({ page }) => {
    await page.getByTestId("snapshot-btn").click();
    await expect(page.getByTestId("snapshot-msg")).toBeVisible();
  });
});
